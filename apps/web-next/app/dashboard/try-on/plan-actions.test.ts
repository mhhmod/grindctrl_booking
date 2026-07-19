import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireManagedTryOnShop: vi.fn(),
  getShopEntitlement: vi.fn(),
  listEntitlementCatalog: vi.fn(),
  runDailyReconciliation: vi.fn(),
  runOwnerEntitlementMutation: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/shopify/shops', () => ({
  requireManagedTryOnShop: mocks.requireManagedTryOnShop,
}));

vi.mock('@/lib/try-on/entitlement', () => ({
  getShopEntitlement: mocks.getShopEntitlement,
  listEntitlementCatalog: mocks.listEntitlementCatalog,
  runDailyReconciliation: mocks.runDailyReconciliation,
  runOwnerEntitlementMutation: mocks.runOwnerEntitlementMutation,
}));

vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));

import {
  activatePlan,
  applyTopUp,
  getShopPlanState,
  listPlansCatalog,
  renewPlan,
  scheduleDowngrade,
} from './plan-actions';

describe('try-on plan owner actions', () => {
  const state = { shop: 'store-one.myshopify.com', status: 'active' };
  const mutation = { actionKey: 'action-key', replayed: false, ledgerEntryIds: ['ledger-1'] };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireManagedTryOnShop.mockImplementation(async (shop: unknown) =>
      shop === 'default' ? 'default' : 'store-one.myshopify.com',
    );
    mocks.getShopEntitlement.mockResolvedValue(state);
    mocks.listEntitlementCatalog.mockResolvedValue({ plans: [], packs: [] });
    mocks.runDailyReconciliation.mockResolvedValue(1);
    mocks.runOwnerEntitlementMutation.mockResolvedValue(mutation);
  });

  it('requires owner authorization for catalog and shop state reads', async () => {
    await expect(listPlansCatalog()).resolves.toEqual({ plans: [], packs: [] });
    await expect(getShopPlanState('store-one.myshopify.com')).resolves.toBe(state);
    expect(mocks.requireManagedTryOnShop).toHaveBeenNthCalledWith(1, 'default');
    expect(mocks.requireManagedTryOnShop).toHaveBeenNthCalledWith(
      2,
      'store-one.myshopify.com',
    );
    expect(mocks.runDailyReconciliation).toHaveBeenCalledOnce();
  });

  it('threads action keys through every owner mutation', async () => {
    await activatePlan({
      shop: 'store-one.myshopify.com',
      planKey: 'launch-v1',
      note: 'paid',
      actionKey: '11111111-1111-4111-8111-111111111111',
    });
    await renewPlan({
      shop: 'store-one.myshopify.com',
      note: 'renewed',
      actionKey: '22222222-2222-4222-8222-222222222222',
    });
    await applyTopUp({
      shop: 'store-one.myshopify.com',
      packKey: 'pack-lite-v1',
      note: 'top-up',
      actionKey: '33333333-3333-4333-8333-333333333333',
    });
    await scheduleDowngrade({
      shop: 'store-one.myshopify.com',
      planKey: 'free-v1',
      actionKey: '44444444-4444-4444-8444-444444444444',
    });

    expect(mocks.runOwnerEntitlementMutation).toHaveBeenNthCalledWith(
      1,
      'activate_tryon_plan',
      expect.objectContaining({ p_action_key: '11111111-1111-4111-8111-111111111111' }),
    );
    expect(mocks.runOwnerEntitlementMutation).toHaveBeenNthCalledWith(
      2,
      'renew_tryon_plan',
      expect.objectContaining({ p_action_key: '22222222-2222-4222-8222-222222222222' }),
    );
    expect(mocks.runOwnerEntitlementMutation).toHaveBeenNthCalledWith(
      3,
      'apply_tryon_top_up',
      expect.objectContaining({ p_action_key: '33333333-3333-4333-8333-333333333333' }),
    );
    expect(mocks.runOwnerEntitlementMutation).toHaveBeenNthCalledWith(
      4,
      'schedule_tryon_downgrade',
      expect.objectContaining({ p_action_key: '44444444-4444-4444-8444-444444444444' }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledTimes(4);
  });
});
