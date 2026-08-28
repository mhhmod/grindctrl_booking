// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { setMessengerServiceClientForTests } from './db';
import { recordEvent } from './conversations';

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
