// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

const mocks = vi.hoisted(() => ({ notify: vi.fn() }));
vi.mock('./notify', () => ({ notifyHandoff: mocks.notify }));

import { setMessengerServiceClientForTests } from './db';
import { ALERT_MAX_ATTEMPTS, retryPendingAlerts } from './alert-retry';

const NOW = Date.parse('2026-10-16T12:00:00Z');

function row(id: string, alert: Record<string, unknown>) {
  return { id, widget_site_id: 'site-1', handoff_reason: 'shopper_requested_human', handoff_summary: 's', metadata: { handoff_alert: alert } };
}
const pending = (extra: Record<string, unknown> = {}) => ({
  status: 'pending', reason: 'send_failed', channels: [], at: '2026-10-16T11:50:00Z', attempts: 1, ...extra,
});

function fakeClient(rows: Array<ReturnType<typeof row>>) {
  const filters: Array<[string, string, unknown]> = [];
  const client = {
    from(table: string) {
      const builder = {
        select: () => builder,
        eq: (column: string, value: unknown) => { filters.push([table, column, value]); return builder; },
        is: (column: string, value: unknown) => { filters.push([table, `${column} is`, value]); return builder; },
        limit: () => builder,
        maybeSingle: async () => ({ data: { id: 'site-1', name: 'Maison', workspace_id: 'ws-1', settings_json: {} }, error: null }),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(resolve),
      };
      return builder;
    },
  };
  return { client: client as unknown as SupabaseClient, filters };
}

describe('retryPendingAlerts (phase zero items 6 and 7)', () => {
  let restore = () => {};
  beforeEach(() => {
    mocks.notify.mockReset().mockResolvedValue({ status: 'sent', reason: null, channels: ['email'], at: '', attempts: 2 });
  });
  afterEach(() => restore());

  it('asks only for conversations still waiting, never alerted, with a pending alert', async () => {
    const fake = fakeClient([]);
    restore = setMessengerServiceClientForTests(fake.client);
    await retryPendingAlerts(NOW);
    expect(fake.filters).toEqual(
      expect.arrayContaining([
        ['widget_conversations', 'status', 'handoff_requested'],
        ['widget_conversations', 'handoff_notified_at is', null],
        ['widget_conversations', 'metadata->handoff_alert->>status', 'pending'],
      ]),
    );
  });

  it('retries a failed alert through the same notifier and counts what went out', async () => {
    restore = setMessengerServiceClientForTests(fakeClient([row('conv-1', pending())]).client);
    expect(await retryPendingAlerts(NOW)).toEqual({ scanned: 1, retried: 1, sent: 1, stillPending: 0 });
    expect(mocks.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        site: expect.objectContaining({ id: 'site-1', notifications: expect.objectContaining({ emailOnHandoff: true }) }),
        conversation: expect.objectContaining({ id: 'conv-1' }),
      }),
    );
  });

  it('sends an after-hours alert only once the team is due in', async () => {
    const early = row('conv-2', pending({ reason: 'after_hours', attempts: 0, dueAt: '2026-10-16T13:00:00Z' }));
    const due = row('conv-3', pending({ reason: 'after_hours', attempts: 0, dueAt: '2026-10-16T11:59:00Z' }));
    restore = setMessengerServiceClientForTests(fakeClient([early, due]).client);

    await retryPendingAlerts(NOW);

    expect(mocks.notify).toHaveBeenCalledTimes(1);
    expect(mocks.notify.mock.calls[0][0].conversation.id).toBe('conv-3');
  });

  it('gives up after its tries and on handoffs a day old', async () => {
    const tired = row('conv-4', pending({ attempts: ALERT_MAX_ATTEMPTS }));
    const old = row('conv-5', pending({ at: '2026-10-15T11:00:00Z' }));
    restore = setMessengerServiceClientForTests(fakeClient([tired, old]).client);

    expect(await retryPendingAlerts(NOW)).toMatchObject({ scanned: 2, retried: 0 });
    expect(mocks.notify).not.toHaveBeenCalled();
  });
});
