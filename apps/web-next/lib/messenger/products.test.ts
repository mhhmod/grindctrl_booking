// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchCatalogue, parseCataloguePage } from './products';
import type { StorefrontLookup, StorefrontResponse, StorefrontTransport } from '@/lib/paste/storefront-scan';

const trusted = (url: URL) => url.hostname === 'shop.example';
const woo = { id: 1, name: 'عباية', permalink: 'https://shop.example/abaya', short_description: '<b>Linen</b>', is_in_stock: false, prices: { price: '125050', currency_code: 'EGP', currency_minor_unit: 2 }, attributes: [{ name: 'Size', terms: [{ name: 'M' }, { name: 'L' }] }] };
const shopify = { title: 'Linen abaya', handle: 'abaya', body_html: '<p>Soft linen</p>', variants: [{ title: 'M', price: '1250.50', available: true }] };
const lookup: StorefrontLookup = async () => [{ address: '93.184.216.34', family: 4 }];
const response = (raw: unknown, extra: Partial<StorefrontResponse> = {}): StorefrontResponse => ({ status: 200, location: null, contentType: 'application/json', setCookie: [], body: Buffer.from(JSON.stringify(raw)), ...extra });
afterEach(() => vi.useRealTimers());

describe('public catalogue sync', () => {
  it('parses Woo Store API money units, stock, sizes and plain description', () => {
    expect(parseCataloguePage([woo], 'woocommerce', 'https://shop.example', trusted)).toEqual({ count: 1, products: [expect.objectContaining({ title: 'عباية', price: '1250.50', currency: 'EGP', availability: 'out_of_stock', description: 'Linen', sizes: ['M', 'L'] })] });
  });
  it('parses products.json without inventing a missing currency', () => {
    expect(parseCataloguePage({ products: [shopify] }, 'shopify', 'https://shop.example', trusted).products[0]).toMatchObject({ url: 'https://shop.example/products/abaya', price: '1250.50', currency: null, availability: 'in_stock' });
  });
  it('skips foreign product URLs and rejects invalid page shapes', () => {
    expect(parseCataloguePage([{ ...woo, permalink: 'https://evil.example/' }], 'woocommerce', 'https://shop.example', trusted).products).toEqual([]);
    expect(() => parseCataloguePage({ error: 'bad' }, 'shopify', 'https://shop.example', trusted)).toThrow('Invalid catalogue');
  });
  it.each(['woocommerce', 'shopify'] as const)('stops %s at 500 and uses the pinned, capped HTTPS transport', async (platform) => {
    const transport = vi.fn<StorefrontTransport>(async ({ url, address, truncateAt, signal }) => {
      expect(address).toBe('93.184.216.34'); expect(truncateAt).toBe(2 * 1024 * 1024); expect(signal.aborted).toBe(false);
      const page = Number(url.searchParams.get('page')), n = platform === 'woocommerce' ? 100 : 250;
      const rows = Array.from({ length: n }, (_, i) => platform === 'woocommerce' ? { ...woo, permalink: `https://shop.example/p/${page}-${i}` } : { ...shopify, handle: `${page}-${i}` });
      return response(platform === 'woocommerce' ? rows : { products: rows });
    });
    expect(await fetchCatalogue(platform, 'https://shop.example', trusted, { transport, lookup })).toHaveLength(500);
    expect(transport).toHaveBeenCalledTimes(platform === 'woocommerce' ? 5 : 2);
  });
  it.each(['10.0.0.1', '169.254.169.254', '::1'])('refuses private DNS answer %s', async (address) => {
    const transport = vi.fn<StorefrontTransport>();
    await expect(fetchCatalogue('woocommerce', 'https://shop.example', trusted, { transport, lookup: async () => [{ address, family: address.includes(':') ? 6 : 4 }] })).rejects.toThrow('private_address');
    expect(transport).not.toHaveBeenCalled();
  });
  it('rejects HTTP and foreign redirects before connecting to the redirected host', async () => {
    const transport = vi.fn<StorefrontTransport>(async () => response([], { status: 302, location: 'https://foreign.example/' }));
    await expect(fetchCatalogue('woocommerce', 'http://shop.example', trusted, { transport, lookup })).rejects.toThrow('bad_url');
    await expect(fetchCatalogue('woocommerce', 'https://shop.example', trusted, { transport, lookup })).rejects.toThrow('foreign_redirect');
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it('bounds redirects, pages and body size', async () => {
    const transport = vi.fn<StorefrontTransport>(async () => response([], { status: 302, location: '/again' }));
    await expect(fetchCatalogue('shopify', 'https://shop.example', trusted, { transport, lookup })).rejects.toThrow('too_many_redirects');
    expect(transport).toHaveBeenCalledTimes(5);
    await expect(fetchCatalogue('shopify', 'https://shop.example', trusted, { transport: async () => response([], { body: Buffer.alloc(2 * 1024 * 1024) }), lookup })).rejects.toThrow('oversized');
  });
  it('names a password-protected store, however its password page is served', async () => {
    const page = '<form action="/password" method="post"><input type="password" name="password"></form>';
    const html = (extra: Partial<StorefrontResponse> = {}) => ({ status: 200, location: null, contentType: 'text/html', setCookie: [], body: Buffer.from(page), ...extra });
    // Shopify redirects /products.json to /password.
    const redirected = vi.fn<StorefrontTransport>(async ({ url }) => url.pathname === '/password' ? html() : response([], { status: 302, location: '/password' }));
    await expect(fetchCatalogue('shopify', 'https://shop.example', trusted, { transport: redirected, lookup })).rejects.toMatchObject({ outcome: 'password_page' });
    await expect(fetchCatalogue('shopify', 'https://shop.example', trusted, { transport: async () => html(), lookup })).rejects.toMatchObject({ outcome: 'password_page' });
  });
  /* The owner's store: password protected, and What it knows said "We
     couldn't reach your store". Any status but 2xx was dropped before the
     page could be looked at, so a password page served with 401 or 403 (the
     storefront check reads both) became an outage. */
  it.each([401, 403])('names a password-protected store whose password page is served with %s, not an unreachable one', async (status) => {
    const page = '<form action="/password" method="post"><input type="password" name="password"></form>';
    const transport = vi.fn<StorefrontTransport>(async () => ({ status, location: null, contentType: 'text/html', setCookie: [], body: Buffer.from(page) }));
    await expect(fetchCatalogue('shopify', 'https://shop.example', trusted, { transport, lookup })).rejects.toMatchObject({ outcome: 'password_page' });
    // The page itself said so: no second request.
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it('asks the store\'s home page once when the catalogue is refused without a reason, and names the password page it finds', async () => {
    const page = '<form action="/password" method="post"><input type="password" name="password"></form>';
    const transport = vi.fn<StorefrontTransport>(async ({ url }) => url.pathname === '/products.json'
      ? response({ errors: 'Not allowed' }, { status: 403 })
      : url.pathname === '/password' ? { status: 200, location: null, contentType: 'text/html', setCookie: [], body: Buffer.from(page) }
        : response('', { status: 302, location: '/password' }));
    await expect(fetchCatalogue('shopify', 'https://shop.example', trusted, { transport, lookup })).rejects.toMatchObject({ outcome: 'password_page' });
    expect(transport.mock.calls.map(([request]) => request.url.pathname)).toEqual(['/products.json', '/', '/password']);
    // An open store that refuses the catalogue stays unreachable, and so does a WooCommerce store (never asked).
    const open = vi.fn<StorefrontTransport>(async ({ url }) => url.pathname === '/'
      ? { status: 200, location: null, contentType: 'text/html', setCookie: [], body: Buffer.from('<h1>Shop</h1>') } : response('', { status: 403 }));
    await expect(fetchCatalogue('shopify', 'https://shop.example', trusted, { transport: open, lookup })).rejects.toMatchObject({ outcome: 'unreachable' });
    const wooStore = vi.fn<StorefrontTransport>(async () => response('', { status: 403 }));
    await expect(fetchCatalogue('woocommerce', 'https://shop.example', trusted, { transport: wooStore, lookup })).rejects.toMatchObject({ outcome: 'unreachable' });
    expect(wooStore).toHaveBeenCalledTimes(1);
    // The home page is asked on the store's own host only.
    const foreign = vi.fn<StorefrontTransport>(async ({ url }) => url.pathname === '/'
      ? response('', { status: 302, location: 'https://foreign.example/password' }) : response('', { status: 503 }));
    await expect(fetchCatalogue('shopify', 'https://shop.example', trusted, { transport: foreign, lookup })).rejects.toMatchObject({ outcome: 'unreachable' });
    expect(foreign.mock.calls.every(([request]) => request.url.hostname === 'shop.example')).toBe(true);
  });
  it('tells a missing, rate limited or unreachable catalogue apart', async () => {
    const status = (code: number) => ({ transport: async () => response('', { status: code }), lookup });
    await expect(fetchCatalogue('shopify', 'https://shop.example', trusted, status(404))).rejects.toMatchObject({ outcome: 'not_found' });
    await expect(fetchCatalogue('shopify', 'https://shop.example', trusted, status(429))).rejects.toMatchObject({ outcome: 'rate_limited' });
    await expect(fetchCatalogue('shopify', 'https://shop.example', trusted, status(503))).rejects.toMatchObject({ outcome: 'unreachable' });
    await expect(fetchCatalogue('shopify', 'https://shop.example', trusted, { transport: async () => response({ nope: 1 }), lookup })).rejects.toMatchObject({ outcome: 'not_found' });
  });
  it('aborts a stalled page within 10 seconds even if a transport never resolves', async () => {
    vi.useFakeTimers();
    // AbortSignal.timeout uses the native clock, so stub just its factory.
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockImplementation((ms) => { const controller = new AbortController(); setTimeout(() => controller.abort(), ms); return controller.signal; });
    const pending = fetchCatalogue('woocommerce', 'https://shop.example', trusted, { transport: () => new Promise(() => {}), lookup });
    const assertion = expect(pending).rejects.toThrow('timeout');
    await vi.advanceTimersByTimeAsync(10_000); await assertion;
    expect(timeout).toHaveBeenCalledWith(10_000); timeout.mockRestore();
  });
});
