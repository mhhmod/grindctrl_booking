import 'server-only';

import { getMessengerServiceClient } from '@/lib/messenger/db';

export type WooSiteConnectionSummary = {
  platform: 'woocommerce' | 'wordpress';
  status: 'active' | 'disconnected';
  pluginVersion: string;
  lastSeenAt: string | null;
  pairedAt: string;
  homeUrl: string;
};

type WooSiteConnectionRow = {
  platform: WooSiteConnectionSummary['platform'];
  status: WooSiteConnectionSummary['status'];
  plugin_version: string;
  last_seen_at: string | null;
  paired_at: string;
  home_url: string;
};

/** Server-only status used by Store Chat setup. The dashboard is already
 * authorized for the selected widget site before this read is made. */
export async function getWooSiteConnection(
  widgetSiteId: string,
): Promise<WooSiteConnectionSummary | null> {
  const supabase = getMessengerServiceClient();
  const { data, error } = await supabase
    .from('woo_site_connections')
    .select('platform, status, plugin_version, last_seen_at, paired_at, home_url')
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
  };
}
