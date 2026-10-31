// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { setMessengerServiceClientForTests } from './db';
import { escalateAndNotify } from './escalate';

const mocks = vi.hoisted(() => ({ notify: vi.fn() }));
vi.mock('./notify', () => ({ notifyHandoff: mocks.notify }));

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
