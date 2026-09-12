import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MessengerPanel } from './MessengerPanel';
import type { PublicMessengerPayload } from '@/lib/messenger/public-api';

/* The panel is an iframe on the merchant's storefront. A shopper who has
   asked a question and is waiting for an answer switches nothing and clicks
   nothing, so neither `visibilitychange` nor `focus` ever fires — and those
   two events were the panel's entire sync trigger. A reply typed by the
   merchant sat in the database, perfectly reachable through
   /api/messenger/sync, until the shopper happened to tab away and back.

   These tests drive time, not events, because time is what a waiting shopper
   actually produces. */

const CONFIG = {
  v: 3,
  key: 'gc_test_key',
  storeName: 'Demo store',
  active: true,
  available: true,
  aiEnabled: true,
  attachmentsEnabled: false,
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
    quickReplies: [],
    availabilityMode: 'always',
    availabilityTimezone: null,
    availabilityHours: [],
  },
  contactCapture: { enabled: false, askOutsideHours: false },
} as unknown as PublicMessengerPayload;

const BOOTSTRAP = {
  anonymousId: 'anon12345678',
  conversationId: 'b3c9d1e2-1111-4222-8333-444455556666',
  status: 'open',
  messages: [],
};

const MERCHANT_REPLY = {
  id: 'm-agent-1',
  role: 'assistant',
  content: 'This is the merchant replying by hand.',
  createdAt: new Date().toISOString(),
  author: 'agent',
};

const HUMAN_REPLY = {
  id: 'm-human-1',
  role: 'assistant',
  content: 'A real person typed this.',
  createdAt: new Date().toISOString(),
  author: 'human',
};

const AI_REPLY = {
  id: 'm-ai-1',
  role: 'assistant',
  content: 'The assistant answered this.',
  createdAt: new Date().toISOString(),
  author: 'ai',
};

let fetchMock: ReturnType<typeof vi.fn>;

function syncCalls() {
  return fetchMock.mock.calls.filter((c) => String(c[0]).includes('/api/messenger/sync'));
}

/** Boots the panel under fake timers and lets its promise chain settle. */
async function bootPanel(originToken = 'tok') {
  const view = render(<MessengerPanel config={CONFIG} originToken={originToken} locale="en" />);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(50);
  });
  return view;
}

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const body = url.includes('/api/messenger/bootstrap')
      ? BOOTSTRAP
      : { status: 'open', messages: [MERCHANT_REPLY] };
    return { ok: true, json: () => Promise.resolve(body) } as unknown as Response;
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('MessengerPanel reply delivery', () => {
  it('polls for replies while the shopper sits waiting with the panel open', async () => {
    await bootPanel();

    // Nothing has happened yet: no tab switch, no click, no focus change —
    // exactly the state a shopper waiting for an answer is in.
    expect(syncCalls()).toHaveLength(0);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(16_000);
    });

    expect(syncCalls().length).toBeGreaterThan(0);
  });

  it('shows the merchant reply that the poll returns', async () => {
    await bootPanel();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(16_000);
    });

    expect(screen.getByText('This is the merchant replying by hand.')).toBeInTheDocument();
  });

  it('carries the origin proof on the polled request', async () => {
    await bootPanel('tok-abc');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(16_000);
    });

    expect(String(syncCalls()[0]?.[0])).toContain('originToken=tok-abc');
  });
});

/* The panel could not be dismissed on a phone: it is full-bleed there, so it
   covers the launcher, which is the control that closes it on desktop. */
describe('MessengerPanel close', () => {
  it('asks the loader to close, since only the loader owns the iframe', async () => {
    const parentPost = vi.fn();
    const originalParent = window.parent;
    Object.defineProperty(window, 'parent', {
      configurable: true,
      value: { postMessage: parentPost },
    });

    try {
      await bootPanel();
      fireEvent.click(screen.getByRole('button', { name: 'Close chat' }));
      expect(parentPost).toHaveBeenCalledWith(
        { type: 'grindctrl-messenger:close' },
        '*',
      );
    } finally {
      Object.defineProperty(window, 'parent', { configurable: true, value: originalParent });
    }
  });

  it('offers no close button in the dashboard preview, which has no loader', async () => {
    render(<MessengerPanel config={CONFIG} variant="preview" locale="en" />);
    expect(screen.queryByRole('button', { name: 'Close chat' })).not.toBeInTheDocument();
  });
});

/* metadata.author already distinguished a bot reply from a human one
   server-side; the shopper-facing render never used it, so a shopper
   reading a resolved thread could not tell a bot answer from a person's. */
describe('MessengerPanel sender labels', () => {
  it('labels a human reply distinctly from an AI reply', async () => {
    fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const body = url.includes('/api/messenger/bootstrap')
        ? { ...BOOTSTRAP, messages: [HUMAN_REPLY, AI_REPLY] }
        : { status: 'open', messages: [] };
      return { ok: true, json: () => Promise.resolve(body) } as unknown as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    await bootPanel();

    expect(screen.getByText('Team')).toBeInTheDocument();
    expect(screen.getByText('Assistant')).toBeInTheDocument();
  });

  it('shows no sender label for the shopper\'s own messages', async () => {
    fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const body = url.includes('/api/messenger/bootstrap')
        ? {
            ...BOOTSTRAP,
            messages: [{ id: 'm-shopper-1', role: 'user', content: 'My own question', createdAt: new Date().toISOString() }],
          }
        : { status: 'open', messages: [] };
      return { ok: true, json: () => Promise.resolve(body) } as unknown as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    await bootPanel();

    expect(screen.getByText('My own question')).toBeInTheDocument();
    expect(screen.queryByText('Team')).not.toBeInTheDocument();
    expect(screen.queryByText('Assistant')).not.toBeInTheDocument();
  });
});

/* The storefront loader (public/widget/v1/messenger.js) identifies the
   shopper on its own origin, before this iframe exists — storage cannot
   cross that boundary, so it forwards the anonId and any known shopper
   token as iframe URL params instead (same channel key/locale/origin
   already use). A verified token is bound to that exact anonId server-side
   (lib/messenger/identity.ts's sid claim), so the two must travel together. */
describe('MessengerPanel shopper identity forwarding', () => {
  afterEach(() => {
    window.history.pushState({}, '', '/');
  });

  it('adopts the loader-supplied anonId and shopper token on bootstrap, not its own', async () => {
    window.history.pushState(
      {},
      '',
      '/embed/messenger?key=gc_test_key&anonId=loader-anon-123456&shopperToken=tok.header.sig',
    );

    await bootPanel();

    const bootstrapCall = fetchMock.mock.calls.find((c) => String(c[0]).includes('/api/messenger/bootstrap'));
    const body = JSON.parse(String((bootstrapCall?.[1] as RequestInit)?.body));
    expect(body.anonymousId).toBe('loader-anon-123456');
    expect(body.shopperToken).toBe('tok.header.sig');
  });

  it('carries the same shopper token on a later message', async () => {
    window.history.pushState(
      {},
      '',
      '/embed/messenger?key=gc_test_key&anonId=loader-anon-123456&shopperToken=tok.header.sig',
    );

    await bootPanel();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'hi there' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    const sendCall = fetchMock.mock.calls.find((c) => String(c[0]).includes('/api/messenger/send'));
    const body = JSON.parse(String((sendCall?.[1] as RequestInit)?.body));
    expect(body.shopperToken).toBe('tok.header.sig');
  });

  it('tops up a token that only arrives after the iframe already booted', async () => {
    const originalParent = window.parent;
    const fakeParent = { postMessage: vi.fn() };
    Object.defineProperty(window, 'parent', { configurable: true, value: fakeParent });

    try {
      await bootPanel();

      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'grindctrl-messenger:identify', token: 'late-token-xyz' },
          source: fakeParent as unknown as MessageEventSource,
        }),
      );

      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'hello again' } });
      fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      const sendCall = fetchMock.mock.calls.find((c) => String(c[0]).includes('/api/messenger/send'));
      const body = JSON.parse(String((sendCall?.[1] as RequestInit)?.body));
      expect(body.shopperToken).toBe('late-token-xyz');
    } finally {
      Object.defineProperty(window, 'parent', { configurable: true, value: originalParent });
    }
  });
});

/* Staff "typing…" presence rides the existing poll, not a new transport: the
   same dots the shopper sees while their own message is in flight also show
   when a sync response reports staffTyping — and clear again once the ping
   goes stale, all without touching the send()-driven typing state. */
describe('MessengerPanel staff typing presence', () => {
  function stubPresence(getStaffTyping: () => boolean, bootstrapTyping = false) {
    fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const body = url.includes('/api/messenger/bootstrap')
        ? { ...BOOTSTRAP, staffTyping: bootstrapTyping }
        : { status: 'open', messages: [], staffTyping: getStaffTyping() };
      return { ok: true, json: () => Promise.resolve(body) } as unknown as Response;
    });
    vi.stubGlobal('fetch', fetchMock);
  }

  it('shows the typing dots when a sync response reports staffTyping: true', async () => {
    stubPresence(() => true);
    await bootPanel();

    expect(screen.queryByRole('status', { name: 'Typing…' })).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(16_000);
    });

    expect(screen.getByRole('status', { name: 'Typing…' })).toBeInTheDocument();
  });

  it('shows the dots from bootstrap when staff are already typing on first load', async () => {
    stubPresence(() => false, true);
    await bootPanel();

    expect(screen.getByRole('status', { name: 'Typing…' })).toBeInTheDocument();
  });

  it('clears the dots once the ping goes stale, without sending anything', async () => {
    let staffTyping = true;
    stubPresence(() => staffTyping);
    await bootPanel();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(16_000);
    });
    expect(screen.getByRole('status', { name: 'Typing…' })).toBeInTheDocument();

    staffTyping = false;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(16_000);
    });
    expect(screen.queryByRole('status', { name: 'Typing…' })).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes('/api/messenger/send'))).toBe(false);
  });
});
