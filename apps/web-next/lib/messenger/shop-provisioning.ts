import 'server-only';

import { normalizeShopDomain } from '@/lib/shopify/shop-authorization';
import { ensureMessengerSite, type MessengerSiteView } from './provisioning';
import { shopProfileId } from './shop-tenancy';

/* Provision Store Chat for a merchant with no Clerk account: the embedded
 * Shopify app only proves *which shop* (a verified session token), not who
 * is signed in. ensureMessengerSite already does profile -> workspace ->
 * find-or-create-site and is domain-aware (adopt-or-refuse by owner), so
 * "a store with no account" needs nothing more than a synthetic
 * clerk_user_id to hang that machinery off of — clerk_user_id is free text
 * with a unique index, so shopProfileId's `shop:` namespace is enough to
 * keep it from ever colliding with a real Clerk id.
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
  if (!domain) throw new Error(`Refusing to provision a store for "${shopDomain}"`);
  return ensureMessengerSite(shopProfileId(domain), domain, domain);
}
