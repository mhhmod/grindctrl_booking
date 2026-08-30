import 'server-only';

import { normalizeShopDomain } from '@/lib/shopify/shop-authorization';
import { ensureMessengerSite, getSiteView, type MessengerSiteView } from './provisioning';
import { findSiteByDomain, shopProfileId } from './shop-tenancy';

/* Provision Store Chat for a merchant with no Clerk account: the embedded
 * Shopify app only proves *which shop* (a verified session token), not who
 * is signed in. The domain IS the authorization here — the caller proved
 * control of this Shopify admin, so whoever owns the row in our database,
 * it is this store's configuration. Read it by domain, unscoped by owner;
 * provision under a synthetic shop profile only when no site exists yet.
 *
 * This used to route through ensureMessengerSite's owner-scoped
 * find-or-create (see IMPORTANT 2 in the review that produced this comment,
 * or just git blame): that path calls listMessengerSites(shopProfileId),
 * which only sees sites still parked in the shop profile's OWN workspace.
 * The moment a merchant claims a store — ensureMessengerSite's adoption
 * path moves the site's workspace_id to their real account — the shop
 * profile's workspace goes empty, so the next embedded-app open would find
 * nothing there, then find the site again via findSiteByDomain owned by a
 * real ownerClerkUserId, and throw StoreOwnedByAnotherAccountError at the
 * store's own merchant on every later visit. Reading by domain instead
 * means a claimed store simply keeps working: this function only ever
 * hands back what's already there or creates what doesn't exist, it never
 * insists on owning it.
 *
 * This is deliberately its own module, not a function added to
 * shop-tenancy.ts: provisioning.ts imports `auth` from
 * '@clerk/nextjs/server' at module scope, so folding this in there would
 * make shop-tenancy.ts transitively pull in Clerk's server SDK — the one
 * thing that file exists to avoid, since it expresses "a store owned by
 * nobody in particular", a state a Clerk-shaped module can't represent.
 * It would also close a cycle (provisioning.ts already imports from
 * shop-tenancy.ts) that only works today because both sides resolve their
 * imports at call time; a top-level const derived from the other side in
 * either file would turn that into a TDZ `undefined`. Importing both into a
 * third module keeps the dependency arrows one-way.
 *
 * normalizeShopDomain (not a local regex) is the validation boundary: it's
 * the app's one canonical definition of "is this a real Shopify domain",
 * already trimming and lower-casing, so it doubles as the canonicaliser
 * here too. A second, looser definition living in this file is exactly the
 * "two disagreeing definitions of which store this is" problem shop
 * tenancy exists to remove — and here specifically, a bad value provisions
 * a tenant for a store that does not exist.
 *
 * The synthetic profile keeps ensureProfile's noreply placeholder email, so
 * the handoff notifier's isPlaceholderEmail check skips it and records
 * `handoff_notify_skipped` instead of emailing anyone — correct, because an
 * unclaimed store has no owner to notify until someone claims it or sets
 * explicit recipients. It does mean the Store Chat settings UI must surface
 * the recipients field for unclaimed stores, or a handoff can go
 * unannounced with no one told. */
export async function ensureShopOwnedSite(shopDomain: string): Promise<MessengerSiteView> {
  const domain = normalizeShopDomain(shopDomain);
  if (!domain) {
    // Bounded and single-line: this string gets logged, and unbounded raw
    // input would let a caller forge log lines with embedded newlines.
    throw new Error(`Refusing to provision a store for ${JSON.stringify(shopDomain).slice(0, 120)}`);
  }

  const existing = await findSiteByDomain(domain);
  if (existing) return getSiteView(existing.id);
  return ensureMessengerSite(shopProfileId(domain), domain, domain);
}
