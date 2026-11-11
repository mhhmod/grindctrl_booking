import 'server-only';
import { getMessengerServiceClient } from '@/lib/messenger/db';
import { listActivePasteSiteIds } from '@/lib/paste/store';
import { listActiveWooSiteIds } from '@/lib/woo/connection';
import { resolveActiveStore } from '@/lib/dashboard/active-store';
import { getActiveStoreTimeZone } from '@/lib/dashboard/active-store-server';
import { getYourStoreFacts } from '@/lib/dashboard/your-store-data';
import { normalizeShopDomain } from '@/lib/shopify/shop-authorization';
import type { HealthSite } from './alerts-store';

/** Service reads, using the same candidate/tenant resolver and facts loader
 * as Store setup. No request cookies, Clerk session or provisioning in cron. */
export async function readAlertStoreFacts(site: HealthSite, now: number) {
  const db = getMessengerServiceClient();
  const domain = normalizeShopDomain(site.domain);
  const [paste, woo, shop] = await Promise.all([
    listActivePasteSiteIds([site.id]), listActiveWooSiteIds([site.id]),
    domain ? db.from('tryon_shops').select('shop_domain, status, last_seen_at').eq('shop_domain', domain).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  if (shop.error) throw new Error('store health shop read failed');
  const shops = shop.data ? [{ domain: shop.data.shop_domain, status: shop.data.status as 'installed' | 'uninstalled', lastSeenAt: shop.data.last_seen_at }] : [];
  const active = resolveActiveStore({ shops, sites: [{ id: site.id, domain: site.domain, paste: paste.has(site.id), woo: woo.has(site.id) }] }, [{ site: site.id }]);
  const timeZone = await getActiveStoreTimeZone(active);
  return getYourStoreFacts({ activeStore: active, role: 'owner', timeZone, now, installedShop: shops[0]?.status === 'installed' });
}
