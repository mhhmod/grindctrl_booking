// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  platforms: vi.fn(),
  siteStatus: 'active' as string | null,
  siteError: null as null | { message: string },
  shops: vi.fn(),
  woo: vi.fn(),
  paste: vi.fn(),
  showButton: vi.fn(),
  entitlement: vi.fn(),
  flags: vi.fn(),
  launch: vi.fn(),
}));

vi.mock('@/lib/messenger/db', () => ({
  getMessengerServiceClient: () =>
    ({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () =>
              mocks.siteError
                ? { data: null, error: mocks.siteError }
                : { data: mocks.siteStatus === null ? null : { status: mocks.siteStatus }, error: null },
          }),
        }),
      }),
    }) as unknown as SupabaseClient,
}));
vi.mock('./active-store-server', () => ({ listDashboardShops: mocks.shops }));
vi.mock('@/lib/woo/connection', () => ({ getWooSiteConnection: mocks.woo }));
vi.mock('@/lib/paste/status', () => ({ readPasteInstallStatus: mocks.paste }));
vi.mock('@/lib/try-on/settings', () => ({ readTryOnShowButton: mocks.showButton, readTryOnShowCardPill: async () => true }));
vi.mock('@/lib/store-health/signals', () => ({ readHealthCounts: vi.fn(async () => ({ inline: 0, floating: 0, detected: 0, missing: 0, listings: 0, pills: 0, photos: 0, photoHost: null })) }));
vi.mock('@/lib/paste/store', () => ({ readPasteDomainPlatforms: mocks.platforms }));
vi.mock('@/lib/try-on/entitlement', () => ({ getShopEntitlement: mocks.entitlement }));
vi.mock('@/lib/flags/store-flags', () => ({ storeFlags: mocks.flags }));
vi.mock('@/lib/launch/store-launch', () => ({ getStoreLaunch: mocks.launch }));

import { readHealthCounts } from '@/lib/store-health/signals';
import { getYourStoreFacts } from './your-store-data';

const NOW = Date.parse('2026-11-10T12:00:00Z');
const ENTITLEMENT = {
  status: 'active',
  totalCreditsRemaining: 15,
  rendersIncluded: 20,
  topUpCreditsRemaining: 0,
};

function pasteStatus(overrides: Record<string, unknown> = {}) {
  return {
    connected: true,
    platform: 'website',
    shopDomain: null,
    shopLastSeenAt: null,
    seenHost: null,
    domains: [],
    codeOutdated: false,
    tryOnReason: null,
    plan: { ...ENTITLEMENT, totalCreditsRemaining: 7 },
    mode: 'live',
    ...overrides,
  };
}

const domain = (overrides: Record<string, unknown>) => ({
  id: 'd',
  domain: 'a.com',
  state: 'trusted',
  domainVerified: false,
  verificationReason: 'awaiting_code',
  lastSeenAt: null,
  ...overrides,
});

beforeEach(() => {
  mocks.platforms.mockResolvedValue([]);
  mocks.siteStatus = 'active';
  mocks.siteError = null;
  for (const fn of [mocks.shops, mocks.woo, mocks.paste, mocks.showButton, mocks.entitlement, mocks.flags, mocks.launch]) fn.mockReset();
  mocks.showButton.mockResolvedValue(true);
  mocks.entitlement.mockResolvedValue(ENTITLEMENT);
  mocks.flags.mockResolvedValue([]);
  mocks.launch.mockResolvedValue(null);
});

describe('getYourStoreFacts', () => {
  it('reads nothing for an account with no Try-On tenant', async () => {
    const facts = await getYourStoreFacts({ activeStore: { shopDomain: null, siteId: 'site-1', tenantKey: null, platform: null }, role: 'owner', timeZone: 'UTC', now: NOW });
    expect(facts).toBeNull();
    expect(mocks.showButton).not.toHaveBeenCalled();
  });

  it('reads the Shopify app install as connected, with the shop as the address', async () => {
    mocks.shops.mockResolvedValue([{ domain: 'lulus.myshopify.com', status: 'installed' }]);
    const facts = await getYourStoreFacts({
      activeStore: { shopDomain: 'lulus.myshopify.com', siteId: 'site-1', tenantKey: 'lulus.myshopify.com', platform: 'shopify' },
      role: 'admin',
      timeZone: 'UTC',
      now: NOW,
    });
    expect(facts).toMatchObject({
      platform: 'shopify_app',
      address: 'lulus.myshopify.com',
      storeUrl: 'https://lulus.myshopify.com',
      code: { lastSeenAt: null, connected: true },
      canChange: true,
      canBilling: false,
      launchState: 'live',
      tryOn: { tenant: 'lulus.myshopify.com', showButton: true, looksLeft: 15, looksIncluded: 20, planActive: true, pasteReason: null },
      chat: { siteId: 'site-1', enabled: true },
      domains: [],
    });
  });

  it('treats an uninstalled Shopify app as not connected', async () => {
    mocks.shops.mockResolvedValue([{ domain: 'lulus.myshopify.com', status: 'uninstalled' }]);
    const facts = await getYourStoreFacts({
      activeStore: { shopDomain: 'lulus.myshopify.com', siteId: null, tenantKey: 'lulus.myshopify.com', platform: 'shopify' },
      role: 'owner',
      timeZone: 'UTC',
      now: NOW,
    });
    expect(facts).toBeNull();
  });

  it('reads the preview launch state only where preview mode is on for the store', async () => {
    mocks.shops.mockResolvedValue([{ domain: 'lulus.myshopify.com', status: 'installed' }]);
    mocks.flags.mockResolvedValue(['n5_preview_mode']);
    mocks.launch.mockResolvedValue({ state: 'preview', holdoutShare: null });
    const facts = await getYourStoreFacts({
      activeStore: { shopDomain: 'lulus.myshopify.com', siteId: null, tenantKey: 'lulus.myshopify.com', platform: 'shopify' },
      role: 'owner',
      timeZone: 'UTC',
      now: NOW,
    });
    expect(facts?.launchState).toBe('preview');
    expect(facts?.chat).toBeNull();
  });

  it('times a WooCommerce store by its plugin heartbeat, with its home page as the address', async () => {
    mocks.siteStatus = 'draft';
    mocks.woo.mockResolvedValue({ status: 'active', lastSeenAt: '2026-11-09T08:00:00Z', homeUrl: 'https://shop.example.com/store' });
    const facts = await getYourStoreFacts({
      activeStore: { shopDomain: null, siteId: 'site-1', tenantKey: 'site:1', platform: 'woocommerce' },
      role: 'member',
      timeZone: 'UTC',
      now: NOW,
    });
    expect(facts).toMatchObject({
      platform: 'woocommerce',
      address: 'shop.example.com',
      storeUrl: 'https://shop.example.com/store',
      code: { lastSeenAt: '2026-11-09T08:00:00Z', connected: true },
      canChange: false,
      chat: { siteId: 'site-1', enabled: false },
    });
  });

  it('reads pasted website code: the latest trusted signal, a live address first, and each address', async () => {
    mocks.paste.mockResolvedValue(
      pasteStatus({
        seenHost: 'www.a.com',
        domains: [
          domain({ id: 'd1', domain: 'www.a.com', lastSeenAt: '2026-11-10T11:00:00Z' }),
          domain({ id: 'd2', domain: 'a.com', domainVerified: true, verificationReason: null, lastSeenAt: '2026-11-10T09:00:00Z' }),
          domain({ id: 'd3', domain: 'b.com', state: 'claimed', verificationReason: 'held_elsewhere', lastSeenAt: '2026-11-10T11:59:00Z' }),
        ],
        codeOutdated: false,
        tryOnReason: 'domain_unverified',
      }),
    );
    const facts = await getYourStoreFacts({
      activeStore: { shopDomain: null, siteId: 'site-1', tenantKey: 'site:1', platform: 'paste' },
      role: 'owner',
      timeZone: 'UTC',
      now: NOW,
    });
    expect(mocks.paste).toHaveBeenCalledWith({ id: 'site-1', status: 'active' }, new Date(NOW));
    expect(mocks.entitlement).not.toHaveBeenCalled();
    expect(facts).toMatchObject({
      platform: 'paste_website',
      address: 'a.com',
      storeUrl: 'https://a.com',
      // A claimed address is not this store's signal.
      code: { lastSeenAt: '2026-11-10T11:00:00Z', connected: false },
      tryOn: { looksLeft: 7, pasteReason: 'domain_unverified' },
    });
    expect(facts?.domains.map((d) => [d.id, d.verified, d.state, d.reason])).toEqual([
      ['d1', false, 'trusted', 'awaiting_code'],
      ['d2', true, 'trusted', null],
      ['d3', false, 'claimed', 'held_elsewhere'],
    ]);
  });

  it('reads pasted Shopify code by its shop, with no addresses, and the outdated-code hint', async () => {
    mocks.paste.mockResolvedValue(pasteStatus({ platform: 'shopify', shopDomain: 'lulus.myshopify.com', shopLastSeenAt: '2026-11-10T10:00:00Z', codeOutdated: true }));
    const facts = await getYourStoreFacts({
      activeStore: { shopDomain: null, siteId: 'site-1', tenantKey: 'site:1', platform: 'paste' },
      role: 'owner',
      timeZone: 'UTC',
      now: NOW,
    });
    expect(facts).toMatchObject({ platform: 'paste_shopify', address: 'lulus.myshopify.com', codeOutdated: true, domains: [] });
    expect(facts?.code.lastSeenAt).toBe('2026-11-10T10:00:00Z');
  });

  it('treats pasted code that is not enabled as not connected', async () => {
    mocks.paste.mockResolvedValue(pasteStatus({ connected: false }));
    expect(
      await getYourStoreFacts({ activeStore: { shopDomain: null, siteId: 'site-1', tenantKey: 'site:1', platform: 'paste' }, role: 'owner', timeZone: 'UTC', now: NOW }),
    ).toBeNull();
  });

  it('throws when a fact cannot be read, rather than guess a status', async () => {
    mocks.siteError = { message: 'timeout' };
    await expect(
      getYourStoreFacts({ activeStore: { shopDomain: null, siteId: 'site-1', tenantKey: 'site:1', platform: 'paste' }, role: 'owner', timeZone: 'UTC', now: NOW }),
    ).rejects.toThrow('store chat site read failed');
    mocks.siteError = null;
    mocks.paste.mockResolvedValue(pasteStatus());
    mocks.showButton.mockRejectedValue(new Error('switch read failed'));
    await expect(
      getYourStoreFacts({ activeStore: { shopDomain: null, siteId: 'site-1', tenantKey: 'site:1', platform: 'paste' }, role: 'owner', timeZone: 'UTC', now: NOW }),
    ).rejects.toThrow('switch read failed');
  });
});


it('passes only the active authorized site to the bounded seven-day health reader', async () => {
  vi.mocked(readHealthCounts).mockClear();
  mocks.paste.mockResolvedValue(pasteStatus());
  const result = await getYourStoreFacts({ activeStore: { shopDomain: null, siteId: 'site-1', tenantKey: 'site:1', platform: 'paste' }, role: 'owner', timeZone: 'UTC', now: NOW });
  expect(readHealthCounts).toHaveBeenCalledExactlyOnceWith(['site-1'], NOW);
  expect(result?.health).toMatchObject({ inline: 0, photos: 0, photoHost: null });
});

it('uses the server-detected EasyOrders platform, not the shopper or a hostname guess', async () => {
  mocks.paste.mockResolvedValue(pasteStatus());
  mocks.platforms.mockResolvedValue([{ domain: 'shop.example', platform: 'easyorders' }]);
  const result = await getYourStoreFacts({ activeStore: { shopDomain: null, siteId: 'site-1', tenantKey: 'site:1', platform: 'paste' }, role: 'owner', timeZone: 'UTC', now: NOW });
  expect(result?.easyOrders).toBe(true);
  expect(mocks.platforms).toHaveBeenCalledWith('site-1');
});

it('reads Woo detection for pasted websites from the existing domain platform reader', async () => {
  mocks.paste.mockResolvedValue(pasteStatus());
  mocks.platforms.mockResolvedValue([{ domain: 'shop.example', platform: 'woocommerce' }]);
  const input = { activeStore: { shopDomain: null, siteId: 'site-1', tenantKey: 'site:1', platform: 'paste' as const },
    role: 'owner' as const, timeZone: 'UTC', now: NOW };
  expect(await getYourStoreFacts(input)).toMatchObject({ platform: 'paste_website', wooDetected: true });
  mocks.platforms.mockResolvedValue([{ domain: 'shop.example', platform: 'custom' }]);
  expect(await getYourStoreFacts(input)).toMatchObject({ wooDetected: false });
});
