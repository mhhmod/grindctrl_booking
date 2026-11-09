// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { setMessengerServiceClientForTests } from './db';
import { TRIAGE_DAILY_LIMIT_PER_CONVERSATION, TRIAGE_DAILY_LIMIT_PER_SITE, triageBudgetRemaining } from './attachments';

/** Counts triaged rows by whichever owner the query filters on. */
function client(counts: { conversation: number; site: number; failOn?: 'conversation' | 'site' }) {
  const fake = {
    from: () => {
      let owner: 'conversation' | 'site' | null = null;
      const query = {
        select: () => query,
        gte: () => query,
        not: () => query,
        eq: (column: string) => {
          owner = column === 'conversation_id' ? 'conversation' : column === 'widget_site_id' ? 'site' : owner;
          return query;
        },
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(
          counts.failOn === owner ? { count: null, error: { message: 'down' } } : { count: owner ? counts[owner] : 0, error: null },
        ).then(resolve),
      };
      return query;
    },
  } as unknown as SupabaseClient;
  setMessengerServiceClientForTests(fake);
}

afterEach(() => setMessengerServiceClientForTests(null));

describe('photo triage budget', () => {
  it('stops one conversation at its daily cap while the store has budget left', async () => {
    client({ conversation: TRIAGE_DAILY_LIMIT_PER_CONVERSATION - 1, site: 0 });
    expect(await triageBudgetRemaining('site-1', 'conv-1')).toBe(true);
    client({ conversation: TRIAGE_DAILY_LIMIT_PER_CONVERSATION, site: 0 });
    expect(await triageBudgetRemaining('site-1', 'conv-1')).toBe(false);
  });

  it('keeps the store-wide daily cap', async () => {
    client({ conversation: 0, site: TRIAGE_DAILY_LIMIT_PER_SITE });
    expect(await triageBudgetRemaining('site-1', 'conv-1')).toBe(false);
  });

  it.each(['conversation', 'site'] as const)('treats an unreadable %s count as spent', async (failOn) => {
    client({ conversation: 0, site: 0, failOn });
    expect(await triageBudgetRemaining('site-1', 'conv-1')).toBe(false);
  });
});
