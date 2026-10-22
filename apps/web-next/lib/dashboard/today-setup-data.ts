import 'server-only';

import { getMessengerServiceClient } from '@/lib/messenger/db';
import { getWidgetLastSeenAt } from '@/lib/messenger/conversations';
import { getStoreLaunch } from '@/lib/launch/store-launch';
import { effectiveLaunchState } from '@/lib/launch/audience';
import type { ActiveStore } from './active-store';
import { listDashboardShops, listDashboardSites } from './active-store-server';
import { buildShellStores } from './shell-model';
import type { TodaySetupFacts } from './today-setup-model';

/* The facts behind the v16 Today while setting up, for the active store
   only. Null when the page does not apply: no Shopify shop, a shop that is
   not installed, or a store that is live (no launch row, a failed read and
   a finished 50/50 test all read live, as on the storefront). A signal that
   cannot be read counts as not seen yet, so a step is never ticked on a
   guess. The caller checks the flags and the person's role. */

async function signal<T>(read: () => Promise<T>, fallback: T, what: string): Promise<T> {
  try {
    return await read();
  } catch (error) {
    console.error(`[today setup] ${what} failed:`, error instanceof Error ? error.message : error);
    return fallback;
  }
}

/** Whether the store has a look at all, and one of the owner's test looks.
 *  Before supabase/store_launch.sql adds is_test, no test look can exist. */
async function storeLooks(shop: string): Promise<{ storeLook: boolean; testLook: boolean }> {
  const supabase = getMessengerServiceClient();
  const [any, test] = await Promise.all([
    supabase.from('tryon_jobs').select('id').eq('shop', shop).limit(1),
    supabase.from('tryon_jobs').select('id').eq('shop', shop).eq('is_test', true).limit(1),
  ]);
  if (any.error) throw new Error(any.error.message);
  return { storeLook: (any.data ?? []).length > 0, testLook: !test.error && (test.data ?? []).length > 0 };
}

export async function getTodaySetupFacts({
  activeStore,
  holdoutAvailable,
  now = Date.now(),
}: {
  activeStore: ActiveStore;
  holdoutAvailable: boolean;
  now?: number;
}): Promise<TodaySetupFacts | null> {
  const shop = activeStore.shopDomain;
  if (!shop) return null;
  const state = effectiveLaunchState(await getStoreLaunch(shop, now), new Date(now));
  if (state !== 'setup' && state !== 'preview') return null;

  const [shops, sites] = await Promise.all([listDashboardShops().catch(() => []), listDashboardSites().catch(() => [])]);
  if (shops.find((candidate) => candidate.domain === shop)?.status !== 'installed') return null;
  const store = buildShellStores(shops, sites, activeStore).find((candidate) => candidate.current)?.label ?? shop;

  const siteId = activeStore.siteId;
  const [chatSeenAt, looks] = await Promise.all([
    siteId ? signal(() => getWidgetLastSeenAt(siteId), null, 'store chat seen') : Promise.resolve(null),
    signal(() => storeLooks(shop), { storeLook: false, testLook: false }, 'looks'),
  ]);
  return { store, shop, chatSeenAt, ...looks, holdoutAvailable };
}
