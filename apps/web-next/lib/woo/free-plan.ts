import 'server-only';

import { getMessengerServiceClient } from '@/lib/messenger/db';
import { normalizeStorefrontDomain } from '@/lib/messenger/domains';
import { isSiteTenantKey, normalizeTenantKey } from '@/lib/tenancy/tenant-key';

/* ponytail: a short suffix list instead of the full public suffix list.
   Hosts on a shared platform (name.github.io) must not share one apex, and
   a country second level (co.uk, com.eg) needs three labels. A suffix this
   list misses makes the apex too wide (one free plan for several unrelated
   shops on it), which fails closed; add it here. */
const SHARED_SUFFIXES = new Set([
  'wordpress.com', 'wixsite.com', 'github.io', 'vercel.app', 'netlify.app', 'pages.dev',
  'blogspot.com', 'herokuapp.com', 'web.app', 'firebaseapp.com', 'myshopify.com', 'squarespace.com',
]);
const SECOND_LEVELS = new Set(['co', 'com', 'net', 'org', 'gov', 'edu', 'ac', 'or', 'ne', 'sch']);

/** The registrable domain a free plan is counted against, or null. */
export function apexDomain(input: string): string | null {
  const host = normalizeStorefrontDomain(input);
  if (!host) return null;
  const labels = host.split('.');
  const lastTwo = labels.slice(-2).join('.');
  if (SHARED_SUFFIXES.has(lastTwo)) return labels.length >= 3 ? labels.slice(-3).join('.') : null;
  const tld = labels[labels.length - 1];
  const second = labels[labels.length - 2];
  const take = tld.length === 2 && SECOND_LEVELS.has(second) ? 3 : 2;
  return labels.length >= take ? labels.slice(-take).join('.') : null;
}

export type WooFreePlanResult = 'granted' | 'apex_taken' | 'no_verified_domain' | 'not_connected' | 'unavailable';

/** Gives a paired WooCommerce store its free Try-On plan once it has a
 *  verified domain, at most one plan per apex domain. Idempotent and safe to
 *  call on every dashboard load: it returns early when the store already has
 *  a subscription, and the database serializes concurrent claims per apex.
 *  Never throws; an unreadable state is 'unavailable' and tried again on the
 *  next load. Other callers (the first try-on) must use this same function so
 *  the apex rule is counted once. */
export async function ensureWooFreePlan(tenantKey: string): Promise<WooFreePlanResult> {
  const key = normalizeTenantKey(tenantKey);
  if (!key || !isSiteTenantKey(key)) return 'not_connected';
  const siteId = key.slice('site:'.length);
  try {
    const supabase = getMessengerServiceClient();
    const existing = await supabase.from('tryon_subscriptions').select('id').eq('shop_domain', key).maybeSingle();
    if (existing.error) return 'unavailable';
    if (existing.data) return 'granted';

    const domains = await supabase
      .from('widget_domains')
      .select('domain, pattern')
      .eq('widget_site_id', siteId)
      .eq('verification_status', 'verified');
    if (domains.error) return 'unavailable';
    const apexes = [...new Set(
      ((domains.data ?? []) as Array<{ domain: string | null; pattern: string | null }>)
        .map((row) => apexDomain(row.domain ?? row.pattern ?? ''))
        .filter((apex): apex is string => Boolean(apex)),
    )];
    if (apexes.length === 0) return 'no_verified_domain';

    const claim = await supabase.rpc('claim_site_free_plan', { p_widget_site_id: siteId, p_apexes: apexes });
    if (claim.error) return 'unavailable';
    return ['granted', 'apex_taken', 'no_verified_domain', 'not_connected'].includes(claim.data as string)
      ? (claim.data as WooFreePlanResult)
      : 'unavailable';
  } catch (error) {
    console.error('[woo free plan] failed', { error: error instanceof Error ? error.name : typeof error });
    return 'unavailable';
  }
}
