import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MessengerPanel } from './MessengerPanel';
import type { PublicMessengerPayload } from '@/lib/messenger/public-api';

/* Chat-States on the v16 panel (03-store-chat.md): the team really
   alerted, after hours, the assistant down. Each card asks where the team
   should reply when the store takes an address, and the reply time shows
   only when it is measured and the team is in. */

const OPEN_TEAM = { open: true, opensAt: null, closesAt: '22:00', timezone: 'Africa/Cairo', replyMinutes: 10, opensAtIso: null };

const CONFIG = {
  v: 3,
  key: 'gc_test_key',
  storeName: 'Maison Noor',
  active: true,
  available: true,
  aiEnabled: true,
  attachmentsEnabled: false,
  features: ['v16_chat'],
  contactCapture: true,
  team: OPEN_TEAM,
  appearance: {
    accentColor: '#2a2826',
    launcherIcon: 'chat',
    launcherCustomIconUrl: null,
    launcherLabel: { en: 'Chat', ar: 'محادثة' },
    launcherSizePx: 56,
    position: 'bottom-right',
    radiusStyle: 'soft',
    themeMode: 'light',
    assistantAvatarUrl: null,
  },
  behaviour: {
    welcomeTitle: { en: 'Welcome', ar: 'أهلاً' },
    welcomeSubtitle: { en: 'Ask us', ar: 'اسألنا' },
    inputPlaceholder: { en: 'Ask anything…', ar: 'اسأل' },
  },
} as unknown as PublicMessengerPayload;

type Answer = Record<string, unknown>;
let sendAnswer: Answer;
let handoffAnswer: Answer;
let contactOk = true;
let bootAnswer: Answer;
let calls: Array<{ url: string; body: Record<string, unknown> | null }> = [];
let host: HTMLIFrameElement;
const realParent = Object.getOwnPropertyDescriptor(window, 'parent');

const userMessage = { id: 'u1', role: 'user', content: 'I want to talk to a person.', createdAt: new Date().toISOString() };
const sentAlert = { status: 'sent', channels: ['email'], at: new Date().toISOString(), afterHours: false };

beforeEach(() => {
  calls = [];
  contactOk = true;
  bootAnswer = {};
  sendAnswer = { userMessage, reply: null, status: 'open' };
  handoffAnswer = { ok: true, status: 'handoff_requested', alert: sentAlert };
  localStorage.clear();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, body: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null });
      const body = url.includes('bootstrap')
        ? {
            anonymousId: 'anon12345678',
            conversationId: 'b3c9d1e2-1111-4222-8333-444455556666',
            status: 'open',
            messages: [],
            ...bootAnswer,
          }
        : url.includes('/send')
          ? sendAnswer
          : url.includes('/handoff')
            ? handoffAnswer
            : url.includes('/contact')
              ? { ok: contactOk }
              : { status: 'open', messages: [] };
      const ok = !url.includes('/contact') || contactOk;
      return { ok, status: ok ? 200 : 400, json: () => Promise.resolve(body) } as unknown as Response;
    }),
  );
  host = document.createElement('iframe');
  document.body.appendChild(host);
  Object.defineProperty(window, 'parent', { value: host.contentWindow!, configurable: true });
});

afterEach(() => {
  if (realParent) Object.defineProperty(window, 'parent', realParent);
  host.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function bootAndAskForPerson(config: PublicMessengerPayload = CONFIG) {
  render(<MessengerPanel config={config} originToken="tok" locale="en" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Talk to a person' }));
  await waitFor(() => expect(calls.some((c) => c.url.includes('/send'))).toBe(true));
  await act(async () => {
    await Promise.resolve();
  });
}

function card(name: RegExp) {
  const found = screen.queryAllByRole('status').find((el) => name.test(el.textContent ?? ''));
  if (!found) throw new Error(`no card matching ${name}`);
  return found;
}

describe('Chat-States: the team was really alerted', () => {
  it('says the team has the message, the measured reply time, and asks where to reply', async () => {
    sendAnswer = { userMessage, reply: null, status: 'handoff_requested', alert: sentAlert, askContact: true };
    await bootAndAskForPerson();
    const alerted = await waitFor(() => card(/The team has your message/));
    expect(alerted).toHaveTextContent('The team usually replies in about 10 minutes. You will see the reply here.');
    expect(within(alerted).getByText('If you leave, where should they reply?')).toBeInTheDocument();
    // Inside opening hours the assistant stops once the team has it, so
    // nothing here says it can still help.
    expect(screen.queryByText(/I can still help/)).toBeNull();

    fireEvent.change(within(alerted).getByLabelText('Your email address'), { target: { value: 'Salma.A@gmail.com' } });
    fireEvent.click(within(alerted).getByRole('button', { name: 'Send to the team' }));
    await waitFor(() => expect(within(alerted).getByText('salma.a@gmail.com')).toBeInTheDocument());
    const contact = calls.find((c) => c.url.includes('/contact'));
    expect(contact?.body).toMatchObject({ email: 'Salma.A@gmail.com', key: 'gc_test_key' });
    expect(within(alerted).getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    // The old block below the thread does not ask a second time.
    expect(screen.queryByText('Where should we reply?')).toBeNull();
  });

  it('drops the reply time when it is not measured, and shows an address already given with Edit', async () => {
    bootAnswer = { contactEmail: 'salma.a@gmail.com' };
    sendAnswer = { userMessage, reply: null, status: 'handoff_requested', alert: sentAlert };
    await bootAndAskForPerson({ ...CONFIG, team: { ...OPEN_TEAM, replyMinutes: null } } as PublicMessengerPayload);
    const alerted = await waitFor(() => card(/The team has your message/));
    expect(alerted).toHaveTextContent(/^The team has your messageYou will see the reply here\./);
    expect(within(alerted).getByText('salma.a@gmail.com')).toBeInTheDocument();
    fireEvent.click(within(alerted).getByRole('button', { name: 'Edit' }));
    expect(within(alerted).getByLabelText('Your email address')).toHaveValue('salma.a@gmail.com');
  });

  it('asks nothing where the store takes no address', async () => {
    sendAnswer = { userMessage, reply: null, status: 'handoff_requested', alert: sentAlert, askContact: true };
    await bootAndAskForPerson({ ...CONFIG, contactCapture: false } as PublicMessengerPayload);
    const alerted = await waitFor(() => card(/The team has your message/));
    expect(within(alerted).queryByLabelText('Your email address')).toBeNull();
  });

  it('keeps an invalid address in the field with the reason', async () => {
    sendAnswer = { userMessage, reply: null, status: 'handoff_requested', alert: sentAlert, askContact: true };
    await bootAndAskForPerson();
    const alerted = await waitFor(() => card(/The team has your message/));
    fireEvent.change(within(alerted).getByLabelText('Your email address'), { target: { value: 'salma@' } });
    fireEvent.click(within(alerted).getByRole('button', { name: 'Send to the team' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Please enter a valid email address.');
    expect(calls.some((c) => c.url.includes('/contact'))).toBe(false);
  });
});

describe('Chat-States: after hours, nobody pretends to be there', () => {
  const closedTeam = {
    open: false,
    opensAt: '10:00',
    closesAt: null,
    timezone: 'Africa/Cairo',
    replyMinutes: 10,
    opensAtIso: new Date(Date.now() + 24 * 3_600_000).toISOString(),
  };
  const pending = { status: 'pending', channels: [], at: new Date().toISOString(), afterHours: true };

  it('says when the team is back, asks where to reply, and promises no reply time', async () => {
    sendAnswer = { userMessage, reply: null, status: 'handoff_requested', alert: pending, askContact: true };
    await bootAndAskForPerson({ ...CONFIG, available: false, team: closedTeam } as PublicMessengerPayload);
    const away = await waitFor(() => card(/The team is away until 10 am/));
    expect(away).toHaveTextContent('Tell us where to reply and they will answer first thing tomorrow.');
    expect(away).not.toHaveTextContent(/usually replies/);
    expect(within(away).getByLabelText('Your email address')).toBeInTheDocument();
    expect(within(away).getByRole('button', { name: 'Send to the team' })).toBeInTheDocument();
    // Without n23 the assistant is off after hours too, so it offers nothing.
    expect(screen.queryByText(/I can still help/)).toBeNull();
  });

  it('says "when they are back" when the team is not back tomorrow', async () => {
    sendAnswer = { userMessage, reply: null, status: 'handoff_requested', alert: pending, askContact: true };
    const afterWeekend = { ...closedTeam, opensAtIso: new Date(Date.now() + 3 * 24 * 3_600_000).toISOString() };
    await bootAndAskForPerson({ ...CONFIG, available: false, team: afterWeekend } as PublicMessengerPayload);
    const away = await waitFor(() => card(/The team is away until 10 am/));
    expect(away).toHaveTextContent('Tell us where to reply and they will answer when they are back.');
  });

  it('offers more help only where the assistant really answers after hours (n23)', async () => {
    sendAnswer = { userMessage, reply: null, status: 'handoff_requested', alert: pending };
    await bootAndAskForPerson({
      ...CONFIG,
      available: false,
      features: ['v16_chat', 'n23_after_hours'],
      team: closedTeam,
    } as PublicMessengerPayload);
    await waitFor(() => card(/The team is away until 10 am/));
    expect(screen.getByText('While you wait, I can still help with anything else.')).toBeInTheDocument();
  });
});

describe('Chat-States: the assistant is down, the message is safe', () => {
  it('marks the message saved, drops the assistant from the header, and sends it to the team on a tap', async () => {
    sendAnswer = {
      userMessage: { ...userMessage, content: 'Do you ship to Jeddah?' },
      reply: null,
      status: 'open',
      saved: true,
      assistant: 'unavailable',
    };
    handoffAnswer = {
      ok: true,
      status: 'handoff_requested',
      alert: sentAlert,
      askContact: true,
      line: { id: 's1', role: 'system', content: 'Your message is with the team.', createdAt: new Date().toISOString(), author: 'system' },
    };
    render(<MessengerPanel config={CONFIG} originToken="tok" locale="en" />);
    const composer = await screen.findByRole('textbox');
    fireEvent.change(composer, { target: { value: 'Do you ship to Jeddah?' } });
    fireEvent.keyDown(composer, { key: 'Enter' });

    const down = await waitFor(() => card(/The assistant can’t answer right now/));
    expect(down).toHaveTextContent(
      'Your message is saved. Send it to the team and they reply here. The team usually replies in about 10 minutes.',
    );
    // "Saved" sits under the shopper's own message, outside the bubble.
    const saved = screen.getByText('Saved');
    expect(saved.closest('div.max-w-\\[85\\%\\]')).toBeNull();
    // Only the team half of the header stays while the assistant is down.
    expect(screen.getByText('Team here until 10 pm')).toBeInTheDocument();
    expect(screen.queryByText(/Assistant answers now/)).toBeNull();

    fireEvent.click(within(down).getByRole('button', { name: 'Send it to the team' }));
    const alerted = await waitFor(() => card(/The team has your message/));
    expect(calls.find((c) => c.url.includes('/handoff'))?.body).toMatchObject({ reason: 'assistant_unavailable' });
    expect(within(alerted).getByLabelText('Your email address')).toBeInTheDocument();
    expect(screen.queryByText(/The assistant can’t answer right now/)).toBeNull();
  });
});

describe('Chat-States for a store without v16_chat', () => {
  it('keeps today’s cards', async () => {
    sendAnswer = { userMessage, reply: null, status: 'handoff_requested', alert: sentAlert, askContact: true };
    render(<MessengerPanel config={{ ...CONFIG, features: [] } as PublicMessengerPayload} originToken="tok" locale="en" />);
    const composer = await screen.findByRole('textbox');
    fireEvent.change(composer, { target: { value: 'I want to talk to a person.' } });
    fireEvent.keyDown(composer, { key: 'Enter' });
    await waitFor(() => expect(screen.getByText('The team has your message')).toBeInTheDocument());
    expect(screen.getByText('Where should we reply?')).toBeInTheDocument();
    expect(screen.queryByText('If you leave, where should they reply?')).toBeNull();
  });
});
