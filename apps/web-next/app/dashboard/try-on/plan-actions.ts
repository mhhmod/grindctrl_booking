'use server';

import { revalidatePath } from 'next/cache';
import { requireManagedTryOnShop } from '@/lib/shopify/shops';
import { requireMerchantRateLimit, merchantActionFailure, type MerchantActionFailure } from '@/lib/request-rate-limit';
import { requireTryOnPlatformOperator, PlatformOperatorRequiredError } from '@/lib/shopify/platform-operator';
import {
  getShopEntitlement,
  listEntitlementCatalog,
  reconcileShopSubscription,
  runOwnerEntitlementMutation,
  type OwnerMutationResult,
  type ShopEntitlement,
} from '@/lib/try-on/entitlement';

export type OwnerPlanActionResult = (OwnerMutationResult & {
  ok: true;
  state: ShopEntitlement;
}) | MerchantActionFailure;

async function runManualPlanAction(
  shop: unknown,
  name: Parameters<typeof runOwnerEntitlementMutation>[0],
  params: Record<string, unknown> & { p_action_key: string },
): Promise<OwnerPlanActionResult> {
  try {
    await requireTryOnPlatformOperator();
    const domain = await requireManagedTryOnShop(shop);
    await requireMerchantRateLimit(`shop:${domain}`);
    const result = await runOwnerEntitlementMutation(name, { ...params, p_shop_domain: domain });
    revalidatePath('/dashboard/try-on');
    return { ...result, ok: true, state: await getShopEntitlement(domain) };
  } catch (error) {
    if (error instanceof PlatformOperatorRequiredError ||
      (error instanceof Error && ['Unauthorized', 'Unknown Shopify shop'].includes(error.message))) {
      return { ok: false, code: 'forbidden', message: 'You do not have permission to perform this action.' };
    }
    return merchantActionFailure(error);
  }
}

export async function listPlansCatalog() {
  // Read-only: this needs "is a signed-in dashboard user", not authority over
  // the global row, so it opts in deliberately rather than by accident.
  await requireManagedTryOnShop('default', { allowGlobalDefault: true });
  return listEntitlementCatalog();
}

/* The global-defaults view has no per-shop plan, so 'default' returns a
   neutral state instead of hitting getShopEntitlement, which requires a
   real myshopify domain. */
const NO_SHOP_PLAN_STATE: ShopEntitlement = {
  shop: 'default',
  subscriptionId: null,
  planId: null,
  planKey: null,
  planName: null,
  status: 'none',
  isFree: false,
  rendersIncluded: 0,
  planCreditsRemaining: 0,
  topUpCreditsRemaining: 0,
  totalCreditsRemaining: 0,
  currentPeriodStart: null,
  currentPeriodEnd: null,
  graceEndsAt: null,
  daysRemaining: 0,
  bannerState: 'none',
  available: false,
  pendingPlanKey: null,
  pendingPlanEffectiveAt: null,
  notes: null,
};

export async function getShopPlanState(shop: unknown): Promise<ShopEntitlement> {
  // Read-only: the global-defaults view resolves to a neutral, empty plan
  // state below and never reaches a per-shop entitlement.
  const domain = await requireManagedTryOnShop(shop, { allowGlobalDefault: true });
  if (domain === 'default') return NO_SHOP_PLAN_STATE;
  await requireMerchantRateLimit(`shop:${domain}`, 'read');
  await reconcileShopSubscription(domain);
  return getShopEntitlement(domain);
}

export async function activatePlan(input: {
  shop: unknown;
  planKey: string;
  note: string;
  actionKey: string;
}): Promise<OwnerPlanActionResult> {
  return runManualPlanAction(input.shop, 'activate_tryon_plan', {
    p_plan_key: input.planKey,
    p_note: input.note,
    p_action_key: input.actionKey,
  });
}

export async function renewPlan(input: {
  shop: unknown;
  note: string;
  actionKey: string;
}): Promise<OwnerPlanActionResult> {
  return runManualPlanAction(input.shop, 'renew_tryon_plan', {
    p_note: input.note,
    p_action_key: input.actionKey,
  });
}

export async function applyTopUp(input: {
  shop: unknown;
  packKey: string;
  note: string;
  actionKey: string;
}): Promise<OwnerPlanActionResult> {
  return runManualPlanAction(input.shop, 'apply_tryon_top_up', {
    p_pack_key: input.packKey,
    p_note: input.note,
    p_action_key: input.actionKey,
  });
}

export async function scheduleDowngrade(input: {
  shop: unknown;
  planKey: string;
  actionKey: string;
}): Promise<OwnerPlanActionResult> {
  return runManualPlanAction(input.shop, 'schedule_tryon_downgrade', {
    p_plan_key: input.planKey,
    p_action_key: input.actionKey,
  });
}
