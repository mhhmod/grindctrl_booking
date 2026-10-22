// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { setMessengerServiceClientForTests } from '@/lib/messenger/db';
import {
  ALWAYS_ON,
  clearStoreFlagCache,
  flagStoreForSite,
  isStoreFlagOn,
  storeExists,
  storeFlagRows,
  storeFlags,
  writeStoreFlag,
} from './store-flags';

type Result = { data: unknown; error: { code?: string; message?: string } | null };

/* A stand-in for the few PostgREST calls the flag store makes. Each query
   records its table and filters, and answers from `answer`. */
type SeenQuery = { table: string; filters: Array<[string, unknown]> };

function fakeClient(answer: (query: SeenQuery) => Result) {
  const queries: Query[] = [];
  const upserts: Array<{ row: Record<string, unknown>; onConflict?: string }> = [];
  class Query {
    filters: Array<[string, unknown]> = [];
    constructor(readonly table: string) {}
    select() { return this; }
    eq(column: string, value: unknown) { this.filters.push([column, value]); return this; }
    limit() { return this; }
    async maybeSingle() { queries.push(this); return answer(this); }
    then(resolve: (value: Result) => unknown, reject?: (reason: unknown) => unknown) {
      queries.push(this);
      return Promise.resolve(answer(this)).then(resolve, reject);
    }
  }
  const client = {
    from(table: string) {
      const query = new Query(table);
      return Object.assign(query, {
        upsert: async (row: Record<string, unknown>, options?: { onConflict?: string }) => {
          upserts.push({ row, onConflict: options?.onConflict });
          return { error: null };
        },
      });
    },
  };
  return { client: client as unknown as SupabaseClient, queries, upserts };
}

const SHOP = { shopDomain: 'maison.myshopify.com' };
const SITE = { widgetSiteId: '11111111-1111-4111-8111-111111111111' };
const NOW = Date.parse('2026-10-16T12:00:00Z');

describe('store flags', () => {
  let restore: () => void = () => {};
  beforeEach(() => clearStoreFlagCache());
  afterEach(() => restore());

  function use(answer: (query: SeenQuery) => Result) {
    const fake = fakeClient(answer);
    restore = setMessengerServiceClientForTests(fake.client);
    return fake;
  }

  it('reports the known flags that are on, and ignores names the code does not know', async () => {
    const fake = use(() => ({
      data: [{ flag: 'n24_assistant_down' }, { flag: 'n99_typo' }, { flag: 'n23_after_hours' }],
      error: null,
    }));
    expect(await storeFlags(SHOP, NOW)).toEqual(['n23_after_hours', 'n24_assistant_down', ...ALWAYS_ON]);
    expect(fake.queries[0].filters).toEqual([
      ['shop_domain', 'maison.myshopify.com'],
      ['enabled', true],
    ]);
  });

  it('keys a Store Chat site on another website by its own id', async () => {
    const fake = use(() => ({ data: [{ flag: 'n23_after_hours' }], error: null }));
    expect(await isStoreFlagOn(SITE, 'n23_after_hours', NOW)).toBe(true);
    expect(fake.queries[0].filters[0]).toEqual(['widget_site_id', SITE.widgetSiteId]);
  });

  it('caches for a minute, then reads again', async () => {
    const fake = use(() => ({ data: [{ flag: 'n23_after_hours' }], error: null }));
    await storeFlags(SHOP, NOW);
    await storeFlags(SHOP, NOW + 59_000);
    expect(fake.queries).toHaveLength(1);
    await storeFlags(SHOP, NOW + 60_001);
    expect(fake.queries).toHaveLength(2);
  });

  it('fails closed on a database error and does not cache it', async () => {
    let fail = true;
    const fake = use(() =>
      fail ? { data: null, error: { code: '08006', message: 'connection lost' } } : { data: [{ flag: 'n23_after_hours' }], error: null },
    );
    expect(await storeFlags(SHOP, NOW)).toEqual(ALWAYS_ON);
    fail = false;
    expect(await storeFlags(SHOP, NOW + 1)).toEqual(['n23_after_hours', ...ALWAYS_ON]);
    expect(fake.queries).toHaveLength(2);
  });

  it('answers only the always-on flags until the table exists, without asking on every request', async () => {
    const fake = use(() => ({ data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.store_flags' in the schema cache" } }));
    expect(await storeFlags(SHOP, NOW)).toEqual(ALWAYS_ON);
    expect(await storeFlags(SHOP, NOW + 1000)).toEqual(ALWAYS_ON);
    expect(fake.queries).toHaveLength(1);
  });

  it('never asks about a malformed store', async () => {
    const fake = use(() => ({ data: [{ flag: 'n23_after_hours' }], error: null }));
    expect(await storeFlags({ shopDomain: 'maison.com' }, NOW)).toEqual(ALWAYS_ON);
    expect(await storeFlags({ widgetSiteId: 'not-a-uuid' }, NOW)).toEqual(ALWAYS_ON);
    expect(fake.queries).toHaveLength(0);
  });

  it('treats a Store Chat site on a Shopify store as that shop', () => {
    expect(flagStoreForSite({ id: SITE.widgetSiteId, domain: 'Maison.myshopify.com' })).toEqual(SHOP);
    expect(flagStoreForSite({ id: SITE.widgetSiteId, domain: 'maison.com' })).toEqual(SITE);
    expect(flagStoreForSite({ id: SITE.widgetSiteId, domain: null })).toEqual(SITE);
  });

  it('writes one row per store and flag, and reads fresh afterwards', async () => {
    let on = false;
    const fake = use(() => ({ data: on ? [{ flag: 'n23_after_hours' }] : [], error: null }));
    expect(await storeFlags(SHOP, NOW)).toEqual(ALWAYS_ON);

    on = true;
    await writeStoreFlag(SHOP, 'n23_after_hours', true, 'user_operator');
    expect(fake.upserts[0]).toMatchObject({
      row: { shop_domain: 'maison.myshopify.com', flag: 'n23_after_hours', enabled: true, updated_by: 'user_operator' },
      onConflict: 'shop_domain,flag',
    });
    expect(await storeFlags(SHOP, NOW + 1)).toEqual(['n23_after_hours', ...ALWAYS_ON]);
  });

  it('turns the v16 screens and team invites on for every store, and leaves them off the switches', async () => {
    use(() => ({ data: [{ flag: 'n5_preview_mode' }], error: null }));
    expect(ALWAYS_ON).toEqual(['n21_team_invites', 'v16_dashboard', 'v16_tryon', 'v16_chat']);
    expect(await storeFlags(SHOP, NOW)).toEqual(['n5_preview_mode', ...ALWAYS_ON]);
    const rows = await storeFlagRows(SHOP);
    expect(rows.some((row) => (ALWAYS_ON as string[]).includes(row.flag))).toBe(false);
    expect(rows.find((row) => row.flag === 'n5_preview_mode')?.enabled).toBe(true);
  });

  it('refuses to write a flag the code does not know', async () => {
    use(() => ({ data: [], error: null }));
    await expect(writeStoreFlag(SHOP, 'n99_typo' as never, true, 'user_operator')).rejects.toThrow();
  });

  it('knows a store only when the app does', async () => {
    use((query) => {
      const value = query.filters[0]?.[1];
      if (query.table === 'widget_sites' && value === SITE.widgetSiteId) return { data: { id: value }, error: null };
      if (query.table === 'tryon_shops' && value === 'maison.myshopify.com') return { data: { shop_domain: value }, error: null };
      if (query.table === 'widget_sites' && value === 'chat-only.myshopify.com') return { data: { id: 'x' }, error: null };
      return { data: null, error: null };
    });
    expect(await storeExists(SITE)).toBe(true);
    expect(await storeExists(SHOP)).toBe(true);
    expect(await storeExists({ shopDomain: 'chat-only.myshopify.com' })).toBe(true);
    expect(await storeExists({ shopDomain: 'stranger.myshopify.com' })).toBe(false);
    expect(await storeExists({ widgetSiteId: '22222222-2222-4222-8222-222222222222' })).toBe(false);
  });
});
