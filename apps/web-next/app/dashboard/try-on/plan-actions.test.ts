import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requireMerchantRateLimit, RequestRateLimitError } from '@/lib/request-rate-limit';
vi.mock('@/lib/request-rate-limit', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/request-rate-limit')>(),
  requireMerchantRateLimit: vi.fn(),
}));

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  requireManagedTryOnShop: vi.fn(),
  getShopEntitlement: vi.fn(),
  listEntitlementCatalog: vi.fn(),
  reconcileShopSubscription: vi.fn(),
  runOwnerEntitlementMutation: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('@clerk/nextjs/server', () => ({ auth: mocks.auth }));
afterEach(() => { vi.unstubAllEnvs(); });

vi.mock('@/lib/shopify/shops', () => ({
  requireManagedTryOnShop: mocks.requireManagedTryOnShop,
}));

vi.mock('@/lib/try-on/entitlement', () => ({
  getShopEntitlement: mocks.getShopEntitlement,
  listEntitlementCatalog: mocks.listEntitlementCatalog,
  reconcileShopSubscription: mocks.reconcileShopSubscription,
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
  it('denies mutation before entitlement work using the ownership-resolved domain', async () => {
    vi.mocked(requireMerchantRateLimit).mockRejectedValueOnce(new RequestRateLimitError(429, 12));
    await expect(renewPlan({ shop: 'forged.myshopify.com', note: 'test', actionKey: 'a' })).resolves.toMatchObject({ ok: false, code: 'rate_limited', retryAfterSeconds: 12 });
    expect(requireMerchantRateLimit).toHaveBeenCalledWith('shop:store-one.myshopify.com');
    expect(mocks.runOwnerEntitlementMutation).not.toHaveBeenCalled();
  });
  const state = { shop: 'store-one.myshopify.com', status: 'active' };
  const mutation = { actionKey: 'action-key', replayed: false, ledgerEntryIds: ['ledger-1'] };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('TRYON_PLATFORM_OPERATOR_CLERK_IDS', 'user_operator');
    mocks.auth.mockResolvedValue({ userId: 'user_operator' });
    mocks.requireManagedTryOnShop.mockImplementation(async (shop: unknown) =>
      shop === 'default' ? 'default' : 'store-one.myshopify.com',
    );
    mocks.getShopEntitlement.mockResolvedValue(state);
    mocks.listEntitlementCatalog.mockResolvedValue({ plans: [], packs: [] });
    mocks.reconcileShopSubscription.mockResolvedValue(undefined);
    mocks.runOwnerEntitlementMutation.mockResolvedValue(mutation);
  });

  it('refuses ordinary shop owners and missing operator configuration before any RPC or limiter', async () => {
    mocks.auth.mockResolvedValue({ userId: 'user_merchant' });
    expect(await activatePlan({ shop: state.shop, planKey: 'launch-v1', note: 'self-grant', actionKey: 'a' }))
      .toMatchObject({ ok: false, code: 'forbidden' });
    mocks.auth.mockResolvedValue({ userId: 'user_operator' });
    vi.stubEnv('TRYON_PLATFORM_OPERATOR_CLERK_IDS', '');
    expect(await applyTopUp({ shop: state.shop, packKey: 'pack', note: '', actionKey: 'b' }))
      .toMatchObject({ ok: false, code: 'forbidden' });
    expect(mocks.requireManagedTryOnShop).not.toHaveBeenCalled();
    expect(requireMerchantRateLimit).not.toHaveBeenCalled();
    expect(mocks.runOwnerEntitlementMutation).not.toHaveBeenCalled();
  });

  it('still refuses a configured operator who does not own the requested shop', async () => {
    mocks.requireManagedTryOnShop.mockRejectedValueOnce(new Error('Unknown Shopify shop'));
    expect(await renewPlan({ shop: 'foreign.myshopify.com', note: '', actionKey: 'a' }))
      .toMatchObject({ ok: false, code: 'forbidden' });
    expect(requireMerchantRateLimit).not.toHaveBeenCalled();
    expect(mocks.runOwnerEntitlementMutation).not.toHaveBeenCalled();
  });

  it('requires owner authorization for catalog and shop state reads', async () => {
    await expect(listPlansCatalog()).resolves.toEqual({ plans: [], packs: [] });
    await expect(getShopPlanState('store-one.myshopify.com')).resolves.toBe(state);
    /* Both are reads, so both opt in to the global row explicitly. The opt-in
       is the point: requireManagedTryOnShop now refuses 'default' by default,
       so a write path that forgets to ask cannot edit the platform-wide
       baseline every merchant inherits. */
    expect(mocks.requireManagedTryOnShop).toHaveBeenNthCalledWith(1, 'default', {
      allowGlobalDefault: true,
    });
    expect(mocks.requireManagedTryOnShop).toHaveBeenNthCalledWith(
      2,
      'store-one.myshopify.com',
      { allowGlobalDefault: true },
    );
    expect(mocks.reconcileShopSubscription).toHaveBeenCalledExactlyOnceWith('store-one.myshopify.com');
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
