import { beforeEach, describe, expect, it, vi } from 'vitest';

const SITE = '11111111-1111-4111-8111-111111111111';
const KEY = `site:${SITE}`;

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  tenant: vi.fn(),
  limit: vi.fn(),
  getShopEntitlement: vi.fn(),
  runOwnerEntitlementMutation: vi.fn(),
}));

vi.mock('@clerk/nextjs/server', () => ({ auth: mocks.auth }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/tenancy/managed-tenant', () => ({ requireManagedTenant: mocks.tenant }));
vi.mock('@/lib/request-rate-limit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/request-rate-limit')>()),
  requireMerchantRateLimit: mocks.limit,
}));
vi.mock('@/lib/try-on/entitlement', () => ({
  getShopEntitlement: mocks.getShopEntitlement,
  listEntitlementCatalog: vi.fn(),
  reconcileShopSubscription: vi.fn(),
  runOwnerEntitlementMutation: mocks.runOwnerEntitlementMutation,
}));

import { activatePlan, renewPlan } from './plan-actions';

const ACTION = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('TRYON_PLATFORM_OPERATOR_CLERK_IDS', 'user_operator');
  mocks.auth.mockResolvedValue({ userId: 'user_operator' });
  mocks.tenant.mockResolvedValue(KEY);
  mocks.getShopEntitlement.mockResolvedValue({ shop: KEY, status: 'active' });
  mocks.runOwnerEntitlementMutation.mockResolvedValue({ actionKey: ACTION, replayed: false, ledgerEntryIds: [] });
});

describe('manual plan activation for a WooCommerce store', () => {
  it('activates a paid plan on the site tenant once the operator and the store owner check out', async () => {
    const result = await activatePlan({ shop: KEY, planKey: 'launch-v1', note: 'paid by transfer', actionKey: ACTION });
    expect(result).toMatchObject({ ok: true });
    expect(mocks.tenant).toHaveBeenCalledWith(KEY, { capability: 'billing' });
    expect(mocks.limit).toHaveBeenCalledWith(`shop:${KEY}`);
    expect(mocks.runOwnerEntitlementMutation).toHaveBeenCalledWith(
      'activate_tryon_plan',
      expect.objectContaining({ p_shop_domain: KEY, p_plan_key: 'launch-v1' }),
    );
  });

  it('refuses a signed-in store owner who is not the platform operator, before reading the store', async () => {
    mocks.auth.mockResolvedValue({ userId: 'user_merchant' });
    expect(await renewPlan({ shop: KEY, note: '', actionKey: ACTION })).toMatchObject({ ok: false, code: 'forbidden' });
    expect(mocks.tenant).not.toHaveBeenCalled();
    expect(mocks.runOwnerEntitlementMutation).not.toHaveBeenCalled();
  });

  it('refuses a site the operator does not own as a store owner', async () => {
    mocks.tenant.mockRejectedValue(new Error('Unknown Shopify shop'));
    expect(await renewPlan({ shop: KEY, note: '', actionKey: ACTION })).toMatchObject({ ok: false, code: 'forbidden' });
    expect(mocks.runOwnerEntitlementMutation).not.toHaveBeenCalled();
  });
});
