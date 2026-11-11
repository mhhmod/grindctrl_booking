import 'server-only';

import { getMessengerServiceClient } from '@/lib/messenger/db';
import { normalizeStorefrontDomain } from '@/lib/messenger/domains';
import { getPasteConnection, isPasteTrusted, pasteTryOnHosts, SHOP_HOST_RE } from '@/lib/paste/store';
import { getActiveWooSiteContext } from '@/lib/woo/connection';

/** The storefront page an owner's preview link opens, per tenant. A Shopify
 *  shop uses its myshopify address, which redirects to the primary domain
 *  and keeps the query. Pasted code opens where Try-On runs: a domain our
 *  server confirmed the code on, else the proven shop host. A WooCommerce
 *  store uses its first verified domain, else the address it was paired at.
 *  Null when none is known. */
export async function previewOriginFor(tenantKey: string): Promise<string | null> {
  if (!tenantKey.startsWith('site:')) return `https://${tenantKey}/`;
  const siteId = tenantKey.slice('site:'.length);

  /* Pasted code keeps its addresses as `trusted` paste rows, never
     `verified`, so it never reaches the lookup below. A pending or
     unconfirmed install has no address yet. */
  const paste = await getPasteConnection(siteId);
  if (paste && paste.status !== 'disconnected') {
    if (!isPasteTrusted(paste)) return null;
    const hosts = await pasteTryOnHosts(paste);
    const host = hosts.find((candidate) => !SHOP_HOST_RE.test(candidate)) ?? hosts[0];
    return host ? `https://${host}/` : null;
  }

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
