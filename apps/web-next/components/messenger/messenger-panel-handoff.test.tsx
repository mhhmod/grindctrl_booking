import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MessengerPanel } from './MessengerPanel';
import { mergeMessages, formatTeamTime, handoffCard, type PanelMessage } from './panel-state';
import type { PublicMessengerPayload } from '@/lib/messenger/public-api';

/* v16 phase zero items 6, 7 and 8, as the shopper sees them. */

const CONFIG = {
  v: 3,
  key: 'gc_test_key',
  storeName: 'Maison',
  active: true,
  available: true,
  aiEnabled: true,
  attachmentsEnabled: false,
  features: [],
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

const BOOTSTRAP = { anonymousId: 'anon12345678', conversationId: 'b3c9d1e2-1111-4222-8333-444455556666', status: 'open', messages: [] };

type Handler = (url: string, body: Record<string, unknown>) => { status?: number; body: unknown } | Promise<{ status?: number; body: unknown }>;
let handlers: Record<string, Handler>;
let sent: Array<Record<string, unknown>>;
let fetchMock: ReturnType<typeof vi.fn>;

function json(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) } as unknown as Response;
}

beforeEach(() => {
  sent = [];
  handlers = {
    bootstrap: () => ({ body: BOOTSTRAP }),
    sync: () => ({ body: { status: 'open', messages: [] } }),
  };
  fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
    const route = url.match(/\/api\/messenger\/(\w+)/)?.[1] ?? '';
    if (route === 'send') sent.push(body);
    const handler = handlers[route];
    if (!handler) throw new Error(`unexpected ${url}`);
    const answer = await handler(url, body);
    return json(answer.body, answer.status);
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function boot(config: PublicMessengerPayload = CONFIG, locale: 'en' | 'ar' = 'en') {
  render(<MessengerPanel config={config} originToken="tok" locale={locale} />);
  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  await act(async () => {
    await Promise.resolve();
  });
}

async function type(text: string) {
  const box = await screen.findByRole('textbox');
  fireEvent.change(box, { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: /send message|إرسال الرسالة/i }));
}

function userMessage(body: Record<string, unknown>, id = `u-${sent.length}`) {
  return { id, role: 'user', content: body.text, createdAt: new Date().toISOString() };
}

describe('item 6: the card follows whether someone was really alerted', () => {
  it('says the team has the message only after an alert went out', async () => {
    handlers.send = (_url, body) => ({
      body: {
        userMessage: userMessage(body),
        reply: { id: 's1', role: 'system', content: 'Sent to the team.', createdAt: new Date().toISOString(), author: 'system' },
        status: 'handoff_requested',
        alert: { status: 'sent', channels: ['email'], at: '2026-10-16T12:00:00Z', afterHours: false },
      },
    });
    await boot();
    await type('a person please');

    expect(await screen.findByText('The team has your message')).toBeInTheDocument();
    expect(screen.getByText('You will see the reply here.')).toBeInTheDocument();
  });

  it('says only that the message is saved when nobody was alerted, until a retry gets through', async () => {
    handlers.send = (_url, body) => ({
      body: {
        userMessage: userMessage(body),
        reply: null,
        status: 'handoff_requested',
        alert: { status: 'pending', channels: [], at: '2026-10-16T12:00:00Z', afterHours: false },
      },
    });
    await boot();
    await type('a person please');

    expect(await screen.findByText('Your message is saved for the team')).toBeInTheDocument();
    expect(screen.queryByText('The team has your message')).not.toBeInTheDocument();
  });
});

describe('item 7: after hours with n23_after_hours on', () => {
  const AFTER_HOURS = {
    ...CONFIG,
    features: ['n23_after_hours'],
    team: { open: false, opensAt: '10:00', closesAt: null, timezone: 'Africa/Cairo' },
  } as unknown as PublicMessengerPayload;

  it('says the assistant answers now and when the team is back', async () => {
    await boot(AFTER_HOURS);
    expect(screen.getByText('Assistant answers now · team away until 10 am')).toBeInTheDocument();
  });

  it('says the same in Arabic', async () => {
    await boot(AFTER_HOURS, 'ar');
    expect(screen.getByText('المساعد يرد الآن · الفريق غير متاح حتى 10 صباحاً')).toBeInTheDocument();
  });

  it('a request for a person at night names the time the team is back, in the store\'s city', async () => {
    handlers.send = (_url, body) => ({
      body: {
        userMessage: userMessage(body),
        reply: null,
        status: 'handoff_requested',
        alert: { status: 'pending', channels: [], at: '2026-10-16T21:00:00Z', afterHours: true },
      },
    });
    await boot(AFTER_HOURS);
    await type('I need a person');

    expect(await screen.findByText('The team is away until 10 am Cairo time')).toBeInTheDocument();
    expect(screen.getByText('While you wait, I can still help with anything else.')).toBeInTheDocument();
  });

  it('keeps today\'s header with the flag off', async () => {
    await boot();
    expect(screen.getByText('Assistant may reply automatically')).toBeInTheDocument();
  });
});

describe('item 8: when the assistant is down, and retries', () => {
  it('marks the message saved and sends it to the team in one tap (N24)', async () => {
    handlers.send = (_url, body) => ({
      body: { userMessage: userMessage(body, 'u-saved'), reply: null, saved: true, assistant: 'unavailable', status: 'open' },
    });
    handlers.handoff = () => ({
      body: {
        ok: true,
        status: 'handoff_requested',
        alert: { status: 'sent', channels: ['email'], at: '2026-10-16T12:00:00Z', afterHours: false },
        line: { id: 's2', role: 'system', content: 'Sent to the team.', createdAt: new Date().toISOString(), author: 'system' },
      },
    });
    await boot();
    await type('Do you ship to Jeddah?');

    expect(await screen.findByText('Saved')).toBeInTheDocument();
    expect(screen.getByText('The assistant can’t answer right now')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Send it to the team' }));

    expect(await screen.findByText('The team has your message')).toBeInTheDocument();
    expect(screen.queryByText('The assistant can’t answer right now')).not.toBeInTheDocument();
    const handoffCall = fetchMock.mock.calls.find(([url]) => String(url).includes('/api/messenger/handoff'));
    expect(JSON.parse(String((handoffCall?.[1] as RequestInit).body))).toMatchObject({ reason: 'assistant_unavailable' });
  });

  it('retries with the same key, so the server stores and answers it once', async () => {
    let first = true;
    handlers.send = (_url, body) => {
      if (first) {
        first = false;
        return { status: 502, body: { error: 'ai_unavailable' } };
      }
      return { body: { userMessage: userMessage(body), reply: null, status: 'open' } };
    };
    await boot();
    await type('Is it lined?');

    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(sent).toHaveLength(2));
    expect(sent[1].clientKey).toBe(sent[0].clientKey);
    await waitFor(() => expect(screen.queryByText('Message not sent.')).not.toBeInTheDocument());
    expect(screen.getAllByText('Is it lined?')).toHaveLength(1);
  });

  it('queues two messages offline and sends them in order, with their keys, once back online', async () => {
    let online = false;
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => online });
    handlers.send = (_url, body) => ({ body: { userMessage: userMessage(body), reply: null, status: 'open' } });
    await boot();

    await type('Is the Zahra abaya lined?');
    await type('And does it come in olive?');
    expect(await screen.findAllByText('Waiting to send')).toHaveLength(2);
    expect(screen.getByText('You’re offline. We’ll send it when you’re back.')).toBeInTheDocument();
    expect(sent).toHaveLength(0);

    online = true;
    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => expect(sent).toHaveLength(2));
    expect(sent.map((body) => body.text)).toEqual(['Is the Zahra abaya lined?', 'And does it come in olive?']);
    expect(new Set(sent.map((body) => body.clientKey)).size).toBe(2);
    await waitFor(() => expect(screen.queryByText('Waiting to send')).not.toBeInTheDocument());
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => true });
  });
});

describe('panel state helpers', () => {
  const at = new Date().toISOString();
  it('keeps unsent messages when a staff reply arrives through sync', () => {
    const shown: PanelMessage[] = [
      { id: 'a', role: 'assistant', content: 'hi', createdAt: at },
      { id: 'pending-1', role: 'user', content: 'still sending', createdAt: at, pending: true },
      { id: 'pending-2', role: 'user', content: 'offline', createdAt: at, queued: true },
    ];
    const merged = mergeMessages(shown, [{ id: 'staff', role: 'assistant', content: 'A person here', createdAt: at }]);
    expect(merged.map((m) => m.id)).toEqual(['a', 'staff', 'pending-1', 'pending-2']);
    expect(mergeMessages(merged, [{ id: 'staff', role: 'assistant', content: 'A person here', createdAt: at }])).toBe(merged);
  });

  it('formats the team\'s time the way shoppers read it', () => {
    expect(formatTeamTime('10:00', 'en')).toBe('10 am');
    expect(formatTeamTime('22:30', 'en')).toBe('10:30 pm');
    expect(formatTeamTime('00:00', 'en')).toBe('12 am');
    expect(formatTeamTime('22:00', 'ar')).toBe('10 مساءً');
  });

  it('shows the alerted card only for a sent alert', () => {
    expect(handoffCard({ status: 'sent', afterHours: false }, null)).toEqual({ kind: 'alerted' });
    expect(handoffCard({ status: 'none', afterHours: false }, null)).toEqual({ kind: 'saved' });
    expect(handoffCard(null, null)).toEqual({ kind: 'saved' });
    expect(handoffCard({ status: 'pending', afterHours: true }, { open: false, opensAt: '10:00', closesAt: null, timezone: 'Asia/Riyadh' })).toEqual({
      kind: 'after_hours',
      opensAt: '10:00',
      timezone: 'Asia/Riyadh',
    });
  });
});
