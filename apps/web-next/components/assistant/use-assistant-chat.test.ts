import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useAssistantChat } from './use-assistant-chat';
import type { AssistantClient, ChatStreamResult, SessionInfo, SttResult, TtsStreamResult } from '@/lib/assistant/client';

function makeClient(overrides: Partial<AssistantClient> = {}): AssistantClient {
  const session: SessionInfo = {
    tenantId: 't1',
    authenticated: false,
    budgets: { chat: { remaining: 8, resetSeconds: 0 }, voice: { remaining: 3, resetSeconds: 0 } },
  };
  return {
    fetchSession: vi.fn(async () => session),
    streamChat: vi.fn(async (_msg, _history, onToken) => {
      onToken('Hi ');
      onToken('there!');
      return { ok: true } satisfies ChatStreamResult;
    }),
    transcribeAudio: vi.fn(async () => ({ ok: true, transcript: 'hello' }) satisfies SttResult),
    streamTts: vi.fn(async () => ({ ok: true }) satisfies TtsStreamResult),
    ...overrides,
  };
}

describe('useAssistantChat', () => {
  it('loads the session budgets on mount', async () => {
    const client = makeClient();
    const { result } = renderHook(() => useAssistantChat(client));

    await waitFor(() => expect(result.current.budgets).not.toBeNull());
    expect(result.current.budgets?.chat.remaining).toBe(8);
  });

  it('appends the user message immediately and streams the assistant reply incrementally', async () => {
    const client = makeClient();
    const { result } = renderHook(() => useAssistantChat(client));
    await waitFor(() => expect(result.current.budgets).not.toBeNull());

    await act(async () => {
      await result.current.sendText('Hello');
    });

    expect(result.current.messages).toEqual([
      { id: expect.any(String), role: 'user', content: 'Hello' },
      { id: expect.any(String), role: 'assistant', content: 'Hi there!' },
    ]);
    expect(result.current.status).toBe('idle');
  });

  it('sets rateLimited and does not add an assistant message when over budget', async () => {
    const client = makeClient({
      streamChat: vi.fn(
        async () =>
          ({
            ok: false,
            kind: 'rate_limited',
            info: { resetSeconds: 42, message: 'limit', signInCta: true },
          }) satisfies ChatStreamResult,
      ),
    });
    const { result } = renderHook(() => useAssistantChat(client));
    await waitFor(() => expect(result.current.budgets).not.toBeNull());

    await act(async () => {
      await result.current.sendText('Hello');
    });

    expect(result.current.rateLimited).toEqual({ resetSeconds: 42, message: 'limit', signInCta: true });
    expect(result.current.messages).toEqual([{ id: expect.any(String), role: 'user', content: 'Hello' }]);
  });

  it('sets providerError distinctly from rateLimited on provider failure', async () => {
    const client = makeClient({
      streamChat: vi.fn(
        async () => ({ ok: false, kind: 'provider_unavailable', message: 'down' }) satisfies ChatStreamResult,
      ),
    });
    const { result } = renderHook(() => useAssistantChat(client));
    await waitFor(() => expect(result.current.budgets).not.toBeNull());

    await act(async () => {
      await result.current.sendText('Hello');
    });

    expect(result.current.providerError).toBe('down');
    expect(result.current.rateLimited).toBeNull();
  });

  it('clears a previous providerError when a new send starts', async () => {
    const client = makeClient({
      streamChat: vi
        .fn<AssistantClient['streamChat']>()
        .mockResolvedValueOnce({ ok: false, kind: 'provider_unavailable', message: 'down' })
        .mockResolvedValueOnce({ ok: true }),
    });
    const { result } = renderHook(() => useAssistantChat(client));
    await waitFor(() => expect(result.current.budgets).not.toBeNull());

    await act(async () => {
      await result.current.sendText('first');
    });
    expect(result.current.providerError).toBe('down');

    await act(async () => {
      await result.current.sendText('second');
    });
    expect(result.current.providerError).toBeNull();
  });

  it('calls onAssistantReply with the full assembled text once streaming completes', async () => {
    const client = makeClient();
    const onAssistantReply = vi.fn();
    const { result } = renderHook(() => useAssistantChat(client, onAssistantReply));
    await waitFor(() => expect(result.current.budgets).not.toBeNull());

    await act(async () => {
      await result.current.sendText('Hello');
    });

    expect(onAssistantReply).toHaveBeenCalledWith('Hi there!');
  });

  it('does not call onAssistantReply when the send was rate-limited', async () => {
    const client = makeClient({
      streamChat: vi.fn(
        async () =>
          ({
            ok: false,
            kind: 'rate_limited',
            info: { resetSeconds: 5, message: '', signInCta: true },
          }) satisfies ChatStreamResult,
      ),
    });
    const onAssistantReply = vi.fn();
    const { result } = renderHook(() => useAssistantChat(client, onAssistantReply));
    await waitFor(() => expect(result.current.budgets).not.toBeNull());

    await act(async () => {
      await result.current.sendText('Hello');
    });

    expect(onAssistantReply).not.toHaveBeenCalled();
  });

  it('refreshes budgets after each send so the low-budget indicator stays current', async () => {
    let remaining = 8;
    const client = makeClient({
      fetchSession: vi.fn(async () => ({
        tenantId: 't1',
        authenticated: false,
        budgets: { chat: { remaining, resetSeconds: 0 }, voice: { remaining: 3, resetSeconds: 0 } },
      })),
      streamChat: vi.fn(async (_msg, _history, onToken) => {
        remaining -= 1;
        onToken('ok');
        return { ok: true } satisfies ChatStreamResult;
      }),
    });
    const { result } = renderHook(() => useAssistantChat(client));
    await waitFor(() => expect(result.current.budgets?.chat.remaining).toBe(8));

    await act(async () => {
      await result.current.sendText('Hello');
    });

    await waitFor(() => expect(result.current.budgets?.chat.remaining).toBe(7));
  });
});
