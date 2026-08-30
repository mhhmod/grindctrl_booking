import 'server-only';

import { getMessengerServiceClient } from './db';

/* Store-as-tenant.
 *
 * provisioning.ts answers "which workspaces does this Clerk user own".
 * This file answers a different question — "who owns this store's
 * configuration" — and the two must not be tangled: a store can be owned
 * by nobody in particular, which is a state a Clerk-shaped module has no
 * way to express. */

/** The one normaliser every domain lookup must share. `widget_sites` has
 *  `check (domain is null or domain = btrim(lower(domain)))` and a unique
 *  index on `lower(domain)` — a caller that only lowercases (or only
 *  trims) computes a key the index doesn't recognise, so ' Demo.shop.com'
 *  and 'demo.shop.com' would resolve as two different stores instead of
 *  colliding as they must. */
export function canonicalShopDomain(value: string): string {
  return value.trim().toLowerCase();
}

/** Synthetic profiles for stores with no account yet. `clerk_user_id` is
 *  free text with a unique index, and Clerk's own ids all begin `user_`,
 *  so this namespace cannot collide with a real one. */
export const SHOP_PROFILE_PREFIX = 'shop:';

export function shopProfileId(shopDomain: string): string {
  return `${SHOP_PROFILE_PREFIX}${canonicalShopDomain(shopDomain)}`;
}

export function isShopProfileId(clerkUserId: string): boolean {
  return clerkUserId.startsWith(SHOP_PROFILE_PREFIX);
}

export interface SiteOwner {
  id: string;
  workspace_id: string;
  domain: string | null;
  /** Clerk id of the account the site's workspace belongs to. Null only if
   *  the embed genuinely can't resolve one — workspace_id and
   *  owner_profile_id are both NOT NULL, so in practice this is always set. */
  ownerClerkUserId: string | null;
}

/** Raw PostgREST shape for the query below, before it's flattened into
 *  SiteOwner. workspace_id and owner_profile_id are both single NOT NULL
 *  FKs, so both embeds come back as an object (or null), never an array —
 *  indexing [0] here would silently read undefined, the same mistake that
 *  once made every shopper display as "anonymous" (see notify.ts). */
interface SiteOwnerRow {
  id: string;
  workspace_id: string;
  domain: string | null;
  workspaces: { profiles: { clerk_user_id: string } | null } | null;
}

function toSiteOwner(row: SiteOwnerRow): SiteOwner {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    domain: row.domain,
    ownerClerkUserId: row.workspaces?.profiles?.clerk_user_id ?? null,
  };
}

/** The site for a store, whoever owns it. Deliberately unscoped by
 *  workspace — that scoping is exactly what allowed two configurations
 *  for one storefront.
 *
 *  Comparing the column directly (instead of filtering on a lower(domain)
 *  expression PostgREST can't address) is safe because
 *  widget_sites_domain_lowercase_check now guarantees the stored value
 *  equals btrim(lower(domain)); canonicalShopDomain computes that same
 *  value on the read side, so a stored row and a lookup always agree.
 *
 *  No .limit(1): a second matching row would mean the uq_widget_sites_domain
 *  index failed to stop a duplicate, and .maybeSingle() throwing PGRST116 on
 *  that is the signal we want, not a silently-picked "first" row. */
export async function findSiteByDomain(shopDomain: string): Promise<SiteOwner | null> {
  const domain = canonicalShopDomain(shopDomain);
  if (!domain) return null;

  const res = await getMessengerServiceClient()
    .from('widget_sites')
    .select('id, workspace_id, domain, workspaces!inner(profiles!inner(clerk_user_id))')
    .eq('domain', domain)
    .maybeSingle();
  // A query error is not "no such store" — conflating the two would send a
  // real merchant's site down the "create a new one" path and straight into
  // the uq_widget_sites_domain conflict StoreOwnedByAnotherAccountError
  // exists to turn into a readable message instead of a raw 23505.
  if (res.error) throw new Error(`site lookup by domain failed: ${res.error.message}`);
  if (!res.data) return null;
  // A single cast doesn't compile here: without generated Database types,
  // supabase-js can't know workspaces/profiles are to-one FKs and infers an
  // array shape for the embed, which conflicts with the object shape the
  // schema (and toSiteOwner) actually rely on.
  return toSiteOwner(res.data as unknown as SiteOwnerRow);
}

/** Raised where a merchant will read it, so the wording is the wording. */
export class StoreOwnedByAnotherAccountError extends Error {
  constructor(readonly domain: string) {
    super('This store is already connected to another GRINDCTRL account.');
    this.name = 'StoreOwnedByAnotherAccountError';
  }
}
