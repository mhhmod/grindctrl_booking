/* One active store across the dashboard (v16 phase zero item 33).

   A store is a Shopify shop or a Store Chat site, and a Store Chat site on
   a Shopify store is that shop. The dashboard resolves which one is active
   once per request: a valid value on the link (`?shop=` or `?site=`), then
   the one chosen last (the `gc-store` cookie), then the most recently
   active installed shop. Every value is only a choice among the stores the
   caller owns, so a forged or stale one falls back like a missing one.

   This module is pure so the rule can be tested on its own; the request
   wiring is in active-store-server.ts. */

import { normalizeShopDomain } from '@/lib/shopify/shop-authorization';

export const ACTIVE_STORE_COOKIE = 'gc-store';
/** The proxy copies the link's choice here for the request it serves, so a
 *  layout, which never sees the query, resolves the same store as the page. */
export const ACTIVE_STORE_HEADER = 'x-gc-store';

export type StoreChoice = { shop: string } | { site: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** A choice from a link's query, or null when it names no valid store. */
export function storeChoiceFromQuery(query: { shop?: unknown; site?: unknown }): StoreChoice | null {
  const shop = normalizeShopDomain(query.shop);
  if (shop) return { shop };
  if (typeof query.site === 'string' && UUID_RE.test(query.site)) return { site: query.site.toLowerCase() };
  return null;
}

export function formatStoreChoice(choice: StoreChoice): string {
  return 'shop' in choice ? `shop:${choice.shop}` : `site:${choice.site}`;
}

export function parseStoreChoice(value: string | null | undefined): StoreChoice | null {
  if (!value) return null;
  const separator = value.indexOf(':');
  if (separator < 0) return null;
  const kind = value.slice(0, separator);
  const rest = value.slice(separator + 1);
  if (kind === 'shop') return storeChoiceFromQuery({ shop: rest });
  if (kind === 'site') return storeChoiceFromQuery({ site: rest });
  return null;
}

export type StoreCandidateShop = { domain: string; status: 'installed' | 'uninstalled'; lastSeenAt: string };
export type StoreCandidateSite = { id: string; domain: string | null };

export type ActiveStore = {
  /** The Shopify shop, when the active store is one. */
  shopDomain: string | null;
  /** Its Store Chat site, when it has one. */
  siteId: string | null;
};

function siteForShop(sites: readonly StoreCandidateSite[], shopDomain: string): StoreCandidateSite | undefined {
  return sites.find((site) => site.domain?.trim().toLowerCase() === shopDomain);
}

function fromShop(shopDomain: string, sites: readonly StoreCandidateSite[]): ActiveStore {
  return { shopDomain, siteId: siteForShop(sites, shopDomain)?.id ?? null };
}

function fromSite(site: StoreCandidateSite, shops: readonly StoreCandidateShop[]): ActiveStore {
  const domain = normalizeShopDomain(site.domain);
  const shop = domain ? shops.find((candidate) => candidate.domain === domain) : undefined;
  return { shopDomain: shop?.domain ?? null, siteId: site.id };
}

/** The first choice that names a store the caller owns wins. With none,
 *  the most recently active installed shop, then any shop, then the first
 *  Store Chat site on a website, then the first site at all. */
export function resolveActiveStore(
  candidates: { shops: readonly StoreCandidateShop[]; sites: readonly StoreCandidateSite[] },
  choices: ReadonlyArray<StoreChoice | null>,
): ActiveStore {
  const { shops, sites } = candidates;

  for (const choice of choices) {
    if (!choice) continue;
    if ('shop' in choice) {
      if (shops.some((shop) => shop.domain === choice.shop)) return fromShop(choice.shop, sites);
    } else {
      const site = sites.find((candidate) => candidate.id.toLowerCase() === choice.site);
      if (site) return fromSite(site, shops);
    }
  }

  const recent = [...shops]
    .filter((shop) => shop.status === 'installed')
    .sort((a, b) => Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt))[0];
  if (recent) return fromShop(recent.domain, sites);
  if (shops[0]) return fromShop(shops[0].domain, sites);

  const site = sites.find((candidate) => candidate.domain) ?? sites[0];
  return site ? fromSite(site, shops) : { shopDomain: null, siteId: null };
}
