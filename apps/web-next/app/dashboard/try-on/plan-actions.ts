'use server';

import { revalidatePath } from 'next/cache';
import { requireManagedTryOnShop } from '@/lib/shopify/shops';
import {
  getShopEntitlement,
  listEntitlementCatalog,
  runDailyReconciliation,
  runOwnerEntitlementMutation,
  type OwnerMutationResult,
  type ShopEntitlement,
} from '@/lib/try-on/entitlement';

export type OwnerPlanActionResult = OwnerMutationResult & {
  state: ShopEntitlement;
};

export async function listPlansCatalog() {
  await requireManagedTryOnShop('default');
  return listEntitlementCatalog();
}

export async function getShopPlanState(shop: unknown): Promise<ShopEntitlement> {
  const domain = await requireManagedTryOnShop(shop);
  await runDailyReconciliation();
  return getShopEntitlement(domain);
}

export async function activatePlan(input: {
  shop: unknown;
  planKey: string;
  note: string;
  actionKey: string;
}): Promise<OwnerPlanActionResult> {
  const domain = await requireManagedTryOnShop(input.shop);
  const result = await runOwnerEntitlementMutation('activate_tryon_plan', {
    p_shop_domain: domain,
    p_plan_key: input.planKey,
    p_note: input.note,
    p_action_key: input.actionKey,
  });
  revalidatePath('/dashboard/try-on');
  return { ...result, state: await getShopEntitlement(domain) };
}

export async function renewPlan(input: {
  shop: unknown;
  note: string;
  actionKey: string;
}): Promise<OwnerPlanActionResult> {
  const domain = await requireManagedTryOnShop(input.shop);
  const result = await runOwnerEntitlementMutation('renew_tryon_plan', {
    p_shop_domain: domain,
    p_note: input.note,
    p_action_key: input.actionKey,
  });
  revalidatePath('/dashboard/try-on');
  return { ...result, state: await getShopEntitlement(domain) };
}

export async function applyTopUp(input: {
  shop: unknown;
  packKey: string;
  note: string;
  actionKey: string;
}): Promise<OwnerPlanActionResult> {
  const domain = await requireManagedTryOnShop(input.shop);
  const result = await runOwnerEntitlementMutation('apply_tryon_top_up', {
    p_shop_domain: domain,
    p_pack_key: input.packKey,
    p_note: input.note,
    p_action_key: input.actionKey,
  });
  revalidatePath('/dashboard/try-on');
  return { ...result, state: await getShopEntitlement(domain) };
}

export async function scheduleDowngrade(input: {
  shop: unknown;
  planKey: string;
  actionKey: string;
}): Promise<OwnerPlanActionResult> {
  const domain = await requireManagedTryOnShop(input.shop);
  const result = await runOwnerEntitlementMutation('schedule_tryon_downgrade', {
    p_shop_domain: domain,
    p_plan_key: input.planKey,
    p_action_key: input.actionKey,
  });
  revalidatePath('/dashboard/try-on');
  return { ...result, state: await getShopEntitlement(domain) };
}
