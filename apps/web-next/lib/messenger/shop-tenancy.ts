import 'server-only';

import { getMessengerServiceClient } from './db';

/* Store-as-tenant.
 *
 * provisioning.ts answers "which workspaces does this Clerk user own".
 * This file answers a different question — "who owns this store's
 * configuration" — and the two must not be tangled: a store can be owned
 * by nobody in particular, which is a state a Clerk-shaped module has no
 * way to express. */

/** Synthetic profiles for stores with no account yet. `clerk_user_id` is
 *  free text with a unique index, and Clerk's own ids all begin `user_`,
 *  so this namespace cannot collide with a real one. */
export const SHOP_PROFILE_PREFIX = 'shop:';

export function shopProfileId(shopDomain: string): string {
  return `${SHOP_PROFILE_PREFIX}${shopDomain.trim().toLowerCase()}`;
}

export function isShopProfileId(clerkUserId: string): boolean {
  return clerkUserId.startsWith(SHOP_PROFILE_PREFIX);
}

export interface SiteOwner {
  id: string;
  workspace_id: string;
  domain: string | null;
}

/** The site for a store, whoever owns it. Deliberately unscoped by
 *  workspace — that scoping is exactly what allowed two configurations
 *  for one storefront.
 *
 *  Comparing the column directly is safe because
 *  widget_sites_domain_lowercase_check guarantees the stored value is
 *  already canonical; PostgREST cannot address the lower(domain)
 *  expression the unique index is built on. */
export async function findSiteByDomain(shopDomain: string): Promise<SiteOwner | null> {
  const domain = shopDomain.trim().toLowerCase();
  if (!domain) return null;

  const res = await getMessengerServiceClient()
    .from('widget_sites')
    .select('id, workspace_id, domain')
    .eq('domain', domain)
    .maybeSingle();
  if (res.error || !res.data) return null;
  return res.data as unknown as SiteOwner;
}

/** Raised where a merchant will read it, so the wording is the wording. */
export class StoreOwnedByAnotherAccountError extends Error {
  constructor(readonly domain: string) {
    super('This store is already connected to another GRINDCTRL account.');
    this.name = 'StoreOwnedByAnotherAccountError';
  }
}
