// @vitest-environment node
import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { entitlementMock, settingsMock, rateLimitMock } = vi.hoisted(() => ({
  entitlementMock: vi.fn(),
  settingsMock: vi.fn(),
  rateLimitMock: vi.fn(),
}));

vi.mock('@/lib/ratelimit', () => {
  const limiter = (name: string) => ({ limit: (id: string) => rateLimitMock(name, id) });
  return {
    publicApiRatelimit: limiter('publicApi'),
    proxyVisitorRatelimit: limiter('proxyVisitor'),
    proxyShopReadRatelimit: limiter('proxyShopRead'),
    proxyShopMintRatelimit: limiter('proxyShopMint'),
    clientIp: () => 'test-ip',
  };
});
vi.mock('@/lib/try-on/entitlement', () => ({
  getShopEntitlement: (...args: unknown[]) => entitlementMock(...args),
}));
vi.mock('@/lib/try-on/settings', () => ({
  getTryOnSettings: (...args: unknown[]) => settingsMock(...args),
}));
vi.mock('@/lib/try-on/merchant-copy', () => ({
  pickMerchantCopy: () => ({ buttonLabel: 'Try it on', catalogLabel: 'Try on', disclaimerText: '' }),
}));

import { GET } from './route';
import { clearProxyConfigCache, invalidateProxyConfig } from '@/lib/shopify/proxy-config-cache';

const SHOP = 'demo.myshopify.com';
const SECRET = 'shopify-app-secret';

function entitlement(overrides: Record<string, unknown> = {}) {
  return { available: true, status: 'active', totalCreditsRemaining: 150, ...overrides };
}

/* Signed the way Shopify's App Proxy signs: every query pair, sorted. */
function request(locale = 'en', extra: Record<string, string> = {}) {
  const params = new URLSearchParams({
    locale,
    shop: SHOP,
    path_prefix: '/apps/grindctrl',
    timestamp: String(Math.floor(Date.now() / 1000)),
    logged_in_customer_id: '',
    ...extra,
  });
  const pairs = Array.from(params.entries()).map(([key, value]) => `${key}=${value}`).sort();
  params.set('signature', createHmac('sha256', SECRET).update(pairs.join('')).digest('hex'));
  return new NextRequest(`https://app.example.com/api/shopify/proxy/config?${params}`);
}

describe('GET /api/shopify/proxy/config launch answer', () => {
  beforeEach(() => {
    process.env.SHOPIFY_API_KEY = 'test-only-client-id';
    process.env.SHOPIFY_API_SECRET = SECRET;
    rateLimitMock.mockReset().mockResolvedValue({ success: true, reset: Date.now() + 10_000 });
    clearProxyConfigCache();
    settingsMock.mockReset().mockResolvedValue({ accentBg: '#111', accentFg: '#fff', radiusPx: 12 });
    entitlementMock.mockReset().mockResolvedValue(entitlement());
  });

  afterEach(() => {
    delete process.env.SHOPIFY_API_KEY;
    delete process.env.SHOPIFY_API_SECRET;
    clearProxyConfigCache();
  });

  it('answers live while the store has looks', async () => {
    const body = await (await GET(request())).json();
    expect(body).toMatchObject({ tryOn: 'live', reason: null, available: true });
  });

  it('answers hidden with out_of_looks when the looks run out', async () => {
    entitlementMock.mockResolvedValue(entitlement({ available: false, totalCreditsRemaining: 0 }));
    const body = await (await GET(request())).json();
    expect(body).toMatchObject({ tryOn: 'hidden', reason: 'out_of_looks', available: false });
  });

  it('answers hidden with plan_inactive for a lapsed plan', async () => {
    entitlementMock.mockResolvedValue(entitlement({ available: false, status: 'expired' }));
    const body = await (await GET(request())).json();
    expect(body).toMatchObject({ tryOn: 'hidden', reason: 'plan_inactive' });
  });

  it('answers hidden with not_installed when no shop is named', async () => {
    const signedWithoutShop = request('en');
    signedWithoutShop.nextUrl.searchParams.delete('shop');
    const body = await (await GET(new NextRequest(signedWithoutShop.nextUrl))).json();
    expect(body).toMatchObject({ tryOn: 'hidden', reason: 'not_installed' });
    expect(entitlementMock).not.toHaveBeenCalled();
  });

  /* Phase zero item 3: only Shopify's signature may name a shop. */
  it('serves the shared defaults to an unsigned request that names a shop', async () => {
    const body = await (
      await GET(new NextRequest(`https://app.example.com/api/shopify/proxy/config?shop=${SHOP}&locale=en`))
    ).json();
    expect(body).toMatchObject({ tryOn: 'hidden', reason: 'not_installed' });
    expect(entitlementMock).not.toHaveBeenCalled();
    expect(settingsMock).toHaveBeenCalledWith(null);
    expect(rateLimitMock.mock.calls).toEqual([['publicApi', 'pc:test-ip']]);
  });

  it('counts a signed request against its shop and visitor, not the address', async () => {
    await GET(request('en', { vid: 'visitor_0123456789abcdef' }));
    expect(rateLimitMock.mock.calls).toEqual([
      ['proxyVisitor', 'pc:demo.myshopify.com:visitor_0123456789abcdef'],
      ['proxyShopRead', 'pc:demo.myshopify.com'],
    ]);
  });

  it('answers 429 before any database read when the visitor is over budget', async () => {
    rateLimitMock.mockImplementation(async (name: string) => ({
      success: name !== 'proxyVisitor',
      reset: Date.now() + 10_000,
    }));
    const response = await GET(request('en', { vid: 'visitor_0123456789abcdef' }));
    expect(response.status).toBe(429);
    expect(settingsMock).not.toHaveBeenCalled();
    expect(entitlementMock).not.toHaveBeenCalled();
  });

  it('does not cache a failed read, so the next request can recover', async () => {
    entitlementMock.mockRejectedValueOnce(new Error('db down'));
    const first = await (await GET(request())).json();
    expect(first).toMatchObject({ tryOn: 'hidden', reason: 'unavailable' });

    const second = await (await GET(request())).json();
    expect(second).toMatchObject({ tryOn: 'live' });
    expect(entitlementMock).toHaveBeenCalledTimes(2);
  });

  it('serves the cached answer within the minute', async () => {
    await GET(request());
    await GET(request());
    expect(entitlementMock).toHaveBeenCalledTimes(1);
  });

  /* "Comes back the moment you add looks": clearing the shop's entries
     makes the next read fresh, in every language. */
  it('reads fresh after the shop is invalidated, in both languages', async () => {
    entitlementMock.mockResolvedValue(entitlement({ available: false, totalCreditsRemaining: 0 }));
    expect((await (await GET(request('en'))).json()).tryOn).toBe('hidden');
    expect((await (await GET(request('ar'))).json()).tryOn).toBe('hidden');

    entitlementMock.mockResolvedValue(entitlement());
    invalidateProxyConfig(SHOP);

    expect((await (await GET(request('en'))).json()).tryOn).toBe('live');
    expect((await (await GET(request('ar'))).json()).tryOn).toBe('live');
  });
});
