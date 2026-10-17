import 'server-only';

import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { auth } from '@clerk/nextjs/server';
import { listManagedTryOnShops } from '@/lib/shopify/shops';
import { listMessengerSitesReadOnly } from '@/lib/messenger/provisioning';
import {
  ACTIVE_STORE_COOKIE,
  ACTIVE_STORE_HEADER,
  parseStoreChoice,
  resolveActiveStore,
  storeChoiceFromQuery,
  type ActiveStore,
  type StoreCandidateShop,
  type StoreCandidateSite,
} from './active-store';
import type { DashboardWorkspaceRole } from '@/lib/rbac/dashboard-policy';
import { getShopTimezone } from '@/lib/shopify/shop-timezone';
import { resolveTimeZone } from '@/lib/time/store-day';

/* Read once per request and shared by the layout, the page and anything
   else that asks, so every part of a page agrees on the store. Each lists
   the person's own stores, then their teams' (item 12), with their role on
   each. A failed read rejects for every caller; getActiveStore treats it as
   no stores. */
export const listDashboardShops = cache(() => listManagedTryOnShops());

export const listDashboardSites = cache(async () => {
  const { userId } = await auth();
  return userId ? listMessengerSitesReadOnly(userId) : [];
});

/** The dashboard's active store for this request (phase zero item 33):
 *  the page's own query, then the link's choice the proxy passed on, then
 *  the store chosen last, then the most recently active installed shop. */
export async function getActiveStore(
  query: { shop?: unknown; site?: unknown } = {},
  /** The caller's own shop and site lists, when it has already read them. */
  known: { shops?: readonly StoreCandidateShop[]; sites?: readonly StoreCandidateSite[] } = {},
): Promise<ActiveStore> {
  const [shops, sites, headerList, cookieStore] = await Promise.all([
    known.shops ?? listDashboardShops().catch(() => []),
    known.sites ?? listDashboardSites().catch(() => []),
    headers(),
    cookies(),
  ]);
  return resolveActiveStore({ shops, sites }, [
    storeChoiceFromQuery(query),
    parseStoreChoice(headerList.get(ACTIVE_STORE_HEADER)),
    parseStoreChoice(cookieStore.get(ACTIVE_STORE_COOKIE)?.value),
  ]);
}

/** The person's role on the active store (item 12). With no store at all
 *  they are the owner of their own, still empty, account. A store missing
 *  from their lists gets the least a role can do, though resolveActiveStore
 *  only ever picks from those lists. */
export async function getActiveStoreRole(active: ActiveStore): Promise<DashboardWorkspaceRole> {
  if (!active.shopDomain && !active.siteId) return 'owner';
  const [shops, sites] = await Promise.all([
    listDashboardShops().catch(() => []),
    listDashboardSites().catch(() => []),
  ]);
  const role = active.shopDomain
    ? shops.find((shop) => shop.domain === active.shopDomain)?.role
    : sites.find((site) => site.id === active.siteId)?.role;
  return role ?? 'member';
}

/** The active store's time zone (phase zero item 32): its Shopify shop's,
 *  or UTC for a store without one or a zone that cannot be read. */
export async function getActiveStoreTimeZone(active: ActiveStore): Promise<string> {
  return resolveTimeZone(active.shopDomain ? await getShopTimezone(active.shopDomain) : null);
}
