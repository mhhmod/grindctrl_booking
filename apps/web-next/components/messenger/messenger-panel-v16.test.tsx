import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
let sentBodies: Array<Record<string, unknown>> = [];
let host: HTMLIFrameElement;
const realParent = Object.getOwnPropertyDescriptor(window, 'parent');

beforeEach(() => {
  sentBodies = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/send') && init?.body) sentBodies.push(JSON.parse(String(init.body)) as Record<string, unknown>);
      const body = url.includes('bootstrap')
        ? { anonymousId: 'anon12345678', conversationId: 'b3c9d1e2-1111-4222-8333-444455556666', status: 'open', messages: [] }
        : url.includes('/send')
          ? { userMessage: { id: 'u1', role: 'user', content: 'x', createdAt: new Date().toISOString() }, reply: null, status: 'open' }
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

  it('opens on a home with the welcome, the AI label and four quick actions', async () => {
    await boot();
    expect(await screen.findByRole('heading', { name: 'Hi' })).toBeInTheDocument();
    expect(screen.getByText('Store assistant, AI')).toBeInTheDocument();
    for (const label of ['Track my order', 'Sizes and fit', 'Delivery and exchange', 'Talk to a person']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
  });

  it('sends a clear first message from a quick action, and asks for a person in words the handoff reads', async () => {
    await boot();
    fireEvent.click(await screen.findByRole('button', { name: 'Talk to a person' }));
    await waitFor(() => expect(sentBodies).toHaveLength(1));
    expect(sentBodies[0].text).toBe('I want to talk to a person.');
  });

  it("shows the piece on the page, and opens the store's try-on from it", async () => {
    const posted = vi.spyOn(parentWindow, 'postMessage');
    await boot();
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          source: parentWindow,
          data: {
            type: 'grindctrl-messenger:page-product',
            product: { handle: 'layla-abaya', title: 'Layla Embroidered Abaya', imageUrl: '', variantId: '456', variantTitle: 'Black / M', priceMinor: 325000, currency: 'EGP', tryOn: true },
          },
        }),
      );
    });
    const card = await screen.findByRole('region', { name: "You're viewing" });
    expect(card).toHaveTextContent('Layla Embroidered Abaya');
    expect(card.textContent?.replace(/\u00a0/g, ' ')).toContain('Black, M · EGP 3,250');
    fireEvent.click(screen.getByRole('button', { name: 'Try it on' }));
    expect(posted).toHaveBeenCalledWith({ type: 'grindctrl-messenger:try-on' }, '*');
  });

  it('says in the header who answers now, from the team hours', async () => {
    await boot({ ...CONFIG, team: { open: true, opensAt: null, closesAt: '22:00', timezone: 'Africa/Cairo' } } as PublicMessengerPayload);
    expect(await screen.findByText('Assistant answers now · team here until 10 pm')).toBeInTheDocument();
  });

  it('offers the microphone only where the browser has speech input, and writes what it heard', async () => {
    await boot();
    expect(screen.queryByRole('button', { name: 'Speak your message' })).toBeNull();
    cleanup();

    class FakeSpeech {
      lang = '';
      interimResults = false;
      continuous = false;
      onresult: ((event: { results: Array<Array<{ transcript: string }>> }) => void) | null = null;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      start() {
        this.onresult?.({ results: [[{ transcript: 'Is this in black?' }]] });
        this.onend?.();
      }
      stop() {}
    }
    (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition = FakeSpeech;
    try {
      await boot();
      fireEvent.click(await screen.findByRole('button', { name: 'Speak your message' }));
      expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('Is this in black?');
    } finally {
      delete (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
    }
  });
});
