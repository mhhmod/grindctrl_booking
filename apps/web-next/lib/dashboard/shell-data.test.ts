// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({
  shops: vi.fn(),
  sites: vi.fn(),
  entitlement: vi.fn(),
  timezone: vi.fn(),
  user: vi.fn(),
}));
vi.mock('./active-store-server', () => ({ listOwnedShops: mocks.shops, listOwnedSitesReadOnly: mocks.sites }));
vi.mock('@/lib/try-on/entitlement', () => ({ getShopEntitlement: mocks.entitlement }));
vi.mock('@/lib/shopify/shop-timezone', () => ({ getShopTimezone: mocks.timezone }));
vi.mock('@clerk/nextjs/server', () => ({ currentUser: mocks.user }));

import { getV16ShellData } from './shell-data';

const active = { shopDomain: 'maison.myshopify.com', siteId: '11111111-1111-4111-8111-111111111111' };
const now = new Date('2026-10-02T10:30:00Z');

beforeEach(() => {
  vi.resetAllMocks();
  mocks.shops.mockResolvedValue([{ domain: 'maison.myshopify.com', status: 'installed', lastSeenAt: '2026-10-01T00:00:00Z' }]);
  mocks.sites.mockResolvedValue([{ id: active.siteId, name: 'Maison Noor', domain: 'maison.myshopify.com' }]);
  mocks.entitlement.mockResolvedValue({
    available: true, isFree: false, rendersIncluded: 350, totalCreditsRemaining: 150, bannerState: 'none',
  });
  mocks.timezone.mockResolvedValue('Africa/Cairo');
  mocks.user.mockResolvedValue({ firstName: 'Hana', lastName: 'Adel', primaryEmailAddress: { emailAddress: 'hana@example.com' } });
});

describe('getV16ShellData', () => {
  it('reads the stores, the meter, the person and the greeting', async () => {
    const shell = await getV16ShellData({ activeStore: active, locale: 'en', role: 'owner', now });
    expect(shell.stores.map((store) => [store.label, store.current])).toEqual([['Maison Noor', true]]);
    expect(shell.meter?.value).toBe('150 left of 350');
    expect(shell.person).toEqual({ name: 'Hana Adel', role: 'owner' });
    expect(shell.today).toEqual({ date: 'Friday, 2 October', greeting: 'Good afternoon, Hana' });
    expect(mocks.entitlement).toHaveBeenCalledWith('maison.myshopify.com');
  });

  it('leaves out what it cannot read, and never guesses', async () => {
    mocks.shops.mockRejectedValue(new Error('db down'));
    mocks.sites.mockRejectedValue(new Error('db down'));
    mocks.entitlement.mockRejectedValue(new Error('db down'));
    mocks.timezone.mockResolvedValue(null);
    mocks.user.mockResolvedValue({ firstName: null, lastName: null, primaryEmailAddress: { emailAddress: 'nour@example.com' } });
    const shell = await getV16ShellData({ activeStore: active, locale: 'ar', role: 'viewer', now });
    expect(shell.stores).toEqual([]);
    expect(shell.meter).toBeNull();
    expect(shell.person).toEqual({ name: 'nour@example.com', role: null });
    // No store time zone means UTC, where 10:30 is still morning, and no first name means none in the greeting.
    expect(shell.today.greeting).toBe('صباح الخير');
  });

  it('reads no plan or time zone for a store without a shop', async () => {
    await getV16ShellData({ activeStore: { shopDomain: null, siteId: active.siteId }, locale: 'en', role: 'owner', now });
    expect(mocks.entitlement).not.toHaveBeenCalled();
    expect(mocks.timezone).not.toHaveBeenCalled();
  });
});
