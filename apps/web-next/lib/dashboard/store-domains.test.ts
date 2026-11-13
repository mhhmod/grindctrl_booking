// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ from: vi.fn(), calls: [] as Array<{ table: string; method: string; args: unknown[] }> }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/messenger/db', () => ({ getMessengerServiceClient: () => ({ from: m.from }) }));

import { adoptStoreNameFromAddress, listSiteStoreDomains } from './store-domains';
import { isPlaceholderStoreName, storeDisplayName, storeHost, storeNameFromAddress } from './store-name';

const SITE_SHOP = '11111111-1111-4111-8111-111111111111';
const SITE_WEB = '22222222-2222-4222-8222-222222222222';
const SITE_NONE = '33333333-3333-4333-8333-333333333333';

/** A chainable PostgREST query that records every call and resolves to `result`. */
function query(table: string, result: unknown) {
  const chain: Record<string, unknown> = {};
  for (const method of ['select', 'update', 'in', 'eq', 'not', 'or', 'order', 'limit']) {
    chain[method] = (...args: unknown[]) => { m.calls.push({ table, method, args }); return chain; };
  }
  chain.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject);
  return chain;
}

beforeEach(() => {
  m.calls.length = 0;
  m.from.mockReset();
});

describe('store names', () => {
  it('treats only an empty name or the provisioning placeholder as not named yet', () => {
    for (const name of [null, undefined, '', '  ', 'My store', ' my STORE ']) expect(isPlaceholderStoreName(name)).toBe(true);
    for (const name of ['Harmong', 'My store 2', 'متجري']) expect(isPlaceholderStoreName(name)).toBe(false);
  });

  it('reads a store name from its address without the scheme, www or the myshopify suffix', () => {
    expect(storeNameFromAddress('harmong-eg.myshopify.com')).toBe('harmong-eg');
    expect(storeNameFromAddress('https://www.Maison.example/collections?x=1')).toBe('maison.example');
    expect(storeNameFromAddress('shop.maison.example:443')).toBe('shop.maison.example');
    expect(storeHost('HTTPS://Harmong-EG.myshopify.com./')).toBe('harmong-eg.myshopify.com');
    for (const bad of [null, '', '   ', 'not a host', '<script>']) expect(storeNameFromAddress(bad)).toBeNull();
  });

  it('prefers the name the merchant typed over the address', () => {
    expect(storeDisplayName('Harmong', 'harmong-eg.myshopify.com')).toBe('Harmong');
    expect(storeDisplayName('My store', 'harmong-eg.myshopify.com')).toBe('harmong-eg');
    expect(storeDisplayName('My store', null)).toBeNull();
  });
});

describe('listSiteStoreDomains', () => {
  it('uses a paired WooCommerce address even before a widget domain is verified', async () => {
    m.from.mockImplementation((table: string) => query(table, { data: table === 'woo_site_connections'
      ? [{ widget_site_id: SITE_WEB, home_url: 'https://shop.woo.example/store/' }] : [], error: null }));
    expect([...(await listSiteStoreDomains([SITE_WEB]))]).toEqual([[SITE_WEB, 'shop.woo.example']]);
    expect(m.calls).toContainEqual({ table: 'woo_site_connections', method: 'eq', args: ['status', 'active'] });
  });
  it('finds a pasted store by its Shopify shop first, then by its first confirmed address', async () => {
    m.from.mockImplementation((table: string) => query(table, table === 'paste_site_connections'
      ? { data: [{ widget_site_id: SITE_SHOP, shop_domain: 'harmong-eg.myshopify.com' }], error: null }
      : { data: [
        { widget_site_id: SITE_SHOP, domain: 'harmong.example' },
        { widget_site_id: SITE_WEB, domain: 'www.maison.example' },
        { widget_site_id: SITE_WEB, domain: 'second.example' },
      ], error: null }));
    expect([...(await listSiteStoreDomains([SITE_SHOP, SITE_WEB, SITE_NONE]))]).toEqual([
      [SITE_SHOP, 'harmong-eg.myshopify.com'], [SITE_WEB, 'www.maison.example'],
    ]);
    // Only live connections and addresses that are verified or trusted name a store.
    expect(m.calls).toContainEqual({ table: 'paste_site_connections', method: 'in', args: ['status', ['active', 'pending']] });
    expect(m.calls).toContainEqual({ table: 'widget_domains', method: 'in', args: ['verification_status', ['verified', 'trusted']] });
  });

  it('reads nothing for no sites, and never throws when a read fails or its table is missing', async () => {
    expect((await listSiteStoreDomains([])).size).toBe(0);
    expect(m.from).not.toHaveBeenCalled();
    m.from.mockImplementation((table: string) => query(table, { data: null, error: { code: '42P01' } }));
    expect((await listSiteStoreDomains([SITE_SHOP])).size).toBe(0);
    m.from.mockImplementation(() => { throw new Error('db down'); });
    expect((await listSiteStoreDomains([SITE_SHOP])).size).toBe(0);
  });
});

describe('adoptStoreNameFromAddress', () => {
  it('names the site after its address only while it still has the placeholder name', async () => {
    m.from.mockImplementation((table: string) => query(table, { error: null }));
    await adoptStoreNameFromAddress(SITE_SHOP, 'harmong-eg.myshopify.com');
    expect(m.calls).toEqual([
      { table: 'widget_sites', method: 'update', args: [{ name: 'harmong-eg' }] },
      { table: 'widget_sites', method: 'eq', args: ['id', SITE_SHOP] },
      // The guard is part of the write: a name typed meanwhile is never overwritten.
      { table: 'widget_sites', method: 'or', args: ['name.is.null,name.in.("","My store")'] },
    ]);
  });

  it('writes nothing without a usable address, and never throws', async () => {
    await adoptStoreNameFromAddress(SITE_SHOP, null);
    await adoptStoreNameFromAddress(SITE_SHOP, 'not a host');
    expect(m.from).not.toHaveBeenCalled();
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    m.from.mockImplementation(() => { throw new Error('db down'); });
    await expect(adoptStoreNameFromAddress(SITE_SHOP, 'maison.example')).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith('[store name] not adopted', { code: 'store_name_adopt_failed', site: SITE_SHOP });
    log.mockRestore();
  });
});
