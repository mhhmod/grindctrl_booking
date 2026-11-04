import 'server-only';

import { getMessengerServiceClient } from '@/lib/messenger/db';
import { ensureFreeSubscription, getShopEntitlement } from '@/lib/try-on/entitlement';
import { tryOnLaunchFromEntitlement, type TryOnLaunch } from '@/lib/try-on/launch';
import { siteTenantKey } from '@/lib/tenancy/tenant-key';

/* Site-level Try-On state for WooCommerce and WordPress tenants: which
   widget site an embed key names, whether Try-On is live for it, and the
   one-free-plan-per-apex-domain grant. */

// ponytail: no public suffix list. These second-level suffixes cover the
// markets we sell into; add a suffix here (or adopt the PSL) when a
// merchant on another one is refused or double-granted.
const SECOND_LEVEL_SUFFIXES = new Set([
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'com.au', 'net.au', 'org.au', 'co.nz', 'co.za',
  'com.br', 'com.mx', 'com.ar', 'co.in', 'com.eg', 'net.eg', 'org.eg', 'edu.eg', 'gov.eg',
  'com.sa', 'net.sa', 'org.sa', 'com.ae', 'net.ae', 'org.ae', 'co.ae', 'com.tr', 'com.cn',
  'com.sg', 'com.my', 'com.hk', 'co.jp', 'co.kr', 'com.pk', 'com.ng', 'com.ph', 'com.vn',
  'com.tw', 'com.kw', 'com.qa', 'com.bh', 'com.jo', 'com.lb', 'co.ma',
]);

export function apexDomainOf(host: string): string {
  const labels = host.toLowerCase().replace(/\.$/, '').split('.');
  if (labels.length <= 2) return labels.join('.');
  const lastTwo = labels.slice(-2).join('.');
  return SECOND_LEVEL_SUFFIXES.has(lastTwo) ? labels.slice(-3).join('.') : lastTwo;
}

export type SiteByEmbedKey = { id: string; status: string };

const EMBED_KEY_RE = /^[A-Za-z0-9_-]{8,128}$/;

/** The widget site an embed key names, or null (unknown key, bad shape or
 *  a failed read). The key is public; it only selects whose public Try-On
 *  styling is returned. */
export async function siteByEmbedKey(key: unknown): Promise<SiteByEmbedKey | null> {
  if (typeof key !== 'string' || !EMBED_KEY_RE.test(key)) return null;
  try {
    const { data, error } = await getMessengerServiceClient()
      .from('widget_sites')
      .select('id, status')
      .eq('embed_key', key)
      .maybeSingle();
    return error || !data ? null : (data as SiteByEmbedKey);
  } catch {
    return null;
  }
}

export async function readSiteLaunch(
  siteId: string,
): Promise<{ launch: TryOnLaunch; unsubscribed: boolean }> {
  try {
    const entitlement = await getShopEntitlement(siteTenantKey(siteId));
    return {
      launch: tryOnLaunchFromEntitlement(entitlement),
      unsubscribed: entitlement.status === 'none',
    };
  } catch {
    return { launch: { tryOn: 'hidden', reason: 'unavailable' }, unsubscribed: false };
  }
}

export class FreePlanTakenError extends Error {
  constructor() {
    super('free_plan_taken');
    this.name = 'FreePlanTakenError';
  }
}

/** Grants the free plan once per verified apex domain. A site whose apex is
 *  already held by another site is refused. Safe to repeat. */
export async function ensureSiteFreePlan(siteId: string, verifiedHosts: readonly string[]): Promise<void> {
  const apexes = [...new Set(verifiedHosts.map(apexDomainOf))];
  if (apexes.length === 0) throw new FreePlanTakenError();
  const supabase = getMessengerServiceClient();

  const owners = async () => {
    const { data, error } = await supabase
      .from('woo_free_plan_claims')
      .select('apex_domain, widget_site_id')
      .in('apex_domain', apexes);
    if (error) throw new Error('free_plan_claims_unavailable');
    return (data ?? []) as Array<{ apex_domain: string; widget_site_id: string }>;
  };

  if ((await owners()).some((row) => row.widget_site_id !== siteId)) throw new FreePlanTakenError();
  const { error } = await supabase
    .from('woo_free_plan_claims')
    .upsert(
      apexes.map((apex_domain) => ({ apex_domain, widget_site_id: siteId })),
      { onConflict: 'apex_domain', ignoreDuplicates: true },
    );
  if (error) throw new Error('free_plan_claims_unavailable');
  // Re-read: a concurrent site may have won the insert for the same apex.
  if ((await owners()).some((row) => row.widget_site_id !== siteId)) throw new FreePlanTakenError();

  await ensureFreeSubscription(siteTenantKey(siteId));
}
