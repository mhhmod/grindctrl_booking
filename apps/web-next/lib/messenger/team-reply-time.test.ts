// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { setMessengerServiceClientForTests } from '@/lib/messenger/db';
import {
  MAX_MINUTES,
  MIN_SAMPLES,
  clearTeamReplyTimeCache,
  replySamples,
  teamReplyMinutes,
  typicalReplyMinutes,
} from './team-reply-time';

vi.mock('server-only', () => ({}));

const T0 = Date.parse('2026-10-20T10:00:00Z');
const at = (minutes: number) => new Date(T0 + minutes * 60_000).toISOString();
const sent = (minutes = 0) => ({ handoff_alert: { status: 'sent', at: at(minutes), channels: ['email'], attempts: 1 } });

describe('the team reply time (Chat-States)', () => {
  it('measures from the alert to the first reply a person wrote', () => {
    const samples = replySamples(
      [
        { id: 'a', metadata: sent() },
        { id: 'b', metadata: sent() },
        // Nobody was alerted here, so nothing about it is a reply time.
        { id: 'c', metadata: { handoff_alert: { status: 'none', at: at(0) } } },
        { id: 'd', metadata: null },
      ],
      [
        { conversation_id: 'a', created_at: at(12) },
        { conversation_id: 'a', created_at: at(4) },
        // Written before the alert went out: a reply to something else.
        { conversation_id: 'b', created_at: at(-3) },
        { conversation_id: 'b', created_at: at(9) },
        { conversation_id: 'c', created_at: at(1) },
      ],
    );
    expect(samples.sort((x, y) => x - y)).toEqual([4, 9]);
  });

  it('gives the median only with enough handoffs, and never a slow one', () => {
    expect(typicalReplyMinutes([3, 8, 9])).toBeNull();
    expect(MIN_SAMPLES).toBe(5);
    expect(typicalReplyMinutes([2, 4, 9, 14, 40])).toBe(9);
    expect(typicalReplyMinutes([2, 4, 9, 13, 40, 50])).toBe(11);
    expect(typicalReplyMinutes([0.1, 0.2, 0.2, 0.3, 0.4])).toBe(1);
    expect(typicalReplyMinutes([200, 300, 400, 500, 600])).toBeNull();
    expect(typicalReplyMinutes([MAX_MINUTES, MAX_MINUTES, MAX_MINUTES, MAX_MINUTES, MAX_MINUTES])).toBe(MAX_MINUTES);
  });
});

describe('teamReplyMinutes', () => {
  let restore: () => void = () => {};
  let reads = 0;
  let fail = false;
  beforeEach(() => {
    clearTeamReplyTimeCache();
    reads = 0;
    fail = false;
  });
  afterEach(() => restore());

  function use(conversations: Array<{ id: string; metadata: unknown }>, messages: Array<Record<string, unknown>>) {
    class Query {
      constructor(readonly table: string) {}
      select() { return this; }
      eq() { return this; }
      gte() { return this; }
      not() { return this; }
      in() { return this; }
      order() { return this; }
      limit() { return this; }
      then(resolve: (value: unknown) => unknown) {
        reads += 1;
        if (fail) return Promise.resolve({ data: null, error: { message: 'down' } }).then(resolve);
        return Promise.resolve({
          data: this.table === 'widget_conversations' ? conversations : messages,
          error: null,
        }).then(resolve);
      }
    }
    restore = setMessengerServiceClientForTests({ from: (table: string) => new Query(table) } as unknown as SupabaseClient);
  }

  const five = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, metadata: sent() }));
  const replies = (minutes: number[]) =>
    minutes.map((m, i) => ({ conversation_id: five[i].id, created_at: at(m), metadata: { author: 'human' } }));

  it('reads the store’s recent handoffs and caches the answer', async () => {
    use(five, [
      ...replies([3, 6, 10, 15, 30]),
      // The assistant and a staff note are not the team replying.
      { conversation_id: 'a', created_at: at(1), metadata: { author: 'ai' } },
      { conversation_id: 'b', created_at: at(1), metadata: { author: 'human', internal: true } },
    ]);
    expect(await teamReplyMinutes('site-1', T0)).toBe(10);
    const after = reads;
    expect(await teamReplyMinutes('site-1', T0 + 60_000)).toBe(10);
    expect(reads).toBe(after);
  });

  it('says nothing with too few alerted handoffs, without reading messages', async () => {
    use(five.slice(0, 3), replies([3, 6, 10]));
    expect(await teamReplyMinutes('site-2', T0)).toBeNull();
    expect(reads).toBe(1);
  });

  it('says nothing when the database fails, and asks again next time', async () => {
    use(five, replies([3, 6, 10, 15, 30]));
    fail = true;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await teamReplyMinutes('site-3', T0)).toBeNull();
    fail = false;
    expect(await teamReplyMinutes('site-3', T0)).toBe(10);
  });
});
