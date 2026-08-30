// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { setMessengerServiceClientForTests } from './db';

const ensureMessengerSite = vi.hoisted(() => vi.fn());
vi.mock('./provisioning', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./provisioning')>();
  // getSiteView is left real everywhere: it's a plain unscoped lookup with
  // nothing to fake, and the post-claim test below depends on it running
  // for real against the stub client.
  return { ...actual, ensureMessengerSite };
});

const findSiteByDomain = vi.hoisted(() => vi.fn());
vi.mock('./shop-tenancy', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./shop-tenancy')>();
  return { ...actual, findSiteByDomain };
});

import { ensureShopOwnedSite } from './shop-provisioning';

beforeEach(() => {
  ensureMessengerSite.mockReset();
  ensureMessengerSite.mockResolvedValue({ id: 's-1' });
  findSiteByDomain.mockReset();
  findSiteByDomain.mockResolvedValue(null);
});
afterEach(() => setMessengerServiceClientForTests(null));

describe('ensureShopOwnedSite validation', () => {
  it('provisions under a synthetic profile so no signup is needed', async () => {
    await ensureShopOwnedSite('Demo.MyShopify.com');

    // Namespaced so it can never collide with a Clerk id, canonicalised
    // because the DB constraint rejects anything else, and the domain
    // doubles as the display name because the merchant never typed one.
    expect(ensureMessengerSite).toHaveBeenCalledWith(
      'shop-demo.myshopify.com',
      'demo.myshopify.com',
      'demo.myshopify.com',
    );
  });

  it('accepts a shop domain with surrounding whitespace', async () => {
    await ensureShopOwnedSite('  demo.myshopify.com  ');
    expect(ensureMessengerSite).toHaveBeenCalledWith(
      'shop-demo.myshopify.com',
      'demo.myshopify.com',
      'demo.myshopify.com',
    );
  });

  it('returns whatever ensureMessengerSite resolved', async () => {
    ensureMessengerSite.mockResolvedValue({ id: 's-42' });
    await expect(ensureShopOwnedSite('demo.myshopify.com')).resolves.toEqual({ id: 's-42' });
  });

  it('refuses anything that is not a myshopify domain, without touching the database', async () => {
    /* The caller derives this from a verified Shopify session token, but this
       is the boundary that decides which row gets written — and a bad value
       here provisions a tenant for a store that does not exist. */
    for (const bad of ['evil.example.com', 'demo.myshopify.com.evil.com', '', '   ', 'myshopify.com', 'store-.myshopify.com']) {
      await expect(ensureShopOwnedSite(bad)).rejects.toThrow(/Refusing to provision/);
    }
    expect(ensureMessengerSite).not.toHaveBeenCalled();
  });
});

/* The tests above mock ./provisioning wholesale, so they can only see string
 * transforms — none of them can fail if ensureShopOwnedSite's actual DB
 * behaviour is wrong. The two tests below swap ensureMessengerSite and
 * findSiteByDomain back to their real implementations (still routed through
 * the mock, which is why the swap needs vi.importActual rather than an
 * unmock) and drive them against a stub Supabase client, following
 * provisioning.test.ts's pattern. */
describe('ensureShopOwnedSite against real provisioning', () => {
  type Row = Record<string, unknown>;

  function stubClient(tables: Record<string, { rows: Row[] }>) {
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
        upsert: (row: Row) => {
          calls.push(`${table}.upsert`);
          state.rows.push({ id: `${table}-${state.rows.length + 1}`, ...row });
          return Promise.resolve({ data: null, error: null });
        },
        update: (patch: Row) => {
          calls.push(`${table}.update`);
          const updateFilters: Array<[string, unknown]> = [];
          const updateApi: Record<string, unknown> = {
            eq: (col: string, val: unknown) => {
              updateFilters.push([col, val]);
              return updateApi;
            },
            select: () => updateApi,
            maybeSingle: () => {
              const match = state.rows.find((r) => updateFilters.every(([c, v]) => r[c] === v));
              if (match) Object.assign(match, patch);
              return Promise.resolve({ data: match ? { ...match } : null, error: null });
            },
          };
          return updateApi;
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

  async function useRealImplementations() {
    const actualProvisioning = await vi.importActual<typeof import('./provisioning')>('./provisioning');
    const actualShopTenancy = await vi.importActual<typeof import('./shop-tenancy')>('./shop-tenancy');
    ensureMessengerSite.mockImplementation(actualProvisioning.ensureMessengerSite);
    findSiteByDomain.mockImplementation(actualShopTenancy.findSiteByDomain);
  }

  it('idempotent re-open: two opens of the same shop return the same site, not a duplicate', async () => {
    const { client, calls, tables } = stubClient({
      profiles: { rows: [] },
      workspaces: { rows: [] },
      widget_sites: { rows: [] },
    });
    setMessengerServiceClientForTests(client);
    await useRealImplementations();

    const first = await ensureShopOwnedSite('demo.myshopify.com');
    const second = await ensureShopOwnedSite('demo.myshopify.com');

    expect(second.id).toBe(first.id);
    expect(calls.filter((c) => c === 'widget_sites.insert')).toHaveLength(1);
    expect(tables.widget_sites.rows).toHaveLength(1);
  });

  it('post-claim re-open: a claimed store must not throw at its own merchant', async () => {
    /* Claiming moves a site's workspace_id to the real merchant's account
       (ensureMessengerSite's adoption path). The embedded app authenticates
       by shop domain, not by account, so the next open must keep returning
       this same site — not refuse it because a different Clerk user now
       owns the row it lives in.

       This is the regression CRITICAL-1 in the review fixes: before that
       fix, ensureShopOwnedSite called ensureMessengerSite(shopProfileId
       (domain), ...) directly, which only ever looks inside the shop
       profile's OWN (now-empty) workspace, misses, then finds this row via
       findSiteByDomain owned by 'user_1', fails the owner check, and throws
       StoreOwnedByAnotherAccountError at the store's actual owner on every
       later open. */
    const { client, tables } = stubClient({
      profiles: { rows: [] },
      workspaces: { rows: [] },
      widget_sites: {
        rows: [
          {
            id: 's-claimed',
            workspace_id: 'w-real',
            domain: 'demo.myshopify.com',
            name: 'demo.myshopify.com',
            embed_key: 'gc_claimed',
            status: 'active',
            settings_json: {},
            settings_version: 2,
            settings_draft: null,
            // Mirrors the PostgREST embed findSiteByDomain reads through.
            workspaces: { profiles: { clerk_user_id: 'user_1' } },
          },
        ],
      },
    });
    setMessengerServiceClientForTests(client);
    await useRealImplementations();

    const site = await ensureShopOwnedSite('demo.myshopify.com');

    expect(site.id).toBe('s-claimed');
    // The claimed row is handed back untouched, not duplicated or moved.
    expect(tables.widget_sites.rows).toHaveLength(1);
    expect(tables.widget_sites.rows[0].workspace_id).toBe('w-real');
  });
});
