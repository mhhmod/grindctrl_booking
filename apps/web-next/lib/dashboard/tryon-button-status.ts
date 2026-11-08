import 'server-only';

import { tryOnLaunchFromEntitlement, type TryOnLaunchReason } from '@/lib/try-on/launch';
import type { ShopEntitlement } from '@/lib/try-on/entitlement';
import type { LaunchState } from '@/lib/launch/audience';

/* What the Try-On page header says about the storefront button, for every
   platform. The storefront itself decides through getTryOnLaunch /
   readSiteLaunch; this names the same blockers for the merchant, plus the
   two the storefront only knows per visitor or per request (installed, and
   the preview launch state).

   on             shoppers see the button
   off            the merchant switched it off (reason `paused`)
   not_installed  nothing on the store can show it yet
   not_ready      installed and switched on, but something else blocks it:
                  `preview`, `plan_inactive`, `out_of_looks` or `unavailable` */
export type TryOnState = 'on' | 'off' | 'not_installed' | 'not_ready';

export type TryOnButtonStatus = {
  /** The switch as saved; may be false whatever the state says. */
  showButton: boolean;
  tryOnState: TryOnState;
  /** null when on. */
  reason: TryOnLaunchReason | null;
  /** A pasted Shopify install running older code than the snippet we hand
   *  out now (lib/paste/status.ts pasteCodeOutdated); false when unknown,
   *  and for the Shopify app, WooCommerce and website code. */
  codeOutdated: boolean;
};

export function tryOnButtonStatus({
  installed,
  showButton,
  entitlement,
  launchState,
  codeOutdated = false,
}: {
  installed: boolean;
  showButton: boolean;
  /** null when it could not be read. */
  entitlement: Pick<ShopEntitlement, 'available' | 'status' | 'totalCreditsRemaining'> | null;
  /** The store's launch state; 'live' when preview mode is off for it. */
  launchState: LaunchState;
  codeOutdated?: boolean;
}): TryOnButtonStatus {
  const state = (tryOnState: TryOnState, reason: TryOnLaunchReason | null): TryOnButtonStatus =>
    ({ showButton, tryOnState, reason, codeOutdated });
  if (!installed) return state('not_installed', 'not_installed');
  if (!showButton) return state('off', 'paused');
  // Same order as the pasted-code install status: preview, then the plan.
  if (launchState === 'setup' || launchState === 'preview') return state('not_ready', 'preview');
  if (!entitlement) return state('not_ready', 'unavailable');
  const launch = tryOnLaunchFromEntitlement(entitlement);
  if (launch.tryOn === 'live') return state('on', null);
  return launch.reason === 'not_installed' ? state('not_installed', 'not_installed') : state('not_ready', launch.reason);
}
