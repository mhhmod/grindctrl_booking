// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ site: vi.fn(), woo: vi.fn(), page: vi.fn(), rpc: vi.fn(), claim: vi.fn(), or: vi.fn(), limit: vi.fn(), due: [] as Array<{ id: string; embed_key: string }>, domains: [] as Array<{ domain: string; platform_detected: string }>, claimed: true }));
vi.mock('./public-api', () => ({ loadPublicSite: m.site }));
vi.mock('@/lib/woo/active-connection', () => ({ loadActiveWooConnection: m.woo }));
vi.mock('@/lib/paste/storefront-scan', () => ({ fetchPublicPage: m.page }));
vi.mock('./db', () => ({ getMessengerServiceClient: () => ({ rpc: m.rpc, from: (table: string) => {
  let writing = false;
  const builder = { select: () => builder, update: (patch: unknown) => { writing = true; m.claim(patch); return builder; }, eq: () => builder,
    or: (filter: string) => { m.or(filter); return builder; }, order: () => builder, limit: (limit: number) => { m.limit(limit); return builder; },
    then: (resolve: (r: unknown) => unknown) => resolve({ data: table === 'widget_domains' ? m.domains : writing ? m.claimed ? [{ id: 'site' }] : [] : m.due, error: null }) };
  return builder;
} }) }));
import { refreshDueProducts, syncSiteProducts } from './products';
const site = { id: 'site', embed_key: 'key', domain: 'shop.myshopify.com', patterns: [], pasteShopDomain: null };
beforeEach(() => {
  vi.clearAllMocks(); m.claimed = true; m.due = []; m.domains = [];
  m.site.mockResolvedValue(site); m.woo.mockResolvedValue(null); m.rpc.mockResolvedValue({ error: null });
  m.page.mockResolvedValue({ url: 'https://shop.myshopify.com/products.json', contentType: 'application/json', body: Buffer.from(JSON.stringify({ products: [{ title: 'Dress', handle: 'dress', variants: [{ title: 'M', price: '20.00', available: true }] }] })) });
});
describe('catalogue storage and scheduling', () => {
  it('writes one bounded product per row via the atomic replacement RPC', async () => {
    expect(await syncSiteProducts(site)).toEqual({ count: 1 });
    expect(m.page).toHaveBeenCalledWith('https://shop.myshopify.com/products.json?limit=250&page=1', expect.objectContaining({ timeoutMs: 10_000, maxBytes: 2 * 1024 * 1024 }));
    expect(m.rpc).toHaveBeenCalledWith('messenger_replace_products', { p_site: 'site', p_lease: expect.any(String), p_products: [expect.objectContaining({ title: 'Dress', sizes: ['M'], url: 'https://shop.myshopify.com/products/dress' })] });
  });
  it('records what a refresh found, so the store can say it', async () => {
    await syncSiteProducts(site);
    expect(m.claim).toHaveBeenLastCalledWith({ products_sync_result: { outcome: 'ok', count: 1, at: expect.any(String) } });
  });
  it.each([
    ['a password page', { url: 'https://shop.myshopify.com/password', contentType: 'text/html', body: Buffer.from('<html>') }, 'password_page'],
    ['a 404', { failure: 'status', status: 404 }, 'not_found'],
    ['a 429', { failure: 'status', status: 429 }, 'rate_limited'],
    ['a timeout', { failure: 'timeout' }, 'unreachable'],
  ])('records %s as %s and keeps the old catalogue', async (_name, page, outcome) => {
    m.page.mockResolvedValue(page);
    await expect(syncSiteProducts(site)).rejects.toThrow();
    expect(m.rpc).not.toHaveBeenCalled();
    expect(m.claim).toHaveBeenLastCalledWith({ products_sync_result: { outcome, count: 0, at: expect.any(String) } });
  });
  it('clears the record for a site with no catalogue to read', async () => {
    m.site.mockResolvedValue({ ...site, domain: null });
    await syncSiteProducts(site);
    expect(m.claim).toHaveBeenLastCalledWith({ products_sync_result: null });
  });
  it('supports detected WooCommerce paste domains and uses only trusted hosts', async () => {
    m.site.mockResolvedValue({ ...site, domain: null, patterns: [{ pattern: 'woo.example', verification_status: 'trusted', verification_method: 'paste_snippet', environment: 'production' }] });
    m.domains = [{ domain: 'woo.example', platform_detected: 'woocommerce' }];
    m.page.mockResolvedValue({ url: 'https://woo.example/wp-json/wc/store/v1/products', contentType: 'application/json', body: Buffer.from('[]') });
    expect(await syncSiteProducts(site)).toEqual({ count: 0 });
    expect(m.page).toHaveBeenCalledWith('https://woo.example/wp-json/wc/store/v1/products?per_page=100&page=1', expect.any(Object));
  });
  it('supports paired WooCommerce without any private API credentials', async () => {
    m.site.mockResolvedValue({ ...site, domain: 'woo.example' }); m.woo.mockResolvedValue({ homeUrl: 'https://woo.example' });
    m.page.mockResolvedValue({ url: 'https://woo.example', contentType: 'application/json', body: Buffer.from('[]') });
    await syncSiteProducts(site);
    expect(m.page.mock.calls[0][0]).toContain('/wp-json/wc/store/v1/products');
    expect(m.page.mock.calls[0][1]).not.toHaveProperty('headers.authorization');
  });
  it('keeps the old catalogue on fetch failure and refuses concurrent attempts', async () => {
    m.page.mockResolvedValue({ failure: 'timeout' });
    await expect(syncSiteProducts(site)).rejects.toThrow('timeout'); expect(m.rpc).not.toHaveBeenCalled();
    m.claimed = false; m.page.mockClear(); await expect(syncSiteProducts(site)).rejects.toThrow('already running'); expect(m.page).not.toHaveBeenCalled();
  });
  it('skips other websites and removes their stale product grounding', async () => {
    m.site.mockResolvedValue({ ...site, domain: null });
    expect(await syncSiteProducts(site)).toEqual({ count: 0, skipped: true }); expect(m.page).not.toHaveBeenCalled();
    expect(m.rpc).toHaveBeenCalledWith('messenger_replace_products', expect.objectContaining({ p_products: [] }));
  });
  it('selects at most 3 sites due since yesterday, stamps attempts and continues past a failed site', async () => {
    m.due = [{ id: 'site', embed_key: 'key' }, { id: 'site', embed_key: 'key' }];
    m.page.mockResolvedValueOnce({ failure: 'network' });
    expect(await refreshDueProducts()).toEqual({ processed: 2, failed: 1 }); expect(m.limit).toHaveBeenCalledWith(3);
    expect(m.or).toHaveBeenCalledWith(expect.stringContaining('products_sync_attempted_at.lt.'));
    // Each attempt takes the lease, then records what it found.
    expect(m.claim).toHaveBeenCalledTimes(4);
  });
});
