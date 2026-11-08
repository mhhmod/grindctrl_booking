// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ shops: vi.fn(), sites: vi.fn(), woo: vi.fn(), wooContext: vi.fn(), freePlan: vi.fn(), paste: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ headers: vi.fn(), cookies: vi.fn() }));
vi.mock('@clerk/nextjs/server', () => ({ auth: async () => ({ userId: 'user_nour' }) }));
vi.mock('@/lib/shopify/shops', () => ({ listManagedTryOnShops: mocks.shops }));
vi.mock('@/lib/woo/connection', () => ({ listActiveWooSiteIds: mocks.woo, getActiveWooSiteContext: mocks.wooContext }));
vi.mock('@/lib/woo/free-plan', () => ({ ensureWooFreePlan: mocks.freePlan }));
vi.mock('@/lib/paste/store', () => ({ listActivePasteSiteIds: mocks.paste }));
vi.mock('@/lib/messenger/provisioning', () => ({ listMessengerSitesReadOnly: mocks.sites }));

import { ensureActiveStorePlan, getActiveStoreRole, getActiveStoreTimeZone, listDashboardSites, storeLookupFailed } from './active-store-server';

const SITE = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.shops.mockResolvedValue([
    { domain: 'mine.myshopify.com', status: 'installed', lastSeenAt: '2026-10-01T00:00:00Z', role: 'owner' },
    { domain: 'maison.myshopify.com', status: 'installed', lastSeenAt: '2026-10-02T00:00:00Z', role: 'member' },
  ]);
  mocks.sites.mockResolvedValue([{ id: SITE, name: 'Kids', domain: 'kids.example', role: 'admin' }]);
  mocks.woo.mockResolvedValue(new Set());
  mocks.paste.mockResolvedValue(new Set());
});

/* Item 12: the nav follows the person's role on the active store. */
describe('getActiveStoreRole', () => {
  it("reads the person's role on the active shop or site", async () => {
    expect(await getActiveStoreRole({ shopDomain: 'mine.myshopify.com', siteId: null })).toBe('owner');
    expect(await getActiveStoreRole({ shopDomain: 'maison.myshopify.com', siteId: null })).toBe('member');
    expect(await getActiveStoreRole({ shopDomain: null, siteId: SITE })).toBe('admin');
  });

  it('makes a person with no store the owner of their own account', async () => {
    expect(await getActiveStoreRole({ shopDomain: null, siteId: null })).toBe('owner');
    expect(mocks.shops).not.toHaveBeenCalled();
  });

  it('gives a store missing from their lists the least a role can do', async () => {
    mocks.shops.mockRejectedValue(new Error('db down'));
    expect(await getActiveStoreRole({ shopDomain: 'mine.myshopify.com', siteId: null })).toBe('member');
  });
});

/* A failed read must not pass for a new account with no store. */
describe('storeLookupFailed', () => {
  it('is false when both lists read, even when they are empty', async () => {
    mocks.shops.mockResolvedValue([]);
    mocks.sites.mockResolvedValue([]);
    expect(await storeLookupFailed()).toBe(false);
  });

  it.each([
    ['shops', () => mocks.shops.mockRejectedValue(new Error('db down'))],
    ['sites', () => mocks.sites.mockRejectedValue(new Error('db down'))],
  ])('is true, logging a code and the source and nothing else, when the %s list fails', async (source, fail) => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    fail();
    expect(await storeLookupFailed()).toBe(true);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith('[dashboard] store lookup failed', {
      code: 'dashboard_store_lookup_failed',
      source,
      error: 'Error',
    });
    log.mockRestore();
  });
});

describe('WooCommerce stores', () => {
  const woo = { shopDomain: null, siteId: SITE, tenantKey: `site:${SITE}`, platform: 'woocommerce' as const };

  it('marks the sites that have an active plugin connection', async () => {
    mocks.woo.mockResolvedValue(new Set([SITE]));
    expect(await listDashboardSites()).toEqual([expect.objectContaining({ id: SITE, woo: true })]);
    expect(mocks.woo).toHaveBeenCalledWith([SITE]);
  });

  it('leaves the sites plain when the connection lookup fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.woo.mockRejectedValue(new Error('down'));
    expect(await listDashboardSites()).toEqual([expect.objectContaining({ id: SITE, woo: false })]);
  });

  it('uses the time zone the plugin reported, and UTC when it reported none or an unknown one', async () => {
    mocks.wooContext.mockResolvedValue({ homeUrl: 'https://kids.example', timezone: 'Africa/Cairo' });
    expect(await getActiveStoreTimeZone(woo)).toBe('Africa/Cairo');
    mocks.wooContext.mockResolvedValue({ homeUrl: 'https://kids.example', timezone: 'Mars/Base' });
    expect(await getActiveStoreTimeZone(woo)).toBe('UTC');
    mocks.wooContext.mockResolvedValue(null);
    expect(await getActiveStoreTimeZone(woo)).toBe('UTC');
  });

  it('claims the free plan only for a WooCommerce store', async () => {
    await ensureActiveStorePlan(woo);
    expect(mocks.freePlan).toHaveBeenCalledWith(`site:${SITE}`);
    mocks.freePlan.mockClear();
    await ensureActiveStorePlan({ shopDomain: 'mine.myshopify.com', siteId: null, tenantKey: 'mine.myshopify.com', platform: 'shopify' });
    await ensureActiveStorePlan({ shopDomain: null, siteId: SITE });
    await ensureActiveStorePlan({ shopDomain: null, siteId: SITE, tenantKey: `site:${SITE}`, platform: 'paste' });
    expect(mocks.freePlan).not.toHaveBeenCalled();
  });

  it('marks an opted-in paste tenant without granting a plan during the dashboard read', async () => {
    mocks.paste.mockResolvedValue(new Set([SITE]));
    expect(await listDashboardSites()).toEqual([expect.objectContaining({ id: SITE, paste: true, woo: false })]);
    expect(mocks.freePlan).not.toHaveBeenCalled();
  });
});
