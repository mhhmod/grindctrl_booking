// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { setMessengerServiceClientForTests } from './db';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn(async () => ({ userId: 'user_1' })) }));

import { listMessengerSites } from './provisioning';

/* First visit renders this page more than once concurrently. The original
   read-then-insert died on profiles_clerk_user_id_key when the second render
   lost the race — a real production error on the very first page load. These
   tests pin the conflict-safe behaviour. */

type Row = Record<string, unknown>;

interface TableState {
  rows: Row[];
  /** Rows that a *concurrent* request commits between our read and write. */
  appearOnWrite?: Row[];
  /** Rows the winner has inserted but which this connection cannot see yet.
   *  They become visible after `hiddenForReads` more reads — which is what
   *  production did: the row's transaction had started (created_at 22:20:10.224)
   *  but the loser's follow-up read at .978 still came back empty. */
  hiddenRows?: Row[];
  hiddenForReads?: number;
}

function stubClient(tables: Record<string, TableState>) {
  const calls: string[] = [];

  function builder(table: string) {
    const state = tables[table];
    let filters: Array<[string, unknown]> = [];

    const api: Record<string, unknown> = {
      select: () => api,
      order: () => api,
      limit: () => api,
      eq: (col: string, val: unknown) => {
        filters.push([col, val]);
        return api;
      },
      insert: (row: Row) => {
        calls.push(`${table}.insert`);
        state.rows.push({ id: `${table}-${state.rows.length + 1}`, ...row });
        return api;
      },
      update: (patch: Row) => {
        calls.push(`${table}.update`);
        // Mirrors real supabase-js: .update() only becomes a filter builder
        // once a verb is chained onto it, so the match happens in .eq().
        return {
          eq: (col: string, val: unknown) => {
            for (const row of state.rows) {
              if (row[col] === val) Object.assign(row, patch);
            }
            return Promise.resolve({ data: null, error: null });
          },
        };
      },
      upsert: (row: Row) => {
        calls.push(`${table}.upsert`);
        // The winner holds the unique-index slot, so ON CONFLICT DO NOTHING
        // writes nothing and reports success — the exact production shape.
        if (state.hiddenRows?.length) return Promise.resolve({ data: null, error: null });
        // A racing request already committed its row: on conflict do nothing.
        if (state.appearOnWrite?.length) {
          state.rows.push(...state.appearOnWrite);
          state.appearOnWrite = [];
          return Promise.resolve({ data: null, error: null });
        }
        state.rows.push({ id: `${table}-${state.rows.length + 1}`, ...row });
        return Promise.resolve({ data: null, error: null });
      },
      maybeSingle: () => {
        // A row committed by a concurrent writer becomes visible only once
        // this connection's snapshot catches up.
        if (state.hiddenRows?.length) {
          if ((state.hiddenForReads ?? 0) > 0) state.hiddenForReads! -= 1;
          else {
            state.rows.push(...state.hiddenRows);
            state.hiddenRows = [];
          }
        }
        const match = state.rows.find((r) => filters.every(([c, v]) => r[c] === v));
        filters = [];
        return Promise.resolve({ data: match ?? null, error: null });
      },
      single: () => {
        const match = state.rows.find((r) => filters.every(([c, v]) => r[c] === v));
        filters = [];
        return Promise.resolve({ data: match ?? null, error: match ? null : { message: 'no rows' } });
      },
      then: (resolve: (v: unknown) => unknown) => {
        const matched = state.rows.filter((r) => filters.every(([c, v]) => r[c] === v));
        filters = [];
        return Promise.resolve({ data: matched, error: null }).then(resolve);
      },
    };
    return api;
  }

  return {
    client: { from: (table: string) => builder(table) } as unknown as SupabaseClient,
    calls,
    tables,
  };
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => setMessengerServiceClientForTests(null));

describe('provisioning', () => {
  it('survives a concurrent first visit that creates the profile first', async () => {
    const { client, tables } = stubClient({
      profiles: {
        rows: [],
        // The other render commits this between our read and our write.
        appearOnWrite: [{ id: 'p-racer', clerk_user_id: 'user_1', email: 'racer@example.com' }],
      },
      workspaces: { rows: [{ id: 'w-1', owner_profile_id: 'p-racer', created_at: '2026-01-01' }] },
      widget_sites: { rows: [] },
    });
    setMessengerServiceClientForTests(client);

    const sites = await listMessengerSites('user_1');

    // Resolves the winner's row instead of throwing...
    expect(sites).toEqual([]);
    // ...and writes no second row. A plain insert here is what produced
    // "duplicate key value violates profiles_clerk_user_id_key" in prod.
    const mine = tables.profiles.rows.filter((r) => r.clerk_user_id === 'user_1');
    expect(mine).toHaveLength(1);
    expect(mine[0].id).toBe('p-racer');
  });

  it('waits for a concurrent insert this connection cannot see yet', async () => {
    /* Production, 2026-08-29 22:20:10: two renders of /dashboard/messenger
       raced on a brand-new Clerk user (Next prefetches the route while
       navigating to it). The winner inserted; the loser's ON CONFLICT DO
       NOTHING wrote nothing, and its follow-up read did not observe the
       winner's commit. ensureProfile threw 'row missing after insert' and
       the whole dashboard page 500'd on the user's first ever visit.

       The old code read exactly once and gave up. */
    const { client } = stubClient({
      profiles: {
        rows: [],
        hiddenRows: [{ id: 'p-winner', clerk_user_id: 'user_1', email: 'winner@example.com' }],
        hiddenForReads: 2,
      },
      workspaces: { rows: [{ id: 'w-1', owner_profile_id: 'p-winner', created_at: '2026-01-01' }] },
      widget_sites: { rows: [] },
    });
    setMessengerServiceClientForTests(client);

    await expect(listMessengerSites('user_1')).resolves.toEqual([]);
  });

  it('still gives up rather than hanging when the row never appears', async () => {
    const { client } = stubClient({
      profiles: {
        rows: [],
        hiddenRows: [{ id: 'p-never', clerk_user_id: 'user_1', email: 'x@y.z' }],
        hiddenForReads: 99,
      },
      workspaces: { rows: [] },
      widget_sites: { rows: [] },
    });
    setMessengerServiceClientForTests(client);

    await expect(listMessengerSites('user_1')).rejects.toThrow(/row missing after insert/);
  });

  it('reuses the existing profile and workspace without writing again', async () => {
    const { client, calls } = stubClient({
      profiles: { rows: [{ id: 'p-1', clerk_user_id: 'user_1', email: 'a@b.c' }] },
      workspaces: { rows: [{ id: 'w-1', owner_profile_id: 'p-1', created_at: '2026-01-01' }] },
      widget_sites: { rows: [] },
    });
    setMessengerServiceClientForTests(client);

    await listMessengerSites('user_1');

    expect(calls).not.toContain('profiles.insert');
    expect(calls).not.toContain('profiles.upsert');
    expect(calls).not.toContain('workspaces.insert');
  });

  it('upgrades a placeholder email once a real one is known', async () => {
    const { client, tables } = stubClient({
      profiles: {
        rows: [
          { id: 'p-1', clerk_user_id: 'user_1', email: 'user_1@users.noreply.clerk.dev' },
        ],
      },
      workspaces: { rows: [{ id: 'w-1', owner_profile_id: 'p-1', created_at: '2026-01-01' }] },
      widget_sites: { rows: [] },
    });
    setMessengerServiceClientForTests(client);

    await listMessengerSites('user_1', 'owner@store.com');

    expect(tables.profiles.rows[0].email).toBe('owner@store.com');
  });

  it('never downgrades a real email back to the placeholder', async () => {
    const { client, tables } = stubClient({
      profiles: { rows: [{ id: 'p-1', clerk_user_id: 'user_1', email: 'owner@store.com' }] },
      workspaces: { rows: [{ id: 'w-1', owner_profile_id: 'p-1', created_at: '2026-01-01' }] },
      widget_sites: { rows: [] },
    });
    setMessengerServiceClientForTests(client);

    await listMessengerSites('user_1', null);

    expect(tables.profiles.rows[0].email).toBe('owner@store.com');
  });

  it('leaves a real stored email alone when a different real one arrives', async () => {
    const { client, tables } = stubClient({
      profiles: { rows: [{ id: 'p-1', clerk_user_id: 'user_1', email: 'a@store.com' }] },
      workspaces: { rows: [{ id: 'w-1', owner_profile_id: 'p-1', created_at: '2026-01-01' }] },
      widget_sites: { rows: [] },
    });
    setMessengerServiceClientForTests(client);

    await listMessengerSites('user_1', 'b@store.com');

    expect(tables.profiles.rows[0].email).toBe('a@store.com');
  });
});
