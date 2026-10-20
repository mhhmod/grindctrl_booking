import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MessengerPanel } from './MessengerPanel';
import type { PublicMessengerPayload } from '@/lib/messenger/public-api';

/* The v16 Store Chat shell, inside the panel (03-store-chat.md): Escape
   asks the loader to close, and opening moves focus into the composer. */

const CONFIG = {
  v: 3,
  key: 'gc_test_key',
  storeName: 'Maison',
  active: true,
  available: true,
  aiEnabled: true,
  attachmentsEnabled: false,
  features: ['v16_chat'],
  appearance: {
    accentColor: '#ff8000',
    launcherIcon: 'help',
    launcherCustomIconUrl: null,
    launcherLabel: { en: 'Support', ar: 'الدعم' },
    launcherSizePx: 52,
    position: 'bottom-right',
    radiusStyle: 'sharp',
    themeMode: 'light',
    assistantAvatarUrl: null,
  },
  behaviour: {
    welcomeTitle: { en: 'Hi', ar: 'مرحبا' },
    welcomeSubtitle: { en: 'Ask us', ar: 'اسألنا' },
    inputPlaceholder: { en: 'Ask anything…', ar: 'اسأل' },
  },
} as unknown as PublicMessengerPayload;

let parentWindow: Window;
let host: HTMLIFrameElement;
const realParent = Object.getOwnPropertyDescriptor(window, 'parent');

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const body = url.includes('bootstrap')
        ? { anonymousId: 'anon12345678', conversationId: 'b3c9d1e2-1111-4222-8333-444455556666', status: 'open', messages: [] }
        : { status: 'open', messages: [] };
      return { ok: true, status: 200, json: () => Promise.resolve(body) } as unknown as Response;
    }),
  );
  // The panel lives in an iframe; a real window stands in for the store page.
  host = document.createElement('iframe');
  document.body.appendChild(host);
  parentWindow = host.contentWindow!;
  Object.defineProperty(window, 'parent', { value: parentWindow, configurable: true });
});

afterEach(() => {
  if (realParent) Object.defineProperty(window, 'parent', realParent);
  host.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function boot(config: PublicMessengerPayload = CONFIG) {
  render(<MessengerPanel config={config} originToken="tok" locale="en" />);
  await waitFor(() => expect(fetch).toHaveBeenCalled());
  await act(async () => {
    await Promise.resolve();
  });
}

describe('the v16 panel', () => {
  it('asks the store page to close it on Escape', async () => {
    const posted = vi.spyOn(parentWindow, 'postMessage');
    await boot();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(posted).toHaveBeenCalledWith({ type: 'grindctrl-messenger:close' }, '*');
  });

  it('moves focus into the composer when the store page opens it', async () => {
    await boot();
    const composer = await screen.findByRole('textbox');
    (document.activeElement as HTMLElement | null)?.blur();
    act(() => {
      window.dispatchEvent(new MessageEvent('message', { data: { type: 'grindctrl-messenger:opened' }, source: parentWindow }));
    });
    expect(document.activeElement).toBe(composer);
  });

  it('leaves Escape and focus alone for a store without the flag', async () => {
    const posted = vi.spyOn(parentWindow, 'postMessage');
    await boot({ ...CONFIG, features: [] } as PublicMessengerPayload);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(posted).not.toHaveBeenCalledWith({ type: 'grindctrl-messenger:close' }, '*');
  });

  it('tells the shopper who answers, with no GrindCTRL line on the store', async () => {
    await boot();
    expect(await screen.findByText(/Answers come from the store's AI assistant\./)).toBeInTheDocument();
    expect(screen.queryByText(/GRINDCTRL/)).toBeNull();
  });
});
