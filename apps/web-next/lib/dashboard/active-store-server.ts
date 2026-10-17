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

/* Read once per request and shared by the layout, the page and anything
   else that asks, so every part of a page agrees on the store. A failed
   read rejects for every caller; getActiveStore treats it as no stores. */
export const listOwnedShops = cache(() => listManagedTryOnShops());

const listOwnedSitesReadOnly = cache(async () => {
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
    known.shops ?? listOwnedShops().catch(() => []),
    known.sites ?? listOwnedSitesReadOnly().catch(() => []),
    headers(),
    cookies(),
  ]);
  return resolveActiveStore({ shops, sites }, [
    storeChoiceFromQuery(query),
    parseStoreChoice(headerList.get(ACTIVE_STORE_HEADER)),
    parseStoreChoice(cookieStore.get(ACTIVE_STORE_COOKIE)?.value),
  ]);
}
