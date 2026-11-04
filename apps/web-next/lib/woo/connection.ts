import 'server-only';

import { getMessengerServiceClient } from '@/lib/messenger/db';
import { WOO_MIN_PLUGIN_VERSION } from './signed-request';

export type WooSiteConnectionSummary = {
  platform: 'woocommerce' | 'wordpress';
  status: 'active' | 'disconnected';
  pluginVersion: string;
  lastSeenAt: string | null;
  pairedAt: string;
  homeUrl: string;
  /** The latest heartbeat reports another address than the one paired: a
   *  copied or staged database, not the original store. */
  cloneSuspected: boolean;
  /** The installed plugin is older than the server accepts. */
  pluginOutdated: boolean;
};

type WooSiteConnectionRow = {
  platform: WooSiteConnectionSummary['platform'];
  status: WooSiteConnectionSummary['status'];
  plugin_version: string;
  last_seen_at: string | null;
  paired_at: string;
  home_url: string;
  last_home_url: string | null;
};

function versionParts(version: string): number[] {
  return version.split('.').map((part) => Number.parseInt(part, 10) || 0);
}

/** True when `version` is older than `minimum`, comparing numeric parts. */
export function isVersionBelow(version: string, minimum: string): boolean {
  const a = versionParts(version);
  const b = versionParts(minimum);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff < 0;
  }
  return false;
}

/** Server-only status used by Store Chat setup. The dashboard is already
 * authorized for the selected widget site before this read is made. */
export async function getWooSiteConnection(
  widgetSiteId: string,
): Promise<WooSiteConnectionSummary | null> {
  const supabase = getMessengerServiceClient();
  const { data, error } = await supabase
    .from('woo_site_connections')
    .select('platform, status, plugin_version, last_seen_at, paired_at, home_url, last_home_url')
    .eq('widget_site_id', widgetSiteId)
    .maybeSingle();

  if (error) throw new Error('WooCommerce connection status is unavailable.');
  if (!data) return null;

  const row = data as WooSiteConnectionRow;
  return {
    platform: row.platform,
    status: row.status,
    pluginVersion: row.plugin_version,
    lastSeenAt: row.last_seen_at,
    pairedAt: row.paired_at,
    homeUrl: row.home_url,
    cloneSuspected: Boolean(row.last_home_url) && row.last_home_url !== row.home_url,
    pluginOutdated: isVersionBelow(row.plugin_version, WOO_MIN_PLUGIN_VERSION),
  };
}

export type WooSiteContext = { homeUrl: string; timezone: string | null };

/** The paired address and time zone of an active store, for the dashboard's
 *  links and calendar days. Null when the site has no active connection. */
export async function getActiveWooSiteContext(widgetSiteId: string): Promise<WooSiteContext | null> {
  const { data, error } = await getMessengerServiceClient()
    .from('woo_site_connections')
    .select('home_url, timezone')
    .eq('widget_site_id', widgetSiteId)
    .eq('status', 'active')
    .maybeSingle();
  if (error || !data) return null;
  const row = data as { home_url: string; timezone: string | null };
  return { homeUrl: row.home_url, timezone: row.timezone };
}

/** Which of these Store Chat sites are paired, active WooCommerce stores. */
export async function listActiveWooSiteIds(siteIds: readonly string[]): Promise<Set<string>> {
  if (siteIds.length === 0) return new Set();
  const { data, error } = await getMessengerServiceClient()
    .from('woo_site_connections')
    .select('widget_site_id')
    .in('widget_site_id', [...siteIds])
    .eq('platform', 'woocommerce')
    .eq('status', 'active');
  if (error) throw new Error('WooCommerce connections are unavailable.');
  return new Set(((data ?? []) as Array<{ widget_site_id: string }>).map((row) => row.widget_site_id));
}
