import 'server-only';

import { getMessengerServiceClient } from '@/lib/messenger/db';
import { getShopEntitlement } from '@/lib/try-on/entitlement';
import { tryOnLaunchFromEntitlement, type TryOnLaunch } from '@/lib/try-on/launch';
import { siteTenantKey } from '@/lib/tenancy/tenant-key';

/* Site-level Try-On state for WooCommerce and WordPress tenants: which
   widget site an embed key names, whether Try-On is live for it, and the
   one-free-plan-per-apex-domain grant. */

// ponytail: no public suffix list. These second-level suffixes cover the
// markets we sell into; add a suffix here (or adopt the PSL) when a
// merchant on another one is refused or double-granted.

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
