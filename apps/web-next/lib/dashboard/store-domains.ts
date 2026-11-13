import 'server-only';

import { getMessengerServiceClient } from '@/lib/messenger/db';
import { PLACEHOLDER_STORE_NAME, storeHost, storeNameFromAddress } from './store-name';

/* The address a Store Chat site is known by when widget_sites.domain is
   empty. Pasted code never writes that column (a paste install must not
   adopt another tenant's domain), so its address lives on the connection
   (a Shopify shop), the paired WooCommerce home URL, or its domain rows.
   Read only to name the store. */

const MAX_DOMAIN_ROWS = 500;

/** siteId -> address, for the given sites that have one. Never throws: a
 *  failed or not-yet-migrated read leaves those sites without an address,
 *  and they keep the name they have. */
export async function listSiteStoreDomains(siteIds: readonly string[]): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  if (!siteIds.length) return found;
  try {
    const db = getMessengerServiceClient();
    const [connections, domains, woo] = await Promise.all([
      db.from('paste_site_connections').select('widget_site_id, shop_domain')
        .in('widget_site_id', [...siteIds]).in('status', ['active', 'pending']).not('shop_domain', 'is', null),
      db.from('widget_domains').select('widget_site_id, domain')
        .in('widget_site_id', [...siteIds]).in('verification_status', ['verified', 'trusted'])
        .order('created_at', { ascending: true }).limit(MAX_DOMAIN_ROWS),
      db.from('woo_site_connections').select('widget_site_id, home_url')
        .in('widget_site_id', [...siteIds]).eq('status', 'active'),
    ]);
    // A shop first: it is the one address a Shopify store always has.
    for (const row of (connections.data ?? []) as Array<{ widget_site_id: string; shop_domain: string | null }>) {
      const host = storeHost(row.shop_domain);
      if (host) found.set(row.widget_site_id, host);
    }
    for (const row of (woo.data ?? []) as Array<{ widget_site_id: string; home_url: string | null }>) {
      const host = storeHost(row.home_url);
      if (host && !found.has(row.widget_site_id)) found.set(row.widget_site_id, host);
    }
    for (const row of (domains.data ?? []) as Array<{ widget_site_id: string; domain: string | null }>) {
      const host = storeHost(row.domain);
      if (host && !found.has(row.widget_site_id)) found.set(row.widget_site_id, host);
    }
  } catch {
    // Naming only: the stores keep the names they have.
  }
  return found;
}

/** Names a site after its address once that is known, unless the merchant
 *  already named it: only the "My store" placeholder (or an empty name) is
 *  replaced, and the check is part of the write, so a name typed meanwhile
 *  is never overwritten. The name is what emails and the assistant call the
 *  store. Never throws: a store keeps working under its old name. */
export async function adoptStoreNameFromAddress(siteId: string, address: string | null | undefined): Promise<void> {
  const name = storeNameFromAddress(address);
  if (!name) return;
  try {
    const { error } = await getMessengerServiceClient().from('widget_sites').update({ name })
      .eq('id', siteId).or(`name.is.null,name.in.("","${PLACEHOLDER_STORE_NAME}")`);
    if (error) console.error('[store name] not adopted', { code: 'store_name_adopt_failed', site: siteId });
  } catch {
    console.error('[store name] not adopted', { code: 'store_name_adopt_failed', site: siteId });
  }
}
