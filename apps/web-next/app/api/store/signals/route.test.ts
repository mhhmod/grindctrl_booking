// @vitest-environment node
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ site: vi.fn(), connection: vi.fn(), hosts: vi.fn(), ip: vi.fn(), limit: vi.fn(), write: vi.fn() }));
vi.mock('@/lib/messenger/public-api', async (original) => ({ ...await original<object>(), loadPublicSite: m.site }));
vi.mock('@/lib/paste/store', async (original) => ({ ...await original<object>(), getPasteConnection: m.connection, pasteTrustedHosts: m.hosts }));
vi.mock('@/lib/ratelimit', () => ({ clientIp: () => '203.0.113.1', proxyVisitorRatelimit: { limit: m.ip }, proxyShopReadRatelimit: { limit: m.limit } }));
vi.mock('@/lib/store-health/signals', () => ({ incrementHealthCounters: m.write }));
import { POST } from './route';
const beacon = { key: 'public-key', kind: 'product_page', productDetected: true, placement: 'inline' };
const request = (body: unknown = beacon, origin: string | null = 'https://shop.example') => new NextRequest('https://grindctrl.cloud/api/store/signals', {
  method: 'POST', headers: { 'Content-Type': 'text/plain', ...(origin ? { origin } : {}) }, body: typeof body === 'string' ? body : JSON.stringify(body),
});
beforeEach(() => {
  vi.clearAllMocks();
  for (const fn of [m.ip, m.limit]) fn.mockResolvedValue({ success: true, reset: Date.now() + 60000 });
  m.site.mockResolvedValue({ id: 'site-1', status: 'active', domain: 'shop.example', security: { allow_localhost: false }, patterns: [], pasteShopDomain: null });
  m.connection.mockResolvedValue(null);
  m.hosts.mockResolvedValue(['shop.example']);
  m.write.mockResolvedValue(undefined);
});
describe('private aggregate storefront signals', () => {
  it('accepts an origin-validated beacon and writes only counters for a server-derived site', async () => {
    expect((await POST(request())).status).toBe(204);
    expect(m.write).toHaveBeenCalledExactlyOnceWith('site-1', [
      { metric: 'product_detected', dimension: 'yes', count: 1 }, { metric: 'placement', dimension: 'inline', count: 1 },
    ]);
    expect(m.ip).toHaveBeenCalledWith('store-signals:ip:203.0.113.1');
    expect(m.limit).toHaveBeenCalledWith('store-signals:site:site-1');
  });
  it.each(['floating', 'inline'])('records %s placement', async (placement) => {
    await POST(request({ ...beacon, placement }));
    expect(m.write.mock.calls[0][1][1]).toEqual({ metric: 'placement', dimension: placement, count: 1 });
  });
  it('records a missing chosen spot beside the placement it fell back to', async () => {
    await POST(request({ ...beacon, spotMissing: true }));
    expect(m.write).toHaveBeenCalledExactlyOnceWith('site-1', [
      { metric: 'product_detected', dimension: 'yes', count: 1 }, { metric: 'placement', dimension: 'inline', count: 1 },
      { metric: 'spot_missing', dimension: '', count: 1 },
    ]);
  });
  it.each([
    { ...beacon, spotMissing: false },
    { ...beacon, spotMissing: 'yes' },
    { key: beacon.key, kind: 'product_page', productDetected: false, spotMissing: true },
    { key: beacon.key, kind: 'listing', pills: 2, spotMissing: true },
  ])('ignores a malformed spot report %#', async (body) => {
    expect((await POST(request(body))).status).toBe(204);
    expect(m.write).not.toHaveBeenCalled();
  });
  it('records a product-page detection miss without inventing placement', async () => {
    await POST(request({ key: beacon.key, kind: beacon.kind, productDetected: false }));
    expect(m.write).toHaveBeenCalledWith('site-1', [{ metric: 'product_detected', dimension: 'no', count: 1 }]);
  });
  it.each([0, 24, 200])('records listing views and %i mounted products', async (pills) => {
    await POST(request({ key: beacon.key, kind: 'listing', pills }));
    expect(m.write).toHaveBeenCalledWith('site-1', [{ metric: 'listing_views', dimension: '', count: 1 }, { metric: 'pills', dimension: '', count: pills }]);
  });
  it.each(['https://evil.example', 'http://shop.example', 'https://shop.example:444', null])('ignores origin %s', async (origin) => {
    expect((await POST(request(beacon, origin))).status).toBe(204);
    expect(m.write).not.toHaveBeenCalled();
  });
  it('ignores unknown or disabled keys', async () => {
    for (const site of [null, { status: 'disabled' }]) {
      m.site.mockResolvedValueOnce(site);
      expect((await POST(request())).status).toBe(204);
    }
    expect(m.write).not.toHaveBeenCalled();
  });
  it('requires paste trust AND the same trusted hosts as paste-context', async () => {
    m.connection.mockResolvedValue({ platform: 'website', status: 'active' });
    m.hosts.mockResolvedValue([]);
    await POST(request());
    expect(m.write).not.toHaveBeenCalled();
    m.hosts.mockResolvedValue(['shop.example']);
    m.connection.mockResolvedValue({ platform: 'shopify', status: 'pending' });
    await POST(request());
    expect(m.write).not.toHaveBeenCalled();
    m.connection.mockResolvedValue({ platform: 'website', status: 'active' });
    await POST(request());
    expect(m.write).toHaveBeenCalledTimes(1);
  });
  it.each([
    'x'.repeat(513), '{', [], null, {}, { ...beacon, key: '../x' }, { ...beacon, placement: 'left' },
    { ...beacon, host: 'evil.example' }, { ...beacon, siteId: 'victim' }, { ...beacon, url: '/secret' },
    { key: 'public-key', kind: 'photo_failure', host: 'evil.example' },
    { key: 'public-key', kind: 'listing', pills: -1 }, { key: 'public-key', kind: 'listing', pills: 201 },
    { key: 'public-key', kind: 'listing', pills: 1.5 }, { ...beacon, productDetected: 'false' },
    { ...beacon, productDetected: false }, { ...beacon, pills: 2 },
  ])('204-ignores invalid/oversized input %#', async (body) => {
    expect((await POST(request(body))).status).toBe(204);
    expect(m.write).not.toHaveBeenCalled();
  });
  it.each([false, 'timeout', 'invalid', 'throws'])('fails closed on either budget: %s', async (mode) => {
    for (const fn of [m.ip, m.limit]) {
      m.write.mockClear();
      if (mode === 'throws') fn.mockRejectedValueOnce(new Error('redis down'));
      else fn.mockResolvedValueOnce(mode === 'invalid' ? { success: true } : { success: mode !== false, reason: mode === 'timeout' ? 'timeout' : undefined, reset: Date.now() + 1000 });
      expect((await POST(request())).status).toBe(204);
      expect(m.write).not.toHaveBeenCalled();
    }
  });
  it('silently tolerates database failure', async () => {
    m.write.mockRejectedValueOnce(new Error('unavailable'));
    expect((await POST(request())).status).toBe(204);
  });
});
