import 'server-only';

import { getMessengerServiceClient } from '@/lib/messenger/db';

/* The paired WooCommerce site behind a Store Chat site, for server-to-plugin
   calls and plugin-issued tokens. Only an active WooCommerce pairing counts;
   a plain WordPress or disconnected site has no store to ask. */

export type ActiveWooConnection = {
  siteId: string;
  homeUrl: string;
  secretVersion: number;
  pluginVersion: string;
  restBaseUrl?: string | null;
};

type Row = {
  platform: string;
  status: string;
  home_url: string;
  secret_version: number;
  plugin_version: string;
  rest_base_url: string | null;
};

export async function loadActiveWooConnection(siteId: string): Promise<ActiveWooConnection | null> {
  const client = getMessengerServiceClient();
  const read = (columns: string) => client
    .from('woo_site_connections')
    .select(columns)
    .eq('widget_site_id', siteId)
    .maybeSingle();
  let { data, error } = await read('platform, status, home_url, secret_version, plugin_version, rest_base_url');
  // The column arrives with a hand-applied migration: until then use /wp-json/.
  if (error) ({ data, error } = await read('platform, status, home_url, secret_version, plugin_version'));
  if (error) throw new Error('WooCommerce connection is unavailable.');
  const row = data as Row | null;
  if (!row || row.platform !== 'woocommerce' || row.status !== 'active') return null;
  if (!Number.isSafeInteger(row.secret_version) || row.secret_version < 1) return null;
  return {
    siteId,
    homeUrl: row.home_url,
    secretVersion: row.secret_version,
    pluginVersion: row.plugin_version,
    restBaseUrl: row.rest_base_url,
  };
}
