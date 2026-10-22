// @vitest-environment node
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  limit: vi.fn(),
  session: vi.fn(),
  flags: vi.fn(),
  escalate: vi.fn(),
  append: vi.fn(),
  event: vi.fn(),
  patch: vi.fn(),
}));

vi.mock('@/lib/ratelimit', () => ({
  publicApiRatelimit: { limit: mocks.limit },
  clientIp: () => '203.0.113.7',
}));
vi.mock('@/lib/messenger/public-session', () => ({ resolveShopperSession: mocks.session }));
vi.mock('@/lib/flags/store-flags', async (original) => ({
  ...(await original<typeof import('@/lib/flags/store-flags')>()),
  storeFlags: mocks.flags,
}));
vi.mock('@/lib/messenger/escalate', () => ({ escalateAndNotify: mocks.escalate }));
vi.mock('@/lib/messenger/conversations', () => ({
  appendMessage: mocks.append,
  recordEvent: mocks.event,
  patchConversationMetadata: mocks.patch,
}));

import { POST } from './route';
import { resolveMessengerConfig } from '@/lib/messenger/config';

const SITE = { id: 'site-1', name: 'Maison', workspace_id: 'ws-1', domain: 'maison.myshopify.com', config: resolveMessengerConfig({}) };
const CONVERSATION = { id: 'conv-1', status: 'open', metadata: {} };
const BODY = { key: 'gc_test_key', anonymousId: 'anon12345678', conversationId: 'conv-1', reason: 'assistant_unavailable', locale: 'en' };

function post(body: Record<string, unknown> = BODY) {
  return POST(new NextRequest('http://localhost/api/messenger/handoff', { method: 'POST', body: JSON.stringify(body) }));
}

describe('POST /api/messenger/handoff (N24)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.limit.mockResolvedValue({ success: true, reset: Date.now() + 10_000 });
    mocks.session.mockResolvedValue({ ok: true, site: SITE, visitor: { id: 'v1' }, conversation: CONVERSATION });
    mocks.flags.mockResolvedValue(['n24_assistant_down']);
    mocks.event.mockResolvedValue(undefined);
    mocks.patch.mockResolvedValue(undefined);
    mocks.append.mockImplementation(async (input: { content: string }) => ({
      message: { id: 's1', role: 'system', content: input.content, created_at: '2026-10-16T12:00:00Z' },
    }));
    mocks.escalate.mockResolvedValue({
      conversation: { ...CONVERSATION, status: 'handoff_requested' },
      alert: { status: 'sent', reason: null, channels: ['email'], at: '2026-10-16T12:00:00Z', attempts: 1 },
    });
  });

  it('answers 404 not_enabled while the store\'s flag is off', async () => {
    mocks.flags.mockResolvedValue([]);
    const res = await post();
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, error: 'not_enabled' });
    expect(mocks.escalate).not.toHaveBeenCalled();
  });

  it('sends the saved message to the team and says whether someone was alerted', async () => {
    const res = await post();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(mocks.escalate).toHaveBeenCalledWith('conv-1', 'assistant_unavailable', expect.any(String), expect.objectContaining({ id: 'site-1' }), {});
    expect(data).toMatchObject({ ok: true, status: 'handoff_requested', alert: { status: 'sent', afterHours: false } });
    expect(data.line.content).toBe('Sent to the team.');
  });

  it('asks where the team should reply, once, as a handoff from the send route does (Chat-States)', async () => {
    const data = await (await post()).json();
    expect(data.askContact).toBe(true);
    expect(mocks.patch).toHaveBeenCalledWith('conv-1', { contact_prompted_at: expect.any(String) });
  });

  it('does not ask when the address is known or was already asked for', async () => {
    mocks.session.mockResolvedValue({
      ok: true,
      site: SITE,
      visitor: { id: 'v1', user_email: 'salma.a@gmail.com' },
      conversation: CONVERSATION,
    });
    expect((await (await post()).json()).askContact).toBeUndefined();
    mocks.session.mockResolvedValue({
      ok: true,
      site: SITE,
      visitor: { id: 'v1', user_email: null },
      conversation: { ...CONVERSATION, metadata: { contact_prompted_at: '2026-10-16T11:00:00Z' } },
    });
    expect((await (await post()).json()).askContact).toBeUndefined();
    expect(mocks.patch).not.toHaveBeenCalled();
  });

  it('does not ask where the store takes no address', async () => {
    const off = { ...SITE, config: resolveMessengerConfig({ messenger_contact_capture: { enabled: false } }) };
    mocks.session.mockResolvedValue({ ok: true, site: off, visitor: { id: 'v1', user_email: null }, conversation: CONVERSATION });
    expect((await (await post()).json()).askContact).toBeUndefined();
  });

  it('does not hand off twice', async () => {
    mocks.session.mockResolvedValue({ ok: true, site: SITE, visitor: { id: 'v1' }, conversation: { ...CONVERSATION, status: 'handoff_requested' } });
    const data = await (await post()).json();
    expect(data).toMatchObject({ ok: true, status: 'handoff_requested', alert: null });
    expect(mocks.escalate).not.toHaveBeenCalled();
  });

  it('refuses a request without the shopper session, or for another reason', async () => {
    mocks.session.mockResolvedValue({ ok: false, code: 'bad_session', status: 400 });
    expect((await post()).status).toBe(400);
    expect((await post({ ...BODY, reason: 'anything' })).status).toBe(400);
    expect(mocks.escalate).not.toHaveBeenCalled();
  });
});
