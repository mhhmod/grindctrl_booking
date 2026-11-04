import 'server-only';

import { getMessengerServiceClient } from '@/lib/messenger/db';
import { normalizeStorefrontDomain } from '@/lib/messenger/domains';
import { getActiveWooSiteContext } from '@/lib/woo/connection';

/** The storefront page an owner's preview link opens, per tenant. A Shopify
 *  shop uses its myshopify address, which redirects to the primary domain
 *  and keeps the query. A WooCommerce store uses its first verified domain,
 *  else the address it was paired at. Null when neither is known. */
export async function previewOriginFor(tenantKey: string): Promise<string | null> {
  if (!tenantKey.startsWith('site:')) return `https://${tenantKey}/`;
  const siteId = tenantKey.slice('site:'.length);

  const { data } = await getMessengerServiceClient()
    .from('widget_domains')
    .select('domain, pattern')
    .eq('widget_site_id', siteId)
    .eq('verification_status', 'verified')
    .order('created_at', { ascending: true })
    .limit(5);
  for (const row of (data ?? []) as Array<{ domain: string | null; pattern: string | null }>) {
    const host = normalizeStorefrontDomain(row.domain ?? row.pattern ?? '');
    if (host) return `https://${host}/`;
  }
  const context = await getActiveWooSiteContext(siteId);
  return context ? withTrailingSlash(context.homeUrl) : null;
}

function withTrailingSlash(url: string): string {
  return url.endsWith('/') ? url : `${url}/`;
}

export function previewUrl(origin: string, token: string): string {
  return `${origin}?gc_preview=${encodeURIComponent(token)}`;
}
