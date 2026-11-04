// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  userId: vi.fn(),
  sites: vi.fn(),
  active: vi.fn(),
  shop: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@clerk/nextjs/server', () => ({ auth: async () => ({ userId: mocks.userId() }) }));
vi.mock('@/lib/messenger/provisioning', () => ({ listMessengerSitesReadOnly: mocks.sites }));
vi.mock('@/lib/shopify/tokens', () => ({ isActiveTenant: mocks.active }));
vi.mock('@/lib/shopify/shops', () => ({ requireManagedTryOnShop: mocks.shop }));

import { RoleNotAllowedError } from '@/lib/rbac/dashboard-policy';
import { requireManagedTenant } from './managed-tenant';

const SITE = '11111111-1111-4111-8111-111111111111';
const KEY = `site:${SITE}`;

beforeEach(() => {
  vi.resetAllMocks();
  mocks.userId.mockReturnValue('user_1');
  mocks.sites.mockResolvedValue([{ id: SITE, name: 'Shop', domain: 'shop.example', role: 'owner' }]);
  mocks.active.mockResolvedValue(true);
  mocks.shop.mockResolvedValue('alpha.myshopify.com');
});

describe('requireManagedTenant', () => {
  it('hands a Shopify shop and the default row to the shop check, options intact', async () => {
    await expect(requireManagedTenant('alpha.myshopify.com', { capability: 'billing' })).resolves.toBe('alpha.myshopify.com');
    expect(mocks.shop).toHaveBeenCalledWith('alpha.myshopify.com', { capability: 'billing' });
    await requireManagedTenant('default', { allowGlobalDefault: true });
    expect(mocks.shop).toHaveBeenLastCalledWith('default', { allowGlobalDefault: true });
  });

  it('admits the owner of an active WooCommerce site', async () => {
    await expect(requireManagedTenant(KEY.toUpperCase(), { capability: 'billing' })).resolves.toBe(KEY);
    expect(mocks.active).toHaveBeenCalledWith(KEY);
  });

  it('refuses a site the caller does not have, a disconnected one, and a signed-out caller', async () => {
    mocks.sites.mockResolvedValue([]);
    await expect(requireManagedTenant(KEY)).rejects.toThrow('Unknown Shopify shop');
    mocks.sites.mockResolvedValue([{ id: SITE, name: '', domain: null, role: 'owner' }]);
    mocks.active.mockResolvedValue(false);
    await expect(requireManagedTenant(KEY)).rejects.toThrow('Unknown Shopify shop');
    mocks.userId.mockReturnValue(null);
    await expect(requireManagedTenant(KEY)).rejects.toThrow('Unauthorized');
  });

  it('applies the role: an admin may change settings but never billing', async () => {
    mocks.sites.mockResolvedValue([{ id: SITE, name: '', domain: null, role: 'admin' }]);
    await expect(requireManagedTenant(KEY, { capability: 'settings' })).resolves.toBe(KEY);
    await expect(requireManagedTenant(KEY, { capability: 'billing' })).rejects.toBeInstanceOf(RoleNotAllowedError);
  });
});
