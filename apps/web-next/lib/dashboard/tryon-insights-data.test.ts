// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  entitlement: vi.fn(),
  token: vi.fn(),
  graphql: vi.fn(),
  jobs: [] as unknown[],
  calls: [] as Array<[string, ...unknown[]]>,
  error: null as { code?: string; message: string } | null,
}));

vi.mock('@/lib/try-on/entitlement', () => ({ getShopEntitlement: mocks.entitlement }));
vi.mock('@/lib/shopify/tokens', () => ({ getShopToken: mocks.token }));
vi.mock('@/lib/shopify/admin', () => ({ adminGraphql: mocks.graphql }));
vi.mock('@/lib/messenger/db', () => {
  class Query {
    private selected = '';
    private filters: Array<[string, unknown]> = [];
    constructor(readonly table: string) {}
    select(columns: string) { this.selected = columns; mocks.calls.push(['select', this.table, columns]); return this; }
    eq(column: string, value: unknown) { this.filters.push([column, value]); mocks.calls.push(['eq', column, value]); return this; }
    gte(column: string, value: unknown) { mocks.calls.push(['gte', column, value]); return this; }
    order() { return this; }
    limit() { return this; }
    then(resolve: (value: unknown) => unknown) {
      if (mocks.error?.message.includes('product_') && this.selected.includes('product_title')) return Promise.resolve({ data: null, error: mocks.error }).then(resolve);
      const testFilter = this.filters.some(([column]) => column === 'is_test');
      if (mocks.error && !mocks.error.message.includes('product_') && testFilter) return Promise.resolve({ data: null, error: mocks.error }).then(resolve);
      return Promise.resolve({ data: mocks.jobs, error: null }).then(resolve);
    }
  }
  return { getMessengerServiceClient: () => ({ from: (table: string) => new Query(table) }) as unknown as SupabaseClient };
});

import { getTryOnResultsFacts } from './tryon-insights-data';

const NOW = Date.parse('2026-10-22T12:00:00Z');
const SHOP = 'maison.myshopify.com';
const daysAgo = (days: number) => new Date(NOW - days * 86_400_000).toISOString();
const job = (product_id: string, days: number, status = 'completed') => ({ product_id, status, duration_ms: 12_000, message: null, created_at: daysAgo(days) });

beforeEach(() => {
  vi.resetAllMocks();
  mocks.calls = [];
  mocks.error = null;
  mocks.jobs = [job('layla-abaya', 1), job('layla-abaya', 2), job('linen-overshirt', 3, 'failed')];
  mocks.entitlement.mockResolvedValue({ available: true });
  mocks.token.mockResolvedValue({ accessToken: 'shpat_test' });
  mocks.graphql.mockResolvedValue({
    products: {
      nodes: [
        { handle: 'layla-abaya', title: 'Layla Embroidered Abaya', featuredMedia: { image: { url: 'https://cdn.shopify.com/layla.jpg' } } },
        { handle: 'linen-overshirt', title: 'Linen Overshirt', featuredMedia: { image: { url: 'http://example.com/x.jpg' } } },
      ],
    },
  });
});

describe('getTryOnResultsFacts', () => {
  it('reads this shop’s looks over two periods, without test looks, and names them from the store', async () => {
    const facts = await getTryOnResultsFacts({ shop: SHOP, period: 30, now: NOW });
    expect(mocks.calls).toEqual(
      expect.arrayContaining([
        ['select', 'tryon_jobs', 'product_id, status, duration_ms, message, created_at'],
        ['eq', 'shop', SHOP],
        ['gte', 'created_at', daysAgo(60)],
        ['eq', 'is_test', false],
      ]),
    );
    expect(facts).toMatchObject({ now: NOW, period: 30, live: true });
    expect(facts.jobs).toHaveLength(3);
    expect(mocks.graphql.mock.calls[0][0]).toMatchObject({
      shopDomain: SHOP,
      accessToken: 'shpat_test',
      variables: { query: "handle:'layla-abaya' OR handle:'linen-overshirt'", first: 2 },
    });
    expect(facts.products).toEqual({
      'layla-abaya': { title: 'Layla Embroidered Abaya', imageUrl: 'https://cdn.shopify.com/layla.jpg' },
      'linen-overshirt': { title: 'Linen Overshirt', imageUrl: null },
    });
  });

  it('reads a WooCommerce store’s looks under its site tenant and names no product it cannot', async () => {
    const key = 'site:11111111-1111-4111-8111-111111111111';
    const facts = await getTryOnResultsFacts({ shop: key, period: 30, now: NOW });
    expect(mocks.calls).toEqual(expect.arrayContaining([['eq', 'shop', key]]));
    expect(mocks.entitlement).toHaveBeenCalledWith(key);
    expect(mocks.token).not.toHaveBeenCalled();
    expect(mocks.graphql).not.toHaveBeenCalled();
    expect(facts.products).toEqual({});
    expect(facts.jobs).toHaveLength(3);
  });

  it('uses the newest stored product snapshot for site tenants, with legacy id fallback', async () => {
    const key = 'site:11111111-1111-4111-8111-111111111111';
    mocks.jobs = [
      { ...job('14', 2), product_title: 'Old', product_image_url: 'https://shop.example/old.jpg' },
      job('15', 0), job('14', 0),
      { ...job('linen-tee', 1), product_image_url: 'https://shop.example/tee.jpg' },
      { ...job('linen-tee', 2), product_title: 'Store tee' },
      { ...job('14', 1), product_title: 'New title', product_image_url: 'https://shop.example/new.jpg' },
    ];
    const facts = await getTryOnResultsFacts({ shop: key, period: 30, now: NOW });
    expect(facts.products).toEqual({ '14': { title: 'New title', imageUrl: 'https://shop.example/new.jpg' }, 'linen-tee': { title: 'Store tee', imageUrl: 'https://shop.example/tee.jpg' } });
    expect(facts.products['15']).toBeUndefined();
    expect(mocks.graphql).not.toHaveBeenCalled();
  });

  it('reads again without the test-look filter before the column exists', async () => {
    mocks.error = { code: '42703', message: 'column tryon_jobs.is_test does not exist' };
    const facts = await getTryOnResultsFacts({ shop: SHOP, period: 7, now: NOW });
    expect(facts.jobs).toHaveLength(3);
    expect(mocks.calls.filter(([kind]) => kind === 'select')).toHaveLength(2);
  });

  it('never puts a handle that is not one into the product search', async () => {
    mocks.jobs = [job("x' OR title:*", 1), job('layla-abaya', 1)];
    await getTryOnResultsFacts({ shop: SHOP, period: 30, now: NOW });
    expect(mocks.graphql.mock.calls[0][0].variables).toEqual({ query: "handle:'layla-abaya'", first: 1 });
  });

  it('leaves the badge and the titles out when they cannot be read, and fails when the looks cannot', async () => {
    mocks.entitlement.mockRejectedValue(new Error('down'));
    mocks.graphql.mockRejectedValue(new Error('throttled'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const facts = await getTryOnResultsFacts({ shop: SHOP, period: 30, now: NOW });
    expect(facts.live).toBeNull();
    expect(facts.products).toEqual({});

    mocks.token.mockResolvedValue(null);
    mocks.graphql.mockClear();
    await getTryOnResultsFacts({ shop: SHOP, period: 30, now: NOW });
    expect(mocks.graphql).not.toHaveBeenCalled();

    mocks.error = { message: 'connection refused' };
    await expect(getTryOnResultsFacts({ shop: SHOP, period: 30, now: NOW })).rejects.toThrow('connection refused');
  });
});

it.each(['42703', 'PGRST204'])('reads legacy site jobs before the product columns exist (%s)', async (code) => {
  mocks.error = { code, message: 'column tryon_jobs.product_title does not exist' };
  const facts = await getTryOnResultsFacts({ shop: 'site:11111111-1111-4111-8111-111111111111', period: 30, now: NOW });
  expect(facts.jobs).toHaveLength(3); expect(facts.products).toEqual({});
  expect(mocks.calls).toContainEqual(['select', 'tryon_jobs', 'product_id, status, duration_ms, message, created_at']);
});
