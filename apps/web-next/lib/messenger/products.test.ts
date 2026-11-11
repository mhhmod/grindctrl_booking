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
