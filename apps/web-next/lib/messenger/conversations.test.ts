// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { setMessengerServiceClientForTests } from './db';
import {
  appendMessage,
  claimHandoffNotification,
  countAwaitingHandoff,
  getWidgetLastSeenAt,
  isStaffTyping,
  listConversationsForSite,
  listMessages,
  pingStaffTyping,
  recordEvent,
  resolveAssigneeNames,
  returnConversationToAi,
  setMessageFeedback,
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
      maybeSingle: (...args: unknown[]) => {
        calls.push(['maybeSingle', args]);
        return Promise.resolve(result);
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

/* Regression: handoff_notified_at is set once by claimHandoffNotification
   and nothing ever cleared it, so a conversation returned to the AI and then
   re-escalated found the claim permanently burned — requestHandoff would
   succeed, but claimHandoffNotification would report "already claimed" and
   the merchant would never hear about the second handoff. Returning to the
   AI must reset the claim so a later escalation gets its own alert. */
describe('returnConversationToAi', () => {
  it('resets handoff_notified_at so a later re-escalation can notify again', async () => {
    const { client, calls } = stubQueryClient({ data: [{ id: 'conv-1', status: 'open' }], error: null });
    setMessengerServiceClientForTests(client);

    await returnConversationToAi('conv-1');

    const updateCall = calls.find(([method]) => method === 'update');
    expect(updateCall?.[1][0]).toMatchObject({ handoff_notified_at: null });
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

/* Internal staff notes share the widget_messages table (role 'system',
   metadata.internal). They must never reach the shopper widget or the AI's
   generation history, so listMessages excludes them unless a moderator-facing
   caller explicitly opts in with includeInternal. */
describe('listMessages internal notes', () => {
  const rows = [
    { id: 'm-user', conversation_id: 'conv-1', role: 'user', content: 'hi', content_type: 'text', created_at: '2026-08-30T10:00:00.000Z', metadata: {} },
    { id: 'm-handoff', conversation_id: 'conv-1', role: 'system', content: 'handoff', content_type: 'event', created_at: '2026-08-30T10:01:00.000Z', metadata: { author: 'system', escalated: true } },
    { id: 'm-note', conversation_id: 'conv-1', role: 'system', content: 'VIP — comp shipping', content_type: 'text', created_at: '2026-08-30T10:02:00.000Z', metadata: { internal: true, noteAuthorProfileId: 'p-1' } },
  ];

  it('excludes internal-flagged messages by default, but keeps ordinary system rows', async () => {
    const { client } = stubQueryClient({ data: rows, error: null });
    setMessengerServiceClientForTests(client);

    const messages = await listMessages('conv-1');

    expect(messages.map((m) => m.id)).toEqual(['m-user', 'm-handoff']);
  });

  it('includes internal-flagged messages when includeInternal is true', async () => {
    const { client } = stubQueryClient({ data: rows, error: null });
    setMessengerServiceClientForTests(client);

    const messages = await listMessages('conv-1', { includeInternal: true });

    expect(messages.map((m) => m.id)).toEqual(['m-user', 'm-handoff', 'm-note']);
  });
});

/** Minimal two-table stub: widget_messages for the insert(+select+single)
 *  appendMessage itself issues, widget_conversations for the update
 *  touchConversation issues — distinguished by the table name from() is
 *  called with, since the two calls have unrelated shapes. */
function stubAppendMessageClient(insertedRow: Record<string, unknown>) {
  const conversationUpdates: Array<Record<string, unknown>> = [];
  const client = {
    from: (table: string) => {
      if (table === 'widget_conversations') {
        return {
          update: (patch: Record<string, unknown>) => {
            conversationUpdates.push(patch);
            return { eq: () => Promise.resolve({ error: null }) };
          },
        };
      }
      return {
        insert: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: insertedRow, error: null }),
          }),
        }),
      };
    },
  } as unknown as SupabaseClient;
  return { client, conversationUpdates };
}

/* A note is metadata about the conversation, not a turn in it. Bumping
   last_message_at the same way a real reply does would push a ticket a
   staff member merely annotated to the top of the recency-sorted inbox,
   ahead of conversations with real, older, still-unanswered shopper
   messages — see conversations-panel.tsx's list ordering. */
describe('appendMessage conversation ordering', () => {
  const baseRow = {
    id: 'm-1',
    conversation_id: 'conv-1',
    role: 'system',
    content_type: 'text',
    created_at: '2026-09-12T00:00:00.000Z',
  };

  it('does not touch last_message_at for an internal note', async () => {
    const { client, conversationUpdates } = stubAppendMessageClient({
      ...baseRow,
      content: 'VIP — comp shipping',
      metadata: { internal: true, noteAuthorProfileId: 'p-1' },
    });
    setMessengerServiceClientForTests(client);

    await appendMessage({
      conversationId: 'conv-1',
      role: 'system',
      content: 'VIP — comp shipping',
      metadata: { internal: true, noteAuthorProfileId: 'p-1' },
    });

    expect(conversationUpdates).toHaveLength(0);
  });

  it('still touches last_message_at for an ordinary message', async () => {
    const { client, conversationUpdates } = stubAppendMessageClient({
      ...baseRow,
      role: 'user',
      content: 'Where is my order?',
      metadata: {},
    });
    setMessengerServiceClientForTests(client);

    await appendMessage({ conversationId: 'conv-1', role: 'user', content: 'Where is my order?' });

    expect(conversationUpdates).toHaveLength(1);
    expect(conversationUpdates[0]).toHaveProperty('last_message_at');
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

/* The moderator inbox shows who each taken-over conversation is assigned
   to. Assignment itself already works (takeOverConversation writes
   assigned_profile_id); this only resolves those ids to display names,
   scoped to the workspace so one store's staff never leak into another's. */
describe('resolveAssigneeNames', () => {
  it('returns {} without querying when there is nothing to resolve', async () => {
    const client = {
      from: () => {
        throw new Error('must not query for an empty id list');
      },
    } as unknown as SupabaseClient;
    setMessengerServiceClientForTests(client);

    await expect(resolveAssigneeNames('ws-1', [])).resolves.toEqual({});
    await expect(resolveAssigneeNames('ws-1', [null, undefined])).resolves.toEqual({});
  });

  it('scopes the lookup to the workspace and builds names from first+last name', async () => {
    const { client, calls } = stubQueryClient({
      data: [
        { profile_id: 'p-1', profiles: { first_name: 'Sara', last_name: 'Khan', email: 'sara@example.com' } },
      ],
      error: null,
    });
    setMessengerServiceClientForTests(client);

    await expect(resolveAssigneeNames('ws-1', ['p-1', 'p-1', null])).resolves.toEqual({
      'p-1': 'Sara Khan',
    });
    expect(calls).toContainEqual(['eq', ['workspace_id', 'ws-1']]);
    // Deduped before the query goes out.
    expect(calls).toContainEqual(['in', ['profile_id', ['p-1']]]);
  });

  it('falls back to email when names are blank', async () => {
    const { client } = stubQueryClient({
      data: [
        { profile_id: 'p-2', profiles: { first_name: '  ', last_name: null, email: '  sara@example.com ' } },
      ],
      error: null,
    });
    setMessengerServiceClientForTests(client);

    await expect(resolveAssigneeNames('ws-1', ['p-2'])).resolves.toEqual({ 'p-2': 'sara@example.com' });
  });

  it('omits the entry rather than inventing an unlocalized placeholder when nothing is set', async () => {
    const { client } = stubQueryClient({
      data: [
        { profile_id: 'p-3', profiles: { first_name: null, last_name: null, email: null } },
        { profile_id: 'p-4', profiles: null },
      ],
      error: null,
    });
    setMessengerServiceClientForTests(client);

    const names = await resolveAssigneeNames('ws-1', ['p-3', 'p-4']);
    expect(names).toEqual({});
  });

  it('returns {} rather than throwing when the lookup fails — names must never take the inbox down', async () => {
    const { client } = stubQueryClient({ data: null, error: { message: 'boom' } });
    setMessengerServiceClientForTests(client);

    await expect(resolveAssigneeNames('ws-1', ['p-1'])).resolves.toEqual({});
  });
});

/* Overview asked the wrong system whether the widget was installed. "Has
   Store Chat loaded on your store yet?" was answered by the TRY-ON app's
   install table via listManagedTryOnShops() — a different product's record,
   keyed on the Clerk owner, updated by Try-On activity and OAuth, and
   knowing nothing about whether this widget ever ran. Overview could print
   "One step left — it has not loaded yet" directly above "7 conversations, 4
   open right now", and the embedded Shopify app said it permanently: that
   lookup needs a Clerk session, the iframe has none, so it threw every time
   and detection stayed null forever. */
describe('getWidgetLastSeenAt', () => {
  it('answers from this site\'s own loader events', async () => {
    const { client, calls } = stubQueryClient({
      data: { created_at: '2026-09-03T22:38:38.814Z' },
      error: null,
    });
    setMessengerServiceClientForTests(client);

    const seen = await getWidgetLastSeenAt('site-1');

    expect(seen).toBe('2026-09-03T22:38:38.814Z');
    // Scoped to this site, and to the event the storefront loader emits once
    // it has actually booted on a page.
    expect(calls).toContainEqual(['eq', ['widget_site_id', 'site-1']]);
    expect(calls).toContainEqual(['eq', ['event_name', 'loader_initialized']]);
    expect(calls).toContainEqual(['order', ['created_at', { ascending: false }]]);
  });

  it('reports not-yet-seen when the loader has never run', async () => {
    const { client } = stubQueryClient({ data: null, error: null });
    setMessengerServiceClientForTests(client);

    expect(await getWidgetLastSeenAt('site-1')).toBeNull();
  });

  it('reports not-yet-seen rather than throwing when the lookup fails', async () => {
    // Detection is a status hint; it must never take the dashboard down.
    const { client } = stubQueryClient({ data: null, error: { message: 'boom' } });
    setMessengerServiceClientForTests(client);

    expect(await getWidgetLastSeenAt('site-1')).toBeNull();
  });
});

/* Staff "typing…" presence is a read-modify-write of the metadata blob: the
   timestamp merges in alongside whatever is already there. Clobbering the
   blob here would silently wipe identity, read markers, and contact state —
   so the merge preserving unrelated fields is the assertion that matters. */
describe('pingStaffTyping', () => {
  it('merges the timestamp without clobbering unrelated metadata', async () => {
    const { client, calls } = stubQueryClient({ data: null, error: null });
    setMessengerServiceClientForTests(client);
    const current = {
      identity: { customer_id: 'c-1', email: 'sara@example.com', name: 'Sara', verified: true },
      agent_last_read_at: '2026-09-01T00:00:00.000Z',
      contact_email: 'reply@example.com',
    };

    await pingStaffTyping('conv-1', current);

    const updateCall = calls.find(([method]) => method === 'update');
    const patch = updateCall?.[1][0] as { metadata: Record<string, unknown> };
    expect(patch.metadata).toMatchObject({
      identity: current.identity,
      agent_last_read_at: '2026-09-01T00:00:00.000Z',
      contact_email: 'reply@example.com',
    });
    expect(typeof patch.metadata.staff_typing_at).toBe('string');
    expect(Date.now() - Date.parse(patch.metadata.staff_typing_at as string)).toBeLessThan(5000);
    expect(calls).toContainEqual(['eq', ['id', 'conv-1']]);
  });

  it('throws when the metadata write fails, so a lost ping is never silent success', async () => {
    const { client } = stubQueryClient({ data: null, error: { message: 'db down' } });
    setMessengerServiceClientForTests(client);

    await expect(pingStaffTyping('conv-1', {})).rejects.toThrow('conversation metadata update failed');
  });
});

/* A per-message rating lives in the message's own metadata blob
   (metadata.feedback), next to author/escalated/attachment — which must all
   survive the write untouched, exactly like pingStaffTyping's merge above.
   The write is scoped by id AND conversation_id together, only assistant
   rows are rateable, and a given rating is one-shot (same rating replays
   cleanly, flipping is refused). */
describe('setMessageFeedback', () => {
  function stubMessageFeedbackClient(row: Record<string, unknown> | null) {
    const calls: Array<[string, unknown[]]> = [];
    const updates: Array<Record<string, unknown>> = [];
    function builder(): Record<string, unknown> {
      const b: Record<string, unknown> = {
        select: (...args: unknown[]) => {
          calls.push(['select', args]);
          return b;
        },
        update: (patch: Record<string, unknown>) => {
          calls.push(['update', [patch]]);
          updates.push(patch);
          return b;
        },
        eq: (...args: unknown[]) => {
          calls.push(['eq', args]);
          return b;
        },
        maybeSingle: (...args: unknown[]) => {
          calls.push(['maybeSingle', args]);
          return Promise.resolve({ data: row, error: null });
        },
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({ error: null }).then(resolve),
      };
      return b;
    }
    const client = { from: () => builder() } as unknown as SupabaseClient;
    return { client, calls, updates };
  }

  const assistantRow = (metadata: Record<string, unknown>) => ({
    id: 'm-1',
    role: 'assistant',
    metadata,
  });

  it('merges feedback without clobbering unrelated metadata fields', async () => {
    const { client, calls, updates } = stubMessageFeedbackClient(
      assistantRow({ author: 'ai', escalated: true, attachment: { id: 'a-1', mime: 'image/png', bytes: 42 } }),
    );
    setMessengerServiceClientForTests(client);

    await expect(
      setMessageFeedback({ conversationId: 'conv-1', messageId: 'm-1', rating: 'up' }),
    ).resolves.toBe(true);

    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({
      metadata: {
        author: 'ai',
        escalated: true,
        attachment: { id: 'a-1', mime: 'image/png', bytes: 42 },
        feedback: 'up',
      },
    });
  });

  it('scopes both the read and the write to id AND conversation_id together', async () => {
    const { client, calls } = stubMessageFeedbackClient(assistantRow({ author: 'ai' }));
    setMessengerServiceClientForTests(client);

    await setMessageFeedback({ conversationId: 'conv-1', messageId: 'm-1', rating: 'down' });

    expect(calls).toContainEqual(['eq', ['id', 'm-1']]);
    expect(calls).toContainEqual(['eq', ['conversation_id', 'conv-1']]);
    // One pair for the scoped read, one pair for the scoped write.
    expect(calls.filter(([method]) => method === 'eq')).toHaveLength(4);
  });

  it('no-ops for a non-assistant role without writing anything', async () => {
    const { client, updates } = stubMessageFeedbackClient({
      id: 'm-2',
      role: 'user',
      metadata: {},
    });
    setMessengerServiceClientForTests(client);

    await expect(
      setMessageFeedback({ conversationId: 'conv-1', messageId: 'm-2', rating: 'up' }),
    ).resolves.toBe(false);
    expect(updates).toHaveLength(0);
  });

  it('returns false when no row matches the scoped lookup', async () => {
    const { client, updates } = stubMessageFeedbackClient(null);
    setMessengerServiceClientForTests(client);

    await expect(
      setMessageFeedback({ conversationId: 'conv-1', messageId: 'm-missing', rating: 'up' }),
    ).resolves.toBe(false);
    expect(updates).toHaveLength(0);
  });

  it('replays the same rating idempotently without a second write', async () => {
    const { client, updates } = stubMessageFeedbackClient(assistantRow({ author: 'ai', feedback: 'up' }));
    setMessengerServiceClientForTests(client);

    await expect(
      setMessageFeedback({ conversationId: 'conv-1', messageId: 'm-1', rating: 'up' }),
    ).resolves.toBe(true);
    expect(updates).toHaveLength(0);
  });

  it('refuses to flip an existing rating to the other value', async () => {
    const { client, updates } = stubMessageFeedbackClient(assistantRow({ author: 'ai', feedback: 'up' }));
    setMessengerServiceClientForTests(client);

    await expect(
      setMessageFeedback({ conversationId: 'conv-1', messageId: 'm-1', rating: 'down' }),
    ).resolves.toBe(false);
    expect(updates).toHaveLength(0);
  });
});

/* Freshness is decided on every read, never stored: a recent ping reads
   true, an old or absent one reads false, and no "stopped typing" write is
   needed for the indicator to clear. */
describe('isStaffTyping', () => {
  it('is true for a fresh ping, false when old or absent', () => {
    const now = Date.now();
    expect(isStaffTyping({}, now)).toBe(false);
    expect(isStaffTyping({ staff_typing_at: new Date(now - 2000).toISOString() }, now)).toBe(true);
    expect(isStaffTyping({ staff_typing_at: new Date(now - 30_000).toISOString() }, now)).toBe(false);
  });

  it('rejects unparsable timestamps instead of showing the dots forever', () => {
    expect(isStaffTyping({ staff_typing_at: 'not-a-date' })).toBe(false);
  });

  it('goes stale at the freshness boundary', () => {
    const now = Date.now();
    expect(isStaffTyping({ staff_typing_at: new Date(now - 7999).toISOString() }, now)).toBe(true);
    expect(isStaffTyping({ staff_typing_at: new Date(now - 8001).toISOString() }, now)).toBe(false);
  });
});
