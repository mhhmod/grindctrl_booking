// @vitest-environment node
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

/* The Try-On button switch through the real site launch answer
   (readSiteLaunch) and config builder: the WooCommerce plugin prints no
   button unless `enabled` is true. Only storage is mocked. */
const SITE = '123e4567-e89b-42d3-a456-426614174000';
const TENANT = `site:${SITE}`;
const mocks = vi.hoisted(() => ({ showButton: vi.fn(), entitlement: vi.fn() }));

vi.mock('@/lib/ratelimit', () => ({
  publicApiRatelimit: { limit: async () => ({ success: true, reset: Date.now() + 1000 }) },
  proxyShopReadRatelimit: { limit: async () => ({ success: true, reset: Date.now() + 1000 }) },
  clientIp: () => '203.0.113.9',
}));
vi.mock('@/lib/shopify/tokens', () => ({ isActiveTenant: async () => true }));
vi.mock('@/lib/woo/tryon-site', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/woo/tryon-site')>()),
  siteByEmbedKey: async () => ({ id: SITE, status: 'active' }),
}));
vi.mock('@/lib/woo/garment-url', () => ({ verifiedSiteHosts: async () => ['shop.example.com'] }));
vi.mock('@/lib/flags/store-flags', () => ({ storeFlags: async () => [] }));
vi.mock('@/lib/try-on/entitlement', () => ({ getShopEntitlement: mocks.entitlement }));
vi.mock('@/lib/try-on/settings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/try-on/settings')>();
  return { ...actual, getTryOnSettings: async () => actual.DEFAULT_SETTINGS, readTryOnShowButton: mocks.showButton };
});

import { GET } from './route';
import { clearProxyConfigCache, invalidateProxyConfig } from '@/lib/shopify/proxy-config-cache';

const get = async () => (await GET(new NextRequest('http://localhost/api/woo/tryon-config?key=abcdefgh12345678&locale=en'))).json();

beforeEach(() => {
  clearProxyConfigCache();
  mocks.showButton.mockReset().mockResolvedValue(true);
  mocks.entitlement.mockReset().mockResolvedValue({ available: true, status: 'active', totalCreditsRemaining: 9 });
});

describe('GET /api/woo/tryon-config with the Try-On button switch', () => {
  it('is disabled with reason paused while the button is off, and enabled again once on', async () => {
    mocks.showButton.mockResolvedValue(false);
    expect(await get()).toMatchObject({ enabled: false, reason: 'paused' });
    expect(mocks.showButton).toHaveBeenCalledWith(TENANT);

    mocks.showButton.mockResolvedValue(true);
    invalidateProxyConfig(TENANT);
    expect(await get()).toMatchObject({ enabled: true, reason: null });
  });

  it('stays disabled for a site with no plan yet: no free plan is promised to a paused button', async () => {
    mocks.entitlement.mockResolvedValue({ available: false, status: 'none', totalCreditsRemaining: 0 });
    expect(await get()).toMatchObject({ enabled: true });

    mocks.showButton.mockResolvedValue(false);
    invalidateProxyConfig(TENANT);
    expect(await get()).toMatchObject({ enabled: false, reason: 'paused' });
  });

  it('reports a failed switch read as unavailable, not as live', async () => {
    mocks.showButton.mockRejectedValue(new Error('db down'));
    expect(await get()).toMatchObject({ enabled: false, reason: 'unavailable' });
  });
});
