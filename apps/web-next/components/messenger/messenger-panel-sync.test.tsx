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
