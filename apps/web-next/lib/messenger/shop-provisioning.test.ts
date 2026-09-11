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
        upsert: (row: Row, opts?: { onConflict?: string; ignoreDuplicates?: boolean }) => {
          calls.push(`${table}.upsert`);
          // Mirrors real supabase-js/PostgREST: .select() chained onto .upsert()
          // returns the row in the same round trip when this connection actually
          // wrote it, and null when ON CONFLICT DO NOTHING skipped the write. A
          // bare `await upsert(...)` (no .select()) still resolves via `then`.
          const conflictCols = opts?.onConflict?.split(',') ?? [];
          const existing = conflictCols.length
            ? state.rows.find((r) => conflictCols.every((c) => r[c] === row[c]))
            : undefined;
          let resultData: Row | null;
          if (existing) {
            resultData = opts?.ignoreDuplicates ? null : (Object.assign(existing, row), existing);
          } else {
            resultData = { id: `${table}-${state.rows.length + 1}`, ...row };
            state.rows.push(resultData);
          }
          const upsertApi: Record<string, unknown> = {
            select: () => upsertApi,
            maybeSingle: () => Promise.resolve({ data: resultData, error: null }),
            then: (resolve: (v: unknown) => unknown) =>
              Promise.resolve({ data: resultData, error: null }).then(resolve),
          };
          return upsertApi;
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

    // Mirrors bootstrap_profile/bootstrap_workspace (see provisioning.test.ts's
    // own copy of this mock, kept alongside since this file's stub is otherwise
    // independent of it).
    function rpc(fn: string, params: Record<string, unknown>) {
      calls.push(`rpc.${fn}`);
      if (fn === 'bootstrap_profile') {
        const state = tables.profiles;
        const clerkUserId = params.p_clerk_user_id as string;
        const suffix = params.p_placeholder_suffix as string;
        const incomingEmail = params.p_email as string;
        const existing = state.rows.find((row) => row.clerk_user_id === clerkUserId);
        if (existing) {
          const existingIsPlaceholder = String(existing.email).endsWith(suffix);
          const incomingIsPlaceholder = incomingEmail.endsWith(suffix);
          if (!incomingIsPlaceholder && existingIsPlaceholder) existing.email = incomingEmail;
          return Promise.resolve({ data: { ...existing }, error: null });
        }
        const inserted = { id: `profiles-${state.rows.length + 1}`, clerk_user_id: clerkUserId, email: incomingEmail };
        state.rows.push(inserted);
        return Promise.resolve({ data: inserted, error: null });
      }
      if (fn === 'bootstrap_workspace') {
        const state = tables.workspaces;
        const ownerProfileId = params.p_owner_profile_id as string;
        const slug = params.p_slug as string;
        const [existing] = state.rows
          .filter((row) => row.owner_profile_id === ownerProfileId)
          .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
        if (existing) return Promise.resolve({ data: { id: existing.id }, error: null });
        const inserted = {
          id: `workspaces-${state.rows.length + 1}`,
          owner_profile_id: ownerProfileId,
          slug,
          created_at: new Date().toISOString(),
        };
        state.rows.push(inserted);
        return Promise.resolve({ data: { id: inserted.id }, error: null });
      }
      return Promise.resolve({ data: null, error: { message: `unmocked rpc: ${fn}` } });
    }

    return {
      client: { from: (table: string) => builder(table), rpc } as unknown as SupabaseClient,
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
