// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { setMessengerServiceClientForTests } from './db';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn(async () => ({ userId: 'user_1' })) }));

const findSiteByDomain = vi.hoisted(() => vi.fn());
vi.mock('./shop-tenancy', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./shop-tenancy')>();
  return { ...actual, findSiteByDomain };
});

import { ensureMessengerSite, listMessengerSites, shouldEnsureMessengerSite } from './provisioning';

/* First visit renders this page more than once concurrently. The original
   read-then-insert died on profiles_clerk_user_id_key when the second render
   lost the race — a real production error on the very first page load. These
   tests pin the conflict-safe behaviour. */

type Row = Record<string, unknown>;
type Recorded = Array<[string, unknown]>;

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
  /** Force the next update(...).select().maybeSingle() CAS to return no row. */
  missNextUpdate?: boolean;
  /** Model a concurrent winner changing state while our CAS reports no row. */
  onUpdateMiss?: (rows: Row[], patch: Row) => void;
  /** Force insert(...).select().single() to return this database error. */
  insertError?: string;
}

function stubClient(tables: Record<string, TableState>) {
  const calls: string[] = [];
  // .update().eq() filters, in call order — a col.eq() call that's dropped or
  // retargeted (e.g. filtering on 'domain' instead of 'id') still leaves a
  // stub that matches by coincidence; asserting the exact filter is the only
  // way to catch that. See shop-tenancy.test.ts's stub for the original.
  const recorded: Recorded = [];
  const updates: Array<{ table: string; patch: Row; filters: Recorded }> = [];

  function builder(table: string) {
    const state = tables[table];
    let filters: Array<[string, unknown]> = [];
    let neqFilters: Array<[string, unknown]> = [];
    let countOnly = false;
    let pendingInsert: { data: Row | null; error: { message: string } | null } | null = null;

    const matches = (row: Row, eqFilters = filters, notEqFilters = neqFilters) =>
      eqFilters.every(([c, v]) => row[c] === v) && notEqFilters.every(([c, v]) => row[c] !== v);

    const resetRead = () => {
      filters = [];
      neqFilters = [];
      countOnly = false;
    };

    const api: Record<string, unknown> = {
      select: (_columns?: string, options?: { count?: string; head?: boolean }) => {
        countOnly = options?.count === 'exact';
        return api;
      },
      order: () => api,
      limit: () => api,
      eq: (col: string, val: unknown) => {
        filters.push([col, val]);
        return api;
      },
      is: (col: string, val: unknown) => {
        filters.push([col, val]);
        return api;
      },
      neq: (col: string, val: unknown) => {
        neqFilters.push([col, val]);
        return api;
      },
      insert: (row: Row) => {
        calls.push(`${table}.insert`);
        const duplicateDomain = row.domain != null && state.rows.some((candidate) => candidate.domain === row.domain);
        if (state.insertError || duplicateDomain) {
          pendingInsert = { data: null, error: { message: state.insertError ?? 'duplicate domain' } };
          return api;
        }
        const inserted = { id: `${table}-${state.rows.length + 1}`, ...row };
        state.rows.push(inserted);
        pendingInsert = { data: inserted, error: null };
        return api;
      },
      update: (patch: Row) => {
        calls.push(`${table}.update`);
        // Mirrors real supabase-js: .update() only becomes a filter builder
        // once a verb is chained onto it, and the builder itself is thenable
        // (a bare `.update().eq()` awaits fine) while also supporting
        // `.select().maybeSingle()` for a compare-and-swap read-back.
        const updateFilters: Array<[string, unknown]> = [];
        updates.push({ table, patch, filters: updateFilters });
        const updateApi: Record<string, unknown> = {
          eq: (col: string, val: unknown) => {
            updateFilters.push([col, val]);
            recorded.push([col, val]);
            return updateApi;
          },
          is: (col: string, val: unknown) => {
            updateFilters.push([col, val]);
            return updateApi;
          },
          select: () => updateApi,
          maybeSingle: () => {
            if (state.missNextUpdate) {
              state.missNextUpdate = false;
              state.onUpdateMiss?.(state.rows, patch);
              return Promise.resolve({ data: null, error: null });
            }
            const match = state.rows.find((r) => updateFilters.every(([c, v]) => r[c] === v));
            if (match) Object.assign(match, patch);
            return Promise.resolve({ data: match ? { ...match } : null, error: null });
          },
          then: (resolve: (v: unknown) => unknown) => {
            const matched = state.rows.filter((r) => updateFilters.every(([c, v]) => r[c] === v));
            for (const row of matched) Object.assign(row, patch);
            return Promise.resolve({ data: null, error: null }).then(resolve);
          },
        };
        return updateApi;
      },
      delete: () => {
        calls.push(`${table}.delete`);
        const deleteFilters: Array<[string, unknown]> = [];
        const deleteApi: Record<string, unknown> = {
          eq: (col: string, val: unknown) => {
            deleteFilters.push([col, val]);
            return deleteApi;
          },
          is: (col: string, val: unknown) => {
            deleteFilters.push([col, val]);
            return deleteApi;
          },
          then: (resolve: (v: unknown) => unknown) => {
            state.rows = state.rows.filter(
              (row) => !deleteFilters.every(([column, value]) => row[column] === value),
            );
            return Promise.resolve({ data: null, error: null }).then(resolve);
          },
        };
        return deleteApi;
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
        const match = state.rows.find((row) => matches(row));
        resetRead();
        return Promise.resolve({ data: match ?? null, error: null });
      },
      single: () => {
        if (pendingInsert) {
          const result = pendingInsert;
          pendingInsert = null;
          resetRead();
          return Promise.resolve(result);
        }
        const match = state.rows.find((row) => matches(row));
        resetRead();
        return Promise.resolve({ data: match ?? null, error: match ? null : { message: 'no rows' } });
      },
      then: (resolve: (v: unknown) => unknown) => {
        const matched = state.rows.filter((row) => matches(row));
        const result = {
          data: countOnly ? null : matched,
          error: null,
          count: countOnly ? matched.length : null,
        };
        resetRead();
        return Promise.resolve(result).then(resolve);
      },
    };
    return api;
  }

  return {
    client: { from: (table: string) => builder(table) } as unknown as SupabaseClient,
    calls,
    tables,
    recorded,
    updates,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  findSiteByDomain.mockResolvedValue(null);
});
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

  it('does not adopt-or-refuse a findSiteByDomain result already in the caller\'s own workspace', async () => {
    /* Guards the branch's own gate condition, not just its consequences:
       "already mine" is supposed to be handled entirely by the `found`
       early-return above. If that workspace comparison were ever deleted,
       this exact shape — findSiteByDomain answering with our own
       workspace_id, but on a site the earlier `found` scan didn't happen to
       catch — would run it through adopt-or-refuse anyway, and could throw
       StoreOwnedByAnotherAccountError for a store the caller already owns. */
    findSiteByDomain.mockResolvedValue({
      id: 's-mine',
      workspace_id: 'w-1',
      domain: 'demo.myshopify.com',
      ownerClerkUserId: 'user_2', // would incorrectly refuse if the workspace guard were gone
    });
    const { client, calls } = stubClient({
      profiles: { rows: [{ id: 'p-1', clerk_user_id: 'user_1', email: 'a@b.c' }] },
      workspaces: { rows: [{ id: 'w-1', owner_profile_id: 'p-1', created_at: '2026-01-01' }] },
      widget_sites: { rows: [] },
    });
    setMessengerServiceClientForTests(client);

    await expect(ensureMessengerSite('user_1', 'demo.myshopify.com')).resolves.toBeTruthy();
    // No adoption write happened — the block was never entered.
    expect(calls).not.toContain('widget_sites.update');
  });

  it('adopts a store already provisioned by the embedded Shopify app', async () => {
    /* The merchant configured Store Chat inside Shopify first (owned by the
       synthetic shop profile), then signed up on the web. They must land on
       the SAME config, not a fresh one with a second embed key. */
    findSiteByDomain.mockResolvedValue({
      id: 's-shop',
      workspace_id: 'w-shop',
      domain: 'demo.myshopify.com',
      ownerClerkUserId: 'shop-demo.myshopify.com',
    });
    const { client, tables } = stubClient({
      profiles: { rows: [{ id: 'p-1', clerk_user_id: 'user_1', email: 'a@b.c' }] },
      workspaces: { rows: [{ id: 'w-1', owner_profile_id: 'p-1', created_at: '2026-01-01' }] },
      widget_sites: {
        rows: [
          {
            id: 's-shop',
            workspace_id: 'w-shop',
            domain: 'demo.myshopify.com',
            name: 'demo.myshopify.com',
            embed_key: 'gc_existing',
            status: 'active',
            settings_json: {},
            settings_version: 3,
            settings_draft: null,
          },
        ],
      },
    });
    setMessengerServiceClientForTests(client);

    const site = await ensureMessengerSite('user_1', 'demo.myshopify.com');

    expect(site.id).toBe('s-shop');
    expect(site.embed_key).toBe('gc_existing');
    // Transferred, not duplicated.
    expect(tables.widget_sites.rows).toHaveLength(1);
    expect(tables.widget_sites.rows[0].workspace_id).toBe('w-1');
  });

  it('adopts the shop-owned site and deletes an empty domain-less orphan in the real workspace', async () => {
    findSiteByDomain.mockResolvedValue({
      id: 's-shop',
      workspace_id: 'w-shop',
      domain: 'demo.myshopify.com',
      ownerClerkUserId: 'shop-demo.myshopify.com',
    });
    const { client, tables, calls } = stubClient({
      profiles: { rows: [{ id: 'p-1', clerk_user_id: 'user_1', email: 'a@b.c' }] },
      workspaces: { rows: [{ id: 'w-1', owner_profile_id: 'p-1', created_at: '2026-01-01' }] },
      widget_sites: {
        rows: [
          {
            id: 's-orphan',
            workspace_id: 'w-1',
            domain: null,
            name: 'My store',
            embed_key: 'gc_orphan',
            status: 'draft',
            settings_json: {},
            settings_version: 1,
            settings_draft: null,
          },
          {
            id: 's-shop',
            workspace_id: 'w-shop',
            domain: 'demo.myshopify.com',
            name: 'demo.myshopify.com',
            embed_key: 'gc_existing',
            status: 'active',
            settings_json: {},
            settings_version: 3,
            settings_draft: null,
          },
        ],
      },
      widget_conversations: { rows: [] },
      messenger_knowledge: { rows: [] },
    });
    setMessengerServiceClientForTests(client);

    const site = await ensureMessengerSite('user_1', 'demo.myshopify.com');

    expect(site.id).toBe('s-shop');
    expect(tables.widget_sites.rows.find((row) => row.id === 's-orphan')).toBeUndefined();
    expect(calls).toContain('widget_sites.delete');
  });

  it('does not delete a domain-less orphan that contains merchant settings', async () => {
    findSiteByDomain.mockResolvedValue({
      id: 's-shop',
      workspace_id: 'w-shop',
      domain: 'demo.myshopify.com',
      ownerClerkUserId: 'shop-demo.myshopify.com',
    });
    const { client, tables, calls } = stubClient({
      profiles: { rows: [{ id: 'p-1', clerk_user_id: 'user_1', email: 'a@b.c' }] },
      workspaces: { rows: [{ id: 'w-1', owner_profile_id: 'p-1', created_at: '2026-01-01' }] },
      widget_sites: {
        rows: [
          {
            id: 's-orphan',
            workspace_id: 'w-1',
            domain: null,
            name: 'Merchant renamed this',
            embed_key: 'gc_orphan',
            status: 'draft',
            settings_json: { appearance: { primaryColor: '#123456' } },
            settings_version: 1,
            settings_draft: null,
          },
          {
            id: 's-shop',
            workspace_id: 'w-shop',
            domain: 'demo.myshopify.com',
            name: 'demo.myshopify.com',
            embed_key: 'gc_existing',
            status: 'active',
            settings_json: {},
            settings_version: 3,
            settings_draft: null,
          },
        ],
      },
      widget_conversations: { rows: [] },
      messenger_knowledge: { rows: [] },
    });
    setMessengerServiceClientForTests(client);

    await ensureMessengerSite('user_1', 'demo.myshopify.com');

    expect(tables.widget_sites.rows.find((row) => row.id === 's-orphan')).toBeTruthy();
    expect(calls).not.toContain('widget_sites.delete');
  });

  it('reconciles an empty orphan after the insert-error race fallback adopts a site', async () => {
    findSiteByDomain
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 's-shop',
        workspace_id: 'w-shop',
        domain: 'demo.myshopify.com',
        ownerClerkUserId: 'shop-demo.myshopify.com',
      });
    const { client, tables } = stubClient({
      profiles: { rows: [{ id: 'p-1', clerk_user_id: 'user_1', email: 'a@b.c' }] },
      workspaces: { rows: [{ id: 'w-1', owner_profile_id: 'p-1', created_at: '2026-01-01' }] },
      widget_sites: {
        rows: [
          {
            id: 's-orphan',
            workspace_id: 'w-1',
            domain: null,
            name: 'My store',
            embed_key: 'gc_orphan',
            status: 'draft',
            settings_json: {},
            settings_version: 1,
            settings_draft: null,
          },
          {
            id: 's-shop',
            workspace_id: 'w-shop',
            domain: 'demo.myshopify.com',
            name: 'demo.myshopify.com',
            embed_key: 'gc_existing',
            status: 'active',
            settings_json: {},
            settings_version: 3,
            settings_draft: null,
          },
        ],
        missNextUpdate: true,
        insertError: 'duplicate domain',
      },
      widget_conversations: { rows: [] },
      messenger_knowledge: { rows: [] },
    });
    setMessengerServiceClientForTests(client);

    const site = await ensureMessengerSite('user_1', 'demo.myshopify.com');

    expect(site.id).toBe('s-shop');
    expect(tables.widget_sites.rows.find((row) => row.id === 's-orphan')).toBeUndefined();
  });

  it('attaches a newly known domain to the existing domain-less site instead of inserting', async () => {
    const { client, tables, calls, updates } = stubClient({
      profiles: { rows: [{ id: 'p-1', clerk_user_id: 'user_1', email: 'a@b.c' }] },
      workspaces: { rows: [{ id: 'w-1', owner_profile_id: 'p-1', created_at: '2026-01-01' }] },
      widget_sites: {
        rows: [
          {
            id: 's-orphan',
            workspace_id: 'w-1',
            domain: null,
            name: 'Merchant custom name',
            embed_key: 'gc_keep_me',
            status: 'draft',
            settings_json: { appearance: { primaryColor: '#abcdef' } },
            settings_version: 4,
            settings_draft: { behaviour: { greeting: 'Hello' } },
          },
        ],
      },
    });
    setMessengerServiceClientForTests(client);

    const site = await ensureMessengerSite('user_1', 'demo.myshopify.com');

    expect(site).toMatchObject({
      id: 's-orphan',
      domain: 'demo.myshopify.com',
      name: 'Merchant custom name',
      embed_key: 'gc_keep_me',
    });
    expect(updates).toContainEqual({
      table: 'widget_sites',
      patch: { domain: 'demo.myshopify.com' },
      filters: [
        ['id', 's-orphan'],
        ['domain', null],
      ],
    });
    expect(calls).not.toContain('widget_sites.insert');
    expect(tables.widget_sites.rows).toHaveLength(1);
  });

  it('falls through to the existing insert race recovery when domain attachment loses its CAS', async () => {
    const { client, tables, calls } = stubClient({
      profiles: { rows: [{ id: 'p-1', clerk_user_id: 'user_1', email: 'a@b.c' }] },
      workspaces: { rows: [{ id: 'w-1', owner_profile_id: 'p-1', created_at: '2026-01-01' }] },
      widget_sites: {
        rows: [
          {
            id: 's-orphan',
            workspace_id: 'w-1',
            domain: null,
            name: 'My store',
            embed_key: 'gc_keep_me',
            status: 'draft',
            settings_json: {},
            settings_version: 1,
            settings_draft: null,
          },
        ],
        missNextUpdate: true,
        onUpdateMiss: (rows, patch) => Object.assign(rows[0], patch),
      },
    });
    setMessengerServiceClientForTests(client);

    const site = await ensureMessengerSite('user_1', 'demo.myshopify.com');

    expect(site.id).toBe('s-orphan');
    expect(site.domain).toBe('demo.myshopify.com');
    expect(calls).toContain('widget_sites.update');
    expect(calls).toContain('widget_sites.insert');
    expect(tables.widget_sites.rows).toHaveLength(1);
  });

  it('refuses a store owned by a different real account', async () => {
    findSiteByDomain.mockResolvedValue({
      id: 's-theirs',
      workspace_id: 'w-2',
      domain: 'demo.myshopify.com',
      ownerClerkUserId: 'user_2',
    });
    const { client, tables } = stubClient({
      profiles: { rows: [{ id: 'p-1', clerk_user_id: 'user_1', email: 'a@b.c' }] },
      workspaces: { rows: [{ id: 'w-1', owner_profile_id: 'p-1', created_at: '2026-01-01' }] },
      widget_sites: {
        rows: [
          {
            id: 's-theirs',
            workspace_id: 'w-2',
            domain: 'demo.myshopify.com',
            name: 'demo.myshopify.com',
            embed_key: 'gc_theirs',
            status: 'active',
            settings_json: {},
            settings_version: 1,
            settings_draft: null,
          },
        ],
      },
    });
    setMessengerServiceClientForTests(client);

    await expect(ensureMessengerSite('user_1', 'demo.myshopify.com')).rejects.toThrow(
      /already connected to another GRINDCTRL account/,
    );
    // Untouched.
    expect(tables.widget_sites.rows[0].workspace_id).toBe('w-2');
  });

  it('refuses when the owner cannot be identified', async () => {
    // Fail closed: an unknown owner is not an invitation to take the store.
    findSiteByDomain.mockResolvedValue({
      id: 's-x', workspace_id: 'w-9', domain: 'demo.myshopify.com', ownerClerkUserId: null,
    });
    const { client } = stubClient({
      profiles: { rows: [{ id: 'p-1', clerk_user_id: 'user_1', email: 'a@b.c' }] },
      workspaces: { rows: [{ id: 'w-1', owner_profile_id: 'p-1', created_at: '2026-01-01' }] },
      widget_sites: { rows: [] },
    });
    setMessengerServiceClientForTests(client);

    await expect(ensureMessengerSite('user_1', 'demo.myshopify.com')).rejects.toThrow(
      /already connected to another GRINDCTRL account/,
    );
  });

  it('canonicalises the domain before writing, because the DB now rejects anything else', async () => {
    const { client, tables } = stubClient({
      profiles: { rows: [{ id: 'p-1', clerk_user_id: 'user_1', email: 'a@b.c' }] },
      workspaces: { rows: [{ id: 'w-1', owner_profile_id: 'p-1', created_at: '2026-01-01' }] },
      widget_sites: { rows: [] },
    });
    setMessengerServiceClientForTests(client);

    await ensureMessengerSite('user_1', '  Demo.MyShopify.com  ');

    expect(tables.widget_sites.rows[0].domain).toBe('demo.myshopify.com');
    // And the lookup was asked about the canonical form, not the raw input.
    expect(findSiteByDomain).toHaveBeenCalledWith('demo.myshopify.com');
  });

  it('adopts (does not refuse) a site left in a stray second workspace of the same merchant', async () => {
    /* workspaces has no unique key on owner_profile_id (see the race note on
       ensureWorkspace), so a concurrent first visit can leave one merchant
       with two workspaces. If a site landed in the newer one before
       ensureWorkspace's oldest-first tiebreak settled on the older one,
       refusing to touch it — because it's merely a *different workspace* —
       would tell the merchant their own storefront belongs to someone else,
       and no retry could ever clear that. Refusal must be keyed on owner. */
    findSiteByDomain.mockResolvedValue({
      id: 's-strayed',
      workspace_id: 'w-stray',
      domain: 'demo.myshopify.com',
      ownerClerkUserId: 'user_1',
    });
    const { client, tables } = stubClient({
      profiles: { rows: [{ id: 'p-1', clerk_user_id: 'user_1', email: 'a@b.c' }] },
      workspaces: { rows: [{ id: 'w-1', owner_profile_id: 'p-1', created_at: '2026-01-01' }] },
      widget_sites: {
        rows: [
          {
            id: 's-strayed',
            workspace_id: 'w-stray',
            domain: 'demo.myshopify.com',
            name: 'demo.myshopify.com',
            embed_key: 'gc_stray',
            status: 'active',
            settings_json: {},
            settings_version: 2,
            settings_draft: null,
          },
        ],
      },
    });
    setMessengerServiceClientForTests(client);

    const site = await ensureMessengerSite('user_1', 'demo.myshopify.com');

    expect(site.id).toBe('s-strayed');
    expect(tables.widget_sites.rows).toHaveLength(1);
    expect(tables.widget_sites.rows[0].workspace_id).toBe('w-1');
  });

  it('refuses when the owner is an empty string, not just null', async () => {
    // '' is falsy but not null/undefined — a check that only special-cases
    // null would let this through as if unowned.
    findSiteByDomain.mockResolvedValue({
      id: 's-x', workspace_id: 'w-9', domain: 'demo.myshopify.com', ownerClerkUserId: '',
    });
    const { client } = stubClient({
      profiles: { rows: [{ id: 'p-1', clerk_user_id: 'user_1', email: 'a@b.c' }] },
      workspaces: { rows: [{ id: 'w-1', owner_profile_id: 'p-1', created_at: '2026-01-01' }] },
      widget_sites: { rows: [] },
    });
    setMessengerServiceClientForTests(client);

    await expect(ensureMessengerSite('user_1', 'demo.myshopify.com')).rejects.toThrow(
      /already connected to another GRINDCTRL account/,
    );
  });

  it('scopes the adoption write to the exact row it read (compare-and-swap)', async () => {
    /* Two accounts racing to adopt the same shop-owned site: whichever
       update lands second must find nothing left to claim, not silently
       steal the first adopter's win. Filtering on id alone (or on domain,
       which is not even unique per row before adoption settles) can't tell
       "still where I found it" from "already taken" — only pairing id with
       the workspace_id read at the same moment can. */
    findSiteByDomain.mockResolvedValue({
      id: 's-shop',
      workspace_id: 'w-shop',
      domain: 'demo.myshopify.com',
      ownerClerkUserId: 'shop-demo.myshopify.com',
    });
    const { client, recorded } = stubClient({
      profiles: { rows: [{ id: 'p-1', clerk_user_id: 'user_1', email: 'a@b.c' }] },
      workspaces: { rows: [{ id: 'w-1', owner_profile_id: 'p-1', created_at: '2026-01-01' }] },
      widget_sites: {
        rows: [
          {
            id: 's-shop',
            workspace_id: 'w-shop',
            domain: 'demo.myshopify.com',
            name: 'demo.myshopify.com',
            embed_key: 'gc_existing',
            status: 'active',
            settings_json: {},
            settings_version: 3,
            settings_draft: null,
          },
        ],
      },
    });
    setMessengerServiceClientForTests(client);

    await ensureMessengerSite('user_1', 'demo.myshopify.com');

    // The compare-and-swap filters, in the exact order the code sends them:
    // this row, and only if it's still where we read it from.
    expect(recorded).toEqual([
      ['id', 's-shop'],
      ['workspace_id', 'w-shop'],
    ]);
  });

  it('throws instead of silently taking a site a concurrent adopter already won', async () => {
    // The row moved out from under us between the read and the write: the
    // compare-and-swap .eq('workspace_id', ...) matches nothing, so the
    // update reports success with zero rows rather than an error.
    findSiteByDomain.mockResolvedValue({
      id: 's-shop',
      workspace_id: 'w-shop',
      domain: 'demo.myshopify.com',
      ownerClerkUserId: 'shop-demo.myshopify.com',
    });
    const { client } = stubClient({
      profiles: { rows: [{ id: 'p-1', clerk_user_id: 'user_1', email: 'a@b.c' }] },
      workspaces: { rows: [{ id: 'w-1', owner_profile_id: 'p-1', created_at: '2026-01-01' }] },
      widget_sites: {
        rows: [
          {
            // Already moved to w-other by a faster adopter — no longer w-shop.
            id: 's-shop',
            workspace_id: 'w-other',
            domain: 'demo.myshopify.com',
            name: 'demo.myshopify.com',
            embed_key: 'gc_existing',
            status: 'active',
            settings_json: {},
            settings_version: 3,
            settings_draft: null,
          },
        ],
      },
    });
    setMessengerServiceClientForTests(client);

    await expect(ensureMessengerSite('user_1', 'demo.myshopify.com')).rejects.toThrow(
      /already connected to another GRINDCTRL account/,
    );
  });

  it('creates a domain-less site without consulting store-ownership lookups', async () => {
    const { client, tables } = stubClient({
      profiles: { rows: [{ id: 'p-1', clerk_user_id: 'user_1', email: 'a@b.c' }] },
      workspaces: { rows: [{ id: 'w-1', owner_profile_id: 'p-1', created_at: '2026-01-01' }] },
      widget_sites: { rows: [] },
    });
    setMessengerServiceClientForTests(client);

    const site = await ensureMessengerSite('user_1', null);

    expect(site.domain).toBeNull();
    expect(tables.widget_sites.rows).toHaveLength(1);
    expect(findSiteByDomain).not.toHaveBeenCalled();
  });

  it('tells the dashboard to provision when a managed domain is newly known but not attached', async () => {
    expect(shouldEnsureMessengerSite([], null)).toBe(true);
    expect(shouldEnsureMessengerSite([{ domain: null }], 'demo.myshopify.com')).toBe(true);
    expect(shouldEnsureMessengerSite([{ domain: 'demo.myshopify.com' }], 'demo.myshopify.com')).toBe(false);
    expect(shouldEnsureMessengerSite([{ domain: null }], null)).toBe(false);
  });
});
