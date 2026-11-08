import 'server-only';

import { getShopEntitlement, type ShopEntitlement } from './entitlement';
import { readTryOnShowButton } from './settings';

/* Whether the storefront may show the Try it on button, and why not.
   Contract N34 in docs/handoff/product-v16/09-backend-contracts.md.

   The answer comes from the merchant's own button switch (paused, the
   show_button setting) and then from what exists: the install, the plan
   status and the looks left. Every storefront path (Shopify App Proxy,
   WooCommerce, pasted code) reads it through getTryOnLaunch or
   readSiteLaunch, so the switch holds on every platform. The reasons list
   also names the launch state (preview, holdout, phase zero item 9),
   which the routes add per visitor. `unavailable` is ours: a read failed,
   which is not the same as any of the merchant states above. */
export type TryOnLaunchReason =
  | 'out_of_looks'
  | 'paused'
  | 'preview'
  | 'holdout'
  | 'not_installed'
  | 'plan_inactive'
  | 'unavailable';

export type TryOnLaunch =
  | { tryOn: 'live'; reason: null }
  | { tryOn: 'hidden'; reason: TryOnLaunchReason };

const LIVE: TryOnLaunch = { tryOn: 'live', reason: null };
export const PAUSED: TryOnLaunch = { tryOn: 'hidden', reason: 'paused' };

/* `available` is installed AND an active or grace plan AND looks left
   (entitlement.ts). The order here names the merchant's real blocker:
   a lapsed plan before an empty balance, and an uninstalled store only
   when the plan and the looks would otherwise allow it. */
export function tryOnLaunchFromEntitlement(
  entitlement: Pick<ShopEntitlement, 'available' | 'status' | 'totalCreditsRemaining'>,
): TryOnLaunch {
  if (entitlement.available) return LIVE;
  if (entitlement.status !== 'active' && entitlement.status !== 'grace') {
    return { tryOn: 'hidden', reason: 'plan_inactive' };
  }
  if (entitlement.totalCreditsRemaining <= 0) return { tryOn: 'hidden', reason: 'out_of_looks' };
  return { tryOn: 'hidden', reason: 'not_installed' };
}

/** The launch answer for a tenant (a myshopify domain or `site:<uuid>`).
 *  A button the merchant switched off is `paused` whatever the plan says:
 *  it is their choice, and no look may start, preview links included.
 *  Never throws: a failed read is reported as `unavailable` so callers can
 *  decide whether to cache it. */
export async function getTryOnLaunch(shop: string | null): Promise<TryOnLaunch> {
  if (!shop) return { tryOn: 'hidden', reason: 'not_installed' };
  const [showButton, entitlement] = await Promise.allSettled([readTryOnShowButton(shop), getShopEntitlement(shop)]);
  // Switched off is paused even when the plan could not be read.
  if (showButton.status === 'fulfilled' && !showButton.value) return PAUSED;
  if (showButton.status === 'rejected' || entitlement.status === 'rejected') {
    return { tryOn: 'hidden', reason: 'unavailable' };
  }
  return tryOnLaunchFromEntitlement(entitlement.value);
}
