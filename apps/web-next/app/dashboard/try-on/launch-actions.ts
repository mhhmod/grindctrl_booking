'use server';

import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { requireManagedTryOnShop } from '@/lib/shopify/shops';
import { requireMerchantRateLimit, merchantActionFailure, type MerchantActionFailure } from '@/lib/request-rate-limit';
import { storeFlags } from '@/lib/flags/store-flags';
import { writeStoreLaunch } from '@/lib/launch/store-launch';
import { signPreviewTokenForShop } from '@/lib/launch/preview-token';
import { requireTryOnPlatformOperator, PlatformOperatorRequiredError } from '@/lib/shopify/platform-operator';
import { LAUNCH_STATES, type LaunchState } from '@/lib/launch/audience';
import { RoleNotAllowedError } from '@/lib/rbac/dashboard-policy';

/* Launch state from the dashboard (N5 and N6, phase zero item 9).
   setLaunchState and createPreviewLink act for the store's owner or an
   admin (item 12), and only while the store's n5_preview_mode flag is on
   (holdout also needs n6_holdout). setLaunchStateAsOperator lets the
   platform operator put any store in any state, for testing. */

export type LaunchActionResult =
  | { ok: true; state: LaunchState }
  | MerchantActionFailure
  | { ok: false; code: 'invalid' | 'not_enabled'; message: string };

export type PreviewLinkResult =
  | { ok: true; url: string; expiresAt: string }
  | MerchantActionFailure
  | { ok: false; code: 'not_enabled'; message: string };

const FORBIDDEN: MerchantActionFailure = {
  ok: false,
  code: 'forbidden',
  message: 'You do not have permission to change this shop.',
};
const NOT_ENABLED = { ok: false as const, code: 'not_enabled' as const, message: 'This is not available for this store yet.' };

function ownershipFailure(error: unknown): MerchantActionFailure | null {
  if (error instanceof RoleNotAllowedError) return FORBIDDEN;
  return error instanceof Error && ['Unauthorized', 'Unknown Shopify shop'].includes(error.message) ? FORBIDDEN : null;
}

/** The owner goes live, for everyone or as a 50/50 test, or back to preview. */
export async function setLaunchState(input: { shop: string; state: 'preview' | 'live' | 'holdout' }): Promise<LaunchActionResult> {
  try {
    const shop = await requireManagedTryOnShop(input.shop, { capability: 'settings' });
    if (input.state !== 'preview' && input.state !== 'live' && input.state !== 'holdout') {
      return { ok: false, code: 'invalid', message: 'Unknown launch state.' };
    }
    const features = await storeFlags({ shopDomain: shop });
    if (!features.includes('n5_preview_mode')) return NOT_ENABLED;
    if (input.state === 'holdout' && !features.includes('n6_holdout')) return NOT_ENABLED;
    await requireMerchantRateLimit(`shop:${shop}`);
    const { userId } = await auth();
    const saved = await writeStoreLaunch(shop, { state: input.state }, userId ?? 'owner');
    revalidatePath('/dashboard/try-on');
    return { ok: true, state: saved?.state ?? input.state };
  } catch (error) {
    return ownershipFailure(error) ?? merchantActionFailure(error);
  }
}

/** A 24-hour link that shows the owner GrindCTRL on their own store, with
 *  free test looks, before it is live. */
export async function createPreviewLink(input: { shop: string }): Promise<PreviewLinkResult> {
  try {
    const shop = await requireManagedTryOnShop(input.shop, { capability: 'settings' });
    const features = await storeFlags({ shopDomain: shop });
    if (!features.includes('n5_preview_mode')) return NOT_ENABLED;
    await requireMerchantRateLimit(`shop:${shop}`, 'read');
    const signed = signPreviewTokenForShop(shop);
    if (!signed) return merchantActionFailure(null);
    /* The myshopify domain redirects to the store's primary domain and keeps
       the query, so the token lands in storage on the domain shoppers use. */
    return { ok: true, url: `https://${shop}/?gc_preview=${encodeURIComponent(signed.token)}`, expiresAt: signed.expiresAt };
  } catch (error) {
    return ownershipFailure(error) ?? merchantActionFailure(error);
  }
}

/** The platform operator sets any store's state, flags aside, for testing. */
export async function setLaunchStateAsOperator(input: { shop: string; state: string }): Promise<LaunchActionResult> {
  try {
    const operator = await requireTryOnPlatformOperator();
    if (!LAUNCH_STATES.includes(input.state as LaunchState)) {
      return { ok: false, code: 'invalid', message: 'Unknown launch state.' };
    }
    await requireMerchantRateLimit(`operator:${operator}`);
    const saved = await writeStoreLaunch(input.shop, { state: input.state as LaunchState }, operator);
    revalidatePath('/dashboard/try-on');
    return { ok: true, state: saved?.state ?? (input.state as LaunchState) };
  } catch (error) {
    if (error instanceof PlatformOperatorRequiredError) return FORBIDDEN;
    return merchantActionFailure(error);
  }
}
