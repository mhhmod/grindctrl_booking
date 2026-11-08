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
};

export function tryOnButtonStatus({
  installed,
  showButton,
  entitlement,
  launchState,
}: {
  installed: boolean;
  showButton: boolean;
  /** null when it could not be read. */
  entitlement: Pick<ShopEntitlement, 'available' | 'status' | 'totalCreditsRemaining'> | null;
  /** The store's launch state; 'live' when preview mode is off for it. */
  launchState: LaunchState;
}): TryOnButtonStatus {
  if (!installed) return { showButton, tryOnState: 'not_installed', reason: 'not_installed' };
  if (!showButton) return { showButton, tryOnState: 'off', reason: 'paused' };
  // Same order as the pasted-code install status: preview, then the plan.
  if (launchState === 'setup' || launchState === 'preview') return { showButton, tryOnState: 'not_ready', reason: 'preview' };
  if (!entitlement) return { showButton, tryOnState: 'not_ready', reason: 'unavailable' };
  const launch = tryOnLaunchFromEntitlement(entitlement);
  if (launch.tryOn === 'live') return { showButton, tryOnState: 'on', reason: null };
  return launch.reason === 'not_installed'
    ? { showButton, tryOnState: 'not_installed', reason: 'not_installed' }
    : { showButton, tryOnState: 'not_ready', reason: launch.reason };
}
