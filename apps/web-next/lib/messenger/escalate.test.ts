// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { setMessengerServiceClientForTests } from './db';
import { escalateAndNotify } from './escalate';

const mocks = vi.hoisted(() => ({ notify: vi.fn(), visitorLimit: vi.fn(), networkLimit: vi.fn() }));
vi.mock('./notify', () => ({ notifyHandoff: mocks.notify }));
vi.mock('@/lib/ratelimit', () => ({
  handoffAlertVisitorRatelimit: { configured: true, limit: mocks.visitorLimit },
  handoffAlertNetworkRatelimit: { configured: true, limit: mocks.networkLimit },
}));

const SITE = {
  id: 'site-1', name: 'Maison', workspace_id: 'ws-1', locale: 'en' as const,
  notifications: { emailOnHandoff: true, recipients: ['team@example.com'] },
};
const ALERT = { status: 'sent', reason: null, channels: ['email'], at: '2026-10-31T12:00:00Z', attempts: 1 };

// Exercise the real requestHandoff query against a row that changes atomically.
function conversationClient() {
  let row: Record<string, unknown> = { id: 'conv-1', status: 'open', metadata: {} };
  const guards: unknown[] = [];
  const client = {
    from: () => {
      let patch: Record<string, unknown> = {};
      let id: unknown;
      let statuses: string[] = [];
      const query = {
        update(value: Record<string, unknown>) { patch = value; return query; },
        eq(column: string, value: unknown) { if (column === 'id') id = value; return query; },
        in(column: string, values: string[]) { guards.push([column, values]); if (column === 'status') statuses = values; return query; },
        async select() {
          if (row.id !== id || !statuses.includes(String(row.status))) return { data: [], error: null };
          row = { ...row, ...patch };
          return { data: [{ ...row }], error: null };
        },
      };
      return query;
    },
  } as unknown as SupabaseClient;
  setMessengerServiceClientForTests(client);
  return { guards };
}

describe('assistant failure escalation', () => {
  beforeEach(() => {
    mocks.notify.mockReset();
    mocks.notify.mockResolvedValue(ALERT);
  });
  afterEach(() => setMessengerServiceClientForTests(null));

  it.each(['sent', 'pending'])('notifies once per handoff even when the first alert is %s', async (status) => {
    const { guards } = conversationClient();
    mocks.notify.mockResolvedValue({ ...ALERT, status });

    expect(await escalateAndNotify('conv-1', 'assistant_unavailable', 'Assistant unavailable.', SITE)).not.toBeNull();
    expect(await escalateAndNotify('conv-1', 'assistant_unavailable', 'Assistant still unavailable.', SITE)).toBeNull();

    expect(mocks.notify).toHaveBeenCalledOnce();
    expect(guards).toEqual([['status', ['open']], ['status', ['open']]]);
  });

  it('allows only the winning transition to alert during concurrent provider failures', async () => {
    conversationClient();

    const results = await Promise.all(Array.from({ length: 8 }, () =>
      escalateAndNotify('conv-1', 'assistant_unavailable', 'Assistant unavailable.', SITE),
    ));

    expect(results.filter(Boolean)).toHaveLength(1);
    expect(mocks.notify).toHaveBeenCalledOnce();
  });
});

describe('G13: alert caps per visitor and network', () => {
  const visitor = { id: 'visitor-1', network: '2001:db8:1:2::/64' };
  beforeEach(() => {
    mocks.notify.mockReset().mockResolvedValue(ALERT);
    mocks.visitorLimit.mockReset().mockResolvedValue({ success: true, reset: Date.now() + 60_000 });
    mocks.networkLimit.mockReset().mockResolvedValue({ success: true, reset: Date.now() + 60_000 });
  });
  afterEach(() => setMessengerServiceClientForTests(null));

  it('alerts as usual within both caps', async () => {
    conversationClient();
    const escalation = await escalateAndNotify('conv-1', 'shopper_requested_human', 'Wants a person.', SITE, { visitor });
    expect(escalation?.alert.status).toBe('sent');
    expect(mocks.visitorLimit).toHaveBeenCalledWith('site-1:visitor-1');
    expect(mocks.networkLimit).toHaveBeenCalledWith('site-1:2001:db8:1:2::/64');
  });

  it.each([
    ['the visitor', () => mocks.visitorLimit.mockResolvedValue({ success: false, reset: Date.now() + 60_000 })],
    ['the network', () => mocks.networkLimit.mockResolvedValue({ success: false, reset: Date.now() + 60_000 })],
    ['an unavailable limiter', () => mocks.visitorLimit.mockRejectedValue(new Error('redis down'))],
  ])('still hands off past %s cap, leaving the alert for the digest', async (_label, arrange) => {
    arrange();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    conversationClient();
    const escalation = await escalateAndNotify('conv-1', 'shopper_requested_human', 'Wants a person.', SITE, { visitor });
    expect(escalation?.conversation.status).toBe('handoff_requested');
    expect(escalation?.alert).toMatchObject({ status: 'pending', reason: 'throttled', digest: true });
    expect(mocks.notify).not.toHaveBeenCalled();
  });
});
