// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { entitlementMock, settingsMock } = vi.hoisted(() => ({
  entitlementMock: vi.fn(),
  settingsMock: vi.fn(),
}));

vi.mock('@/lib/ratelimit', () => ({
  publicApiRatelimit: { limit: async () => ({ success: true, reset: Date.now() + 10_000 }) },
  clientIp: () => 'test-ip',
}));
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

function entitlement(overrides: Record<string, unknown> = {}) {
  return { available: true, status: 'active', totalCreditsRemaining: 150, ...overrides };
}

function request(locale = 'en') {
  return new NextRequest(`https://app.example.com/api/shopify/proxy/config?shop=${SHOP}&locale=${locale}`);
}

describe('GET /api/shopify/proxy/config launch answer', () => {
  beforeEach(() => {
    clearProxyConfigCache();
    settingsMock.mockReset().mockResolvedValue({ accentBg: '#111', accentFg: '#fff', radiusPx: 12 });
    entitlementMock.mockReset().mockResolvedValue(entitlement());
  });

  afterEach(() => {
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
    const body = await (
      await GET(new NextRequest('https://app.example.com/api/shopify/proxy/config?locale=en'))
    ).json();
    expect(body).toMatchObject({ tryOn: 'hidden', reason: 'not_installed' });
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
