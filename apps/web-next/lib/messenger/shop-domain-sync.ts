import 'server-only';

import { adminGraphql } from '@/lib/shopify/admin';
import { getMessengerServiceClient } from './db';
import { findSiteByDomain } from './shop-tenancy';

/* Store Chat on a store's own domain. Phase zero item 5 of the v16 handoff.

   Store Chat admits its config request from the shop's myshopify host and,
   for any other host, only from a verified widget_domains row. Nothing ever
   wrote those rows: the dashboard's domain editor was never mounted. So a
   store served from its own domain (most real stores) got a 403, the loader
   drew no launcher, and nothing told the merchant.

   Shopify already knows which domains serve the store, and the Admin API
   call is authenticated as the store, so a host it names is as proven as
   the myshopify host itself. This writes them as verified rows marked with
   their own verification method, and disables a row of ours whose host the
   store no longer has. Rows a person added by hand are left alone, except
   that one Shopify confirms is promoted to verified. */

export const SHOPIFY_DOMAIN_METHOD = 'shopify_admin';

const HOST_RE = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{0,61}[a-z0-9]$/;

/** A storefront host as Shopify reports it, normalized, or null. The
 *  myshopify host is excluded: it is admitted without a row already. */
export function storefrontHost(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const host = value.trim().toLowerCase().replace(/\.$/, '');
  if (!HOST_RE.test(host) || host.endsWith('.myshopify.com')) return null;
  return host;
}

const PRIMARY_QUERY = `query GrindctrlPrimaryDomain { shop { primaryDomain { host } } }`;
/* Shop.domains is marked deprecated in the Admin API, with no replacement
   for listing every domain short of the Markets scopes. It is read
   separately so that a version which drops it costs only the extra hosts,
   never the primary one. */
const ALL_DOMAINS_QUERY = `query GrindctrlAllDomains { shop { domains { host } } }`;

export async function fetchShopStorefrontHosts(shop: string, accessToken: string): Promise<string[]> {
  const primary = await adminGraphql<{ shop: { primaryDomain: { host: string } | null } }>({
    shopDomain: shop,
    accessToken,
    query: PRIMARY_QUERY,
  });
  const hosts = [primary.shop.primaryDomain?.host];
  try {
    const all = await adminGraphql<{ shop: { domains: Array<{ host: string }> | null } }>({
      shopDomain: shop,
      accessToken,
      query: ALL_DOMAINS_QUERY,
    });
    for (const domain of all.shop.domains ?? []) hosts.push(domain.host);
  } catch {
    // The primary domain is the one shoppers land on; the rest is extra.
  }
  return [...new Set(hosts.map(storefrontHost).filter((host): host is string => host !== null))];
}

type DomainRow = { id: string; pattern: string | null; verification_status: string; verification_method: string | null };

export type DomainSyncPlan = {
  insert: string[];
  verify: string[];
  disable: string[];
};

/** Pure: what to write, given Shopify's hosts and the site's rows. */
export function planDomainSync(hosts: readonly string[], rows: readonly DomainRow[]): DomainSyncPlan {
  const wanted = new Set(hosts);
  const byHost = new Map<string, DomainRow[]>();
  for (const row of rows) {
    const host = (row.pattern ?? '').trim().toLowerCase();
    if (!byHost.has(host)) byHost.set(host, []);
    byHost.get(host)!.push(row);
  }
  const plan: DomainSyncPlan = { insert: [], verify: [], disable: [] };
  for (const host of wanted) {
    const existing = byHost.get(host) ?? [];
    if (existing.length === 0) plan.insert.push(host);
    for (const row of existing) {
      if (row.verification_status !== 'verified') plan.verify.push(row.id);
    }
  }
  for (const row of rows) {
    const host = (row.pattern ?? '').trim().toLowerCase();
    if (
      row.verification_method === SHOPIFY_DOMAIN_METHOD &&
      row.verification_status !== 'disabled' &&
      !wanted.has(host)
    ) {
      plan.disable.push(row.id);
    }
  }
  return plan;
}

const lastSync = new Map<string, number>();
const SYNC_INTERVAL_MS = 5 * 60_000;

/** Test seam. */
export function resetDomainSyncThrottle(): void {
  lastSync.clear();
}

/**
 * Sync the store's Shopify domains into its Store Chat site. Never throws:
 * it runs on every embedded-admin open, and a failure here must not break
 * the admin. At most once per shop every five minutes per process.
 */
export async function syncShopStorefrontDomains(
  shop: string,
  accessToken: string,
): Promise<{ synced: boolean; plan?: DomainSyncPlan; reason?: string }> {
  const now = Date.now();
  if ((lastSync.get(shop) ?? 0) > now - SYNC_INTERVAL_MS) return { synced: false, reason: 'recent' };
  lastSync.set(shop, now);
  try {
    const site = await findSiteByDomain(shop);
    if (!site) return { synced: false, reason: 'no_site' };

    const hosts = await fetchShopStorefrontHosts(shop, accessToken);
    const supabase = getMessengerServiceClient();
    const existing = await supabase
      .from('widget_domains')
      .select('id, pattern, verification_status, verification_method')
      .eq('widget_site_id', site.id);
    if (existing.error) throw new Error(existing.error.message);

    const plan = planDomainSync(hosts, (existing.data ?? []) as DomainRow[]);
    const stamp = new Date(now).toISOString();
    if (plan.insert.length > 0) {
      const res = await supabase.from('widget_domains').insert(
        plan.insert.map((host) => ({
          widget_site_id: site.id,
          domain: host,
          pattern: host,
          environment: 'production',
          verification_status: 'verified',
          verification_method: SHOPIFY_DOMAIN_METHOD,
          verified_at: stamp,
          last_checked_at: stamp,
        })),
      );
      if (res.error) throw new Error(res.error.message);
    }
    if (plan.verify.length > 0) {
      const res = await supabase
        .from('widget_domains')
        .update({ verification_status: 'verified', verified_at: stamp, last_checked_at: stamp, disabled_at: null })
        .in('id', plan.verify);
      if (res.error) throw new Error(res.error.message);
    }
    if (plan.disable.length > 0) {
      const res = await supabase
        .from('widget_domains')
        .update({ verification_status: 'disabled', disabled_at: stamp, last_checked_at: stamp })
        .in('id', plan.disable);
      if (res.error) throw new Error(res.error.message);
    }
    return { synced: true, plan };
  } catch (error) {
    // Let the next open retry rather than wait out the interval.
    lastSync.delete(shop);
    console.error('[store-chat] domain sync failed:', error instanceof Error ? error.message : error);
    return { synced: false, reason: 'error' };
  }
}
