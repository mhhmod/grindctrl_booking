// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ shops: vi.fn(), sites: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ headers: vi.fn(), cookies: vi.fn() }));
vi.mock('@clerk/nextjs/server', () => ({ auth: async () => ({ userId: 'user_nour' }) }));
vi.mock('@/lib/shopify/shops', () => ({ listManagedTryOnShops: mocks.shops }));
vi.mock('@/lib/messenger/provisioning', () => ({ listMessengerSitesReadOnly: mocks.sites }));

import { getActiveStoreRole } from './active-store-server';

const SITE = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.shops.mockResolvedValue([
    { domain: 'mine.myshopify.com', status: 'installed', lastSeenAt: '2026-10-01T00:00:00Z', role: 'owner' },
    { domain: 'maison.myshopify.com', status: 'installed', lastSeenAt: '2026-10-02T00:00:00Z', role: 'member' },
  ]);
  mocks.sites.mockResolvedValue([{ id: SITE, name: 'Kids', domain: 'kids.example', role: 'admin' }]);
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
