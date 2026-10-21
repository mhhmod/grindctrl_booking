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
let bootMessages: Array<Record<string, unknown>> = [];
let host: HTMLIFrameElement;
const realParent = Object.getOwnPropertyDescriptor(window, 'parent');

beforeEach(() => {
  sentBodies = [];
  bootMessages = [];
  localStorage.clear();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/send') && init?.body) sentBodies.push(JSON.parse(String(init.body)) as Record<string, unknown>);
      const body = url.includes('bootstrap')
        ? { anonymousId: 'anon12345678', conversationId: 'b3c9d1e2-1111-4222-8333-444455556666', status: 'open', messages: bootMessages }
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
    expect(card.textContent?.replace(/\u00a0/g, ' ')).toContain('Black · M · EGP 3,250');
    // Each part isolated, so a Latin variant and the price cannot run
    // together in the Arabic panel ("$Black · S · 79 US" on the live store).
    expect([...card.querySelectorAll('bdi')].map((el) => el.textContent?.replace(/\u00a0/g, ' '))).toEqual([
      'Black',
      'M',
      'EGP 3,250',
    ]);
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

  it('switches between Arabic and English from the header, and remembers it on this phone', async () => {
    await boot();
    fireEvent.click(await screen.findByRole('button', { name: 'عربي' }));
    expect(await screen.findByRole('button', { name: 'تتبع الطلب' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'عربي' })).toHaveAttribute('aria-pressed', 'true');
    expect(localStorage.getItem('gc_msgr_lang_gc_test_key')).toBe('ar');
    cleanup();

    // The live embed passes no locale of its own; the page's comes in the URL.
    render(<MessengerPanel config={CONFIG} originToken="tok" />);
    expect(await screen.findByRole('button', { name: 'تتبع الطلب' })).toBeInTheDocument();
  });

  it('shows the piece in the header with a way back home once the conversation is going', async () => {
    bootMessages = [
      { id: 'u1', role: 'user', content: 'Is this in black in M?', createdAt: '2026-10-20T10:00:00Z' },
      { id: 'a1', role: 'assistant', content: 'Yes, black is in M.', author: 'ai', createdAt: '2026-10-20T10:00:05Z' },
    ];
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

    const back = await screen.findByRole('button', { name: 'Back to chat home' });
    expect(screen.getByRole('banner')).toHaveTextContent('Layla Embroidered Abaya');
    // An answer was the last word, so the box asks for a follow-up.
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveAttribute('placeholder', 'Ask a follow-up');
    // Each bubble and the box take their own direction.
    expect(screen.getByText('Yes, black is in M.').closest('[dir]')).toHaveAttribute('dir', 'auto');
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveAttribute('dir', 'auto');
    // The AI label sits under the assistant's turn.
    expect(screen.getByText('Store assistant, AI')).toBeInTheDocument();

    fireEvent.click(back);
    expect(screen.getByRole('button', { name: 'Track my order' })).toBeInTheDocument();
    expect(screen.queryByText('Yes, black is in M.')).toBeNull();
  });
});

describe('the reply ratings, for every store', () => {
  it('names Helpful and Not helpful in the shopper\'s language', async () => {
    bootMessages = [{ id: 'a1', role: 'assistant', content: 'أهلاً', author: 'ai', createdAt: '2026-10-20T10:00:05Z' }];
    render(<MessengerPanel config={{ ...CONFIG, features: [] } as PublicMessengerPayload} originToken="tok" locale="ar" />);
    expect(await screen.findByRole('button', { name: 'مفيدة' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'غير مفيدة' })).toBeInTheDocument();
  });
});

/* Chat-More: Track my order opens the lookup form where the store offers
   it; the form goes to its own endpoint, never the model, and the card it
   brings back comes from the store's order data. */
describe('the order lookup in the v16 panel', () => {
  const CARD = {
    name: '#1027',
    placedAt: '2026-10-14T09:00:00Z',
    stage: 'on_its_way',
    items: [{ title: 'Layla Embroidered Abaya', quantity: 1 }],
    timeline: [
      { kind: 'placed', at: '2026-10-14T09:00:00Z' },
      { kind: 'shipped', at: '2026-10-15T12:00:00Z', carrier: 'Bosta' },
    ],
    estimatedDelivery: null,
    carrier: 'Bosta',
    trackingUrl: 'https://bosta.co/t/1',
    cashDue: true,
  };
  let lookups: Array<Record<string, unknown>>;

  beforeEach(() => {
    lookups = [];
    const base = fetch as unknown as (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (!String(input).includes('/api/messenger/order-lookup')) return base(input, init);
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        lookups.push(body);
        const found = body.contact === 'mona@gmail.com';
        return {
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              ok: found,
              ...(found ? {} : { error: 'not_found' }),
              messages: [
                { id: `q${lookups.length}`, role: 'user', content: `#1027 · ${found ? 'm' : 'x'}•••••@gmail.com`, createdAt: '2026-10-20T12:00:00Z' },
                found
                  ? { id: `a${lookups.length}`, role: 'assistant', author: 'ai', content: "Found it. It's on its way with Bosta.", createdAt: '2026-10-20T12:00:01Z', order: CARD }
                  : { id: `a${lookups.length}`, role: 'assistant', author: 'ai', content: "I couldn't find an order matching those details. If you'd like, I can bring in the team.", createdAt: '2026-10-20T12:00:01Z' },
              ],
            }),
        } as unknown as Response;
      }),
    );
  });

  it('opens the form from Track my order instead of asking the model', async () => {
    await boot({ ...CONFIG, orderLookup: true } as PublicMessengerPayload);
    fireEvent.click(await screen.findByRole('button', { name: 'Track my order' }));
    expect(screen.getByLabelText('Order number')).toBeInTheDocument();
    expect(screen.getByLabelText('Email you ordered with')).toBeInTheDocument();
    expect(screen.getByText('We only show an order to the email that placed it.')).toBeInTheDocument();
    expect(sentBodies).toHaveLength(0);
  });

  it('checks the shape of what was typed before sending anything', async () => {
    await boot({ ...CONFIG, orderLookup: true } as PublicMessengerPayload);
    fireEvent.click(await screen.findByRole('button', { name: 'Track my order' }));
    fireEvent.change(screen.getByLabelText('Order number'), { target: { value: 'abc' } });
    fireEvent.click(screen.getByRole('button', { name: 'Find my order' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter the number from your order confirmation, like 1027.');
    fireEvent.change(screen.getByLabelText('Order number'), { target: { value: '#1027' } });
    fireEvent.change(screen.getByLabelText('Email you ordered with'), { target: { value: 'nope' } });
    fireEvent.click(screen.getByRole('button', { name: 'Find my order' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Please enter a valid email address.');
    expect(lookups).toHaveLength(0);
  });

  it('keeps the form after a miss, and shows the card from the store after a find', async () => {
    await boot({ ...CONFIG, orderLookup: true } as PublicMessengerPayload);
    fireEvent.click(await screen.findByRole('button', { name: 'Track my order' }));
    fireEvent.change(screen.getByLabelText('Order number'), { target: { value: '#1027' } });
    fireEvent.change(screen.getByLabelText('Email you ordered with'), { target: { value: 'other@gmail.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Find my order' }));
    expect(await screen.findByText(/couldn't find an order matching those details/)).toBeInTheDocument();
    expect(screen.getByLabelText('Order number')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Email you ordered with'), { target: { value: 'mona@gmail.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Find my order' }));
    expect(await screen.findByText("Found it. It's on its way with Bosta.")).toBeInTheDocument();
    expect(lookups.at(-1)).toMatchObject({ orderNumber: '1027', contact: 'mona@gmail.com', locale: 'en' });
    expect(screen.queryByLabelText('Order number')).not.toBeInTheDocument();

    expect(screen.getByText('On its way')).toBeInTheDocument();
    expect(screen.getByText('Shipped with Bosta')).toBeInTheDocument();
    expect(screen.getByText('Cash due on delivery')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Track with Bosta' })).toHaveAttribute('href', 'https://bosta.co/t/1');
    expect(screen.getByText('Store assistant, AI · it can read your order but not change it')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveAttribute('placeholder', 'Ask about this order');
  });

  it('sends Track my order to the chat as before where the store has no lookup', async () => {
    await boot();
    fireEvent.click(await screen.findByRole('button', { name: 'Track my order' }));
    await waitFor(() => expect(sentBodies).toHaveLength(1));
    expect(sentBodies[0].text).toBe('Where is my order?');
  });
});
