import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AssistantClient, ChatStreamResult } from '@/lib/assistant/client';
import { getAssistantDictionary } from '@/lib/assistant/i18n';
import { persistSiteLocale } from '@/lib/landing/site-locale-store';
import { ChatWindow } from './chat-window';
import { AssistantLocaleProvider } from './locale-provider';

function makeClient(): AssistantClient {
  return {
    fetchSession: vi.fn().mockResolvedValue({ tenantId: 'test', authenticated: false,
      budgets: { chat: { remaining: 8, resetSeconds: 0 }, voice: { remaining: 3, resetSeconds: 0 } } }),
    streamChat: vi.fn<AssistantClient['streamChat']>(async (_message, _history, onToken) => { onToken('Reply'); return { ok: true }; }),
    transcribeAudio: vi.fn().mockResolvedValue({ ok: true, transcript: 'Hello' }),
    // No real audio/provider call: this verifies the UI's callback lifecycle.
    streamTts: vi.fn().mockResolvedValue({ ok: false, kind: 'provider_unavailable', message: 'Unavailable' }),
  };
}

function mount(client: AssistantClient) {
  return render(<AssistantLocaleProvider initialLocale="en"><ChatWindow client={client} /></AssistantLocaleProvider>);
}

afterEach(() => { document.cookie = 'gc-locale=;path=/;max-age=0'; });

describe('ChatWindow committed reply preferences', () => {
  it('uses the latest site voice locale after an in-flight reply completes', async () => {
    const client = makeClient();
    let resolveReply!: (result: ChatStreamResult) => void;
    vi.mocked(client.streamChat).mockImplementation((_message, _history, onToken) => {
      onToken('Reply');
      return new Promise((resolve) => { resolveReply = resolve; });
    });
    const en = getAssistantDictionary('en');
    mount(client);
    fireEvent.click(screen.getByRole('button', { name: en.modeVoice }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: en.send }));
    act(() => persistSiteLocale('ar'));
    await act(async () => { resolveReply({ ok: true }); });
    await waitFor(() => expect(client.streamTts).toHaveBeenCalledWith('Reply', expect.any(Function), 'ar'));
  });

  it('stops requesting voice and clears its old error after output is switched off', async () => {
    const client = makeClient();
    const en = getAssistantDictionary('en');
    mount(client);
    fireEvent.click(screen.getByRole('button', { name: en.modeVoice }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'First' } });
    fireEvent.click(screen.getByRole('button', { name: en.send }));
    expect(await screen.findByText(en.voiceReplyUnavailable)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: en.modeText }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Second' } });
    fireEvent.click(screen.getByRole('button', { name: en.send }));
    await waitFor(() => expect(screen.queryByText(en.voiceReplyUnavailable)).not.toBeInTheDocument());
    expect(client.streamTts).toHaveBeenCalledTimes(1);
  });
});
