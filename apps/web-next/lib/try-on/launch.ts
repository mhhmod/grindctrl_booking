import 'server-only';

import { getShopEntitlement, type ShopEntitlement } from './entitlement';

/* Whether the storefront may show the Try it on button, and why not.
   Contract N34 in docs/handoff/product-v16/09-backend-contracts.md.

   Today the answer comes from what exists: the install, the plan status
   and the looks left. The reasons list already names the launch state
   (preview, holdout, phase zero item 9) and the per-product pause (paused,
   item 18) so those can join without changing the shape the storefront
   reads. `unavailable` is ours: the entitlement could not be read, which
   is not the same as any of the merchant states above. */
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

/** The launch answer for a shop. Never throws: a failed read is reported
 *  as `unavailable` so callers can decide whether to cache it. */
export async function getTryOnLaunch(shop: string | null): Promise<TryOnLaunch> {
  if (!shop) return { tryOn: 'hidden', reason: 'not_installed' };
  try {
    return tryOnLaunchFromEntitlement(await getShopEntitlement(shop));
  } catch {
    return { tryOn: 'hidden', reason: 'unavailable' };
  }
}
