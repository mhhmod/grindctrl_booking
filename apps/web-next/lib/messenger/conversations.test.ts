// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { setMessengerServiceClientForTests } from './db';
import {
  claimHandoffNotification,
  countAwaitingHandoff,
  listConversationsForSite,
  listMessages,
  recordEvent,
} from './conversations';

/* A storefront can hold a conversation id that no longer exists. The event
   must still land, minus the association — losing telemetry precisely for
   the visitors in a broken state is the failure mode worth a test. */

type InsertResult = { error: { code: string; message: string } | null };

function stubClient(results: InsertResult[]) {
  const inserts: Array<Record<string, unknown>> = [];
  const client = {
    from: () => ({
      insert: (row: Record<string, unknown>) => {
        inserts.push(row);
        return Promise.resolve(results[inserts.length - 1] ?? { error: null });
      },
    }),
  } as unknown as SupabaseClient;
  return { client, inserts };
}

/** Generic chainable query stub: every PostgREST-style method records its
 *  call and returns the same builder, and awaiting it at any point resolves
 *  to the configured result — reused across the read paths below (claim,
 *  count, list, order). */
function stubQueryClient(result: Record<string, unknown>) {
  const calls: Array<[string, unknown[]]> = [];
  function builder(): Record<string, unknown> {
    const b: Record<string, unknown> = {
      select: (...args: unknown[]) => {
        calls.push(['select', args]);
        return b;
      },
      update: (...args: unknown[]) => {
        calls.push(['update', args]);
        return b;
      },
      eq: (...args: unknown[]) => {
        calls.push(['eq', args]);
        return b;
      },
      is: (...args: unknown[]) => {
        calls.push(['is', args]);
        return b;
      },
      in: (...args: unknown[]) => {
        calls.push(['in', args]);
        return b;
      },
      order: (...args: unknown[]) => {
        calls.push(['order', args]);
        return b;
      },
      limit: (...args: unknown[]) => {
        calls.push(['limit', args]);
        return b;
      },
      gt: (...args: unknown[]) => {
        calls.push(['gt', args]);
        return b;
      },
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
    };
    return b;
  }
  const client = { from: () => builder() } as unknown as SupabaseClient;
  return { client, calls };
}

afterEach(() => {
  setMessengerServiceClientForTests(null);
  vi.restoreAllMocks();
});

describe('recordEvent', () => {
  it('retries without the conversation id when the FK is stale', async () => {
    const { client, inserts } = stubClient([
      { error: { code: '23503', message: 'widget_events_conversation_id_fkey' } },
      { error: null },
    ]);
    setMessengerServiceClientForTests(client);
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

    await recordEvent({ siteId: 'site-1', conversationId: 'dead-conversation', eventName: 'messenger_opened' });

    expect(inserts).toHaveLength(2);
    expect(inserts[0].conversation_id).toBe('dead-conversation');
    expect(inserts[1].conversation_id).toBeNull();
    expect(inserts[1].event_name).toBe('messenger_opened');
    expect(logged).not.toHaveBeenCalled();
  });

  it('does not retry when the first insert succeeds', async () => {
    const { client, inserts } = stubClient([{ error: null }]);
    setMessengerServiceClientForTests(client);

    await recordEvent({ siteId: 'site-1', conversationId: 'conv-1', eventName: 'messenger_opened' });

    expect(inserts).toHaveLength(1);
  });

  it('does not retry a non-FK failure', async () => {
    const { client, inserts } = stubClient([{ error: { code: '42501', message: 'permission denied' } }]);
    setMessengerServiceClientForTests(client);
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

    await recordEvent({ siteId: 'site-1', conversationId: 'conv-1', eventName: 'messenger_opened' });

    expect(inserts).toHaveLength(1);
    expect(logged).toHaveBeenCalledOnce();
  });
});

/* The notifier's whole atomic-claim design rests on exactly one of two
   concurrent transitions getting `true` from this — the guard is the WHERE
   clause (`.is('handoff_notified_at', null)`), not application logic, so a
   zero-row update result must read as "someone else already claimed it",
   not as an error. */
describe('claimHandoffNotification', () => {
  it('claims and returns true when no one else has', async () => {
    const { client, calls } = stubQueryClient({ data: [{ id: 'conv-1' }], error: null });
    setMessengerServiceClientForTests(client);

    await expect(claimHandoffNotification('conv-1')).resolves.toBe(true);
    expect(calls).toContainEqual(['is', ['handoff_notified_at', null]]);
  });

  it('loses a concurrent claim and returns false, without throwing', async () => {
    const { client } = stubQueryClient({ data: [], error: null });
    setMessengerServiceClientForTests(client);

    await expect(claimHandoffNotification('conv-1')).resolves.toBe(false);
  });

  it('throws on a query error, so a DB failure is never mistaken for "already claimed"', async () => {
    const { client } = stubQueryClient({ data: null, error: { message: 'db down' } });
    setMessengerServiceClientForTests(client);

    await expect(claimHandoffNotification('conv-1')).rejects.toThrow('notification claim failed');
  });
});

describe('countAwaitingHandoff', () => {
  it('returns 0 for an empty site list without querying', async () => {
    const client = {
      from: () => {
        throw new Error('must not query when there are no sites');
      },
    } as unknown as SupabaseClient;
    setMessengerServiceClientForTests(client);

    await expect(countAwaitingHandoff([])).resolves.toBe(0);
  });

  it('returns the count for the given sites', async () => {
    const { client } = stubQueryClient({ count: 4, error: null });
    setMessengerServiceClientForTests(client);

    await expect(countAwaitingHandoff(['site-1', 'site-2'])).resolves.toBe(4);
  });

  it('returns 0 rather than throw when the query errors — a badge must never take the dashboard down', async () => {
    const { client } = stubQueryClient({ count: null, error: { message: 'boom' } });
    setMessengerServiceClientForTests(client);

    await expect(countAwaitingHandoff(['site-1'])).resolves.toBe(0);
  });
});

/* Root-cause test for the notifier's "wrong three messages" bug: plain
   ascending order + limit(6) returns the OLDEST six, not the most recent.
   This pins the fix at the source — the order direction actually sent to
   Postgres — rather than only at the notify.ts call site. */
describe('listMessages newestFirst', () => {
  it('orders ascending by default and descending when newestFirst is set', async () => {
    const { client, calls } = stubQueryClient({ data: [], error: null });
    setMessengerServiceClientForTests(client);

    await listMessages('conv-1');
    await listMessages('conv-1', { newestFirst: true });

    const orderCalls = calls.filter(([method]) => method === 'order').map(([, args]) => args);
    expect(orderCalls[0]).toEqual(['created_at', { ascending: true }]);
    expect(orderCalls[1]).toEqual(['created_at', { ascending: false }]);
  });
});

/* widget_conversations.visitor_id is a single NOT NULL FK, so the
   widget_visitors embed comes back as an object, not an array. Indexing
   [0] into that object (the old code) silently yields undefined, which is
   why every shopper showed up as anonymous in the conversations list. */
describe('listConversationsForSite', () => {
  it('reads visitor_email/visitor_name from the object-shaped widget_visitors embed', async () => {
    const row = {
      id: 'conv-1',
      widget_site_id: 'site-1',
      visitor_id: 'visitor-1',
      status: 'open',
      started_at: '2026-01-01T00:00:00Z',
      last_message_at: null,
      assigned_profile_id: null,
      handoff_reason: null,
      handoff_summary: null,
      handoff_notified_at: null,
      metadata: {},
      widget_visitors: { user_email: 'shopper@example.com', user_name: 'Sara' },
    };
    const { client } = stubQueryClient({ data: [row], error: null });
    setMessengerServiceClientForTests(client);

    const [result] = await listConversationsForSite('site-1');

    expect(result.visitor_email).toBe('shopper@example.com');
    expect(result.visitor_name).toBe('Sara');
  });
});
