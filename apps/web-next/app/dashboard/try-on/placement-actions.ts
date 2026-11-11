'use server';

import { auth } from '@clerk/nextjs/server';
import { requireManagedTenant } from '@/lib/tenancy/managed-tenant';
import { isSiteTenantKey } from '@/lib/tenancy/tenant-key';
import { merchantActionFailure, requireMerchantRateLimit, type MerchantActionFailure } from '@/lib/request-rate-limit';
import { RoleNotAllowedError } from '@/lib/rbac/dashboard-policy';
import { previewOriginFor } from '@/lib/launch/preview-url';
import { createPickToken, isStoreOrigin } from '@/lib/try-on/pick-token';
import { readButtonPlacement, writeButtonPlacement } from '@/lib/try-on/placement-store';
import { validSpotSelector, type ButtonPlacement, type PlacementMode, type SpotPosition } from '@/lib/try-on/placement';

/* Button placement on Try-On Set up (Pack B, B1). Every action re-checks
   the settings right on the store. Pick a spot belongs to pasted code and
   WooCommerce stores (site tenants): the Shopify app block is placed in the
   theme editor. */

export type PlacementActionFailure = MerchantActionFailure & {
  /** no_store_address: the store has no trusted https address to open. */
  reason?: 'no_store_address' | 'invalid_selector' | 'no_spot';
};
export type PlacementReadResult = { ok: true; placement: ButtonPlacement } | PlacementActionFailure;
export type PlacementSetResult = { ok: true; placement: ButtonPlacement } | PlacementActionFailure;
export type PickLinkResult = { ok: true; url: string; expiresAt: string } | PlacementActionFailure;

const FORBIDDEN: PlacementActionFailure = { ok: false, code: 'forbidden', message: 'You do not have permission to change this shop.' };

function failure(error: unknown): PlacementActionFailure {
  if (error instanceof RoleNotAllowedError ||
    (error instanceof Error && ['Unauthorized', 'Unknown Shopify shop'].includes(error.message))) return FORBIDDEN;
  return merchantActionFailure(error);
}

async function siteTenant(shop: unknown): Promise<string | null> {
  const tenant = await requireManagedTenant(shop ?? 'default', { capability: 'settings' });
  return isSiteTenantKey(tenant) ? tenant : null;
}

export async function readPlacementAction(input: { shop: string }): Promise<PlacementReadResult> {
  try {
    const tenant = await siteTenant(input?.shop);
    if (!tenant) return FORBIDDEN;
    await requireMerchantRateLimit(`shop:${tenant}`, 'read');
    return { ok: true, placement: await readButtonPlacement(tenant) };
  } catch (error) {
    return failure(error);
  }
}

/** Choose a mode. The spot itself is only ever written by the store tab's
 *  Save, so a saved spot is kept while another mode is in use. */
export async function setPlacementAction(input: { shop: string; placement: PlacementMode }): Promise<PlacementSetResult> {
  try {
    const tenant = await siteTenant(input?.shop);
    if (!tenant) return FORBIDDEN;
    if (!['auto', 'spot', 'floating'].includes(input.placement)) return merchantActionFailure(null);
    await requireMerchantRateLimit(`shop:${tenant}`);
    const current = await readButtonPlacement(tenant);
    if (input.placement === 'spot' && !current.spot) return { ...merchantActionFailure(null), reason: 'no_spot' };
    const next: ButtonPlacement = { placement: input.placement, ...(current.spot ? { spot: current.spot } : {}) };
    await writeButtonPlacement(tenant, next);
    return { ok: true, placement: next };
  } catch (error) {
    return failure(error);
  }
}

/** A one-time link that opens edit mode on the store: the page the saved
 *  spot was picked on, else the store's home page. */
export async function createPickLinkAction(input: {
  shop: string;
  advanced?: { selector: string; position: SpotPosition } | null;
}): Promise<PickLinkResult> {
  try {
    const tenant = await siteTenant(input?.shop);
    if (!tenant) return FORBIDDEN;
    const advanced = input.advanced ?? null;
    if (advanced && (!validSpotSelector(advanced.selector) || !['before', 'after'].includes(advanced.position))) {
      return { ...merchantActionFailure(null), reason: 'invalid_selector' };
    }
    const { userId } = await auth();
    if (!userId) return FORBIDDEN;
    await requireMerchantRateLimit(`shop:${tenant}`);
    const [page, current] = await Promise.all([previewOriginFor(tenant), readButtonPlacement(tenant)]);
    const home = page ? new URL(page) : null;
    if (!home || !isStoreOrigin(home.origin)) return { ...merchantActionFailure(null), reason: 'no_store_address' };
    const url = current.spot ? new URL(current.spot.pathHint, home.origin) : home;
    const link = await createPickToken({ shop: tenant, origin: home.origin, createdBy: userId, preset: advanced });
    url.searchParams.set('gc_pick', link.token);
    return { ok: true, url: url.href, expiresAt: link.expiresAt };
  } catch (error) {
    return failure(error);
  }
}
