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
});
