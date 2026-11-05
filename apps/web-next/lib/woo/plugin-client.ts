import 'server-only';

import { deriveWooSiteSecret } from '@/lib/woo/site-secret';
import { signWooRequest } from '@/lib/woo/signed-request';
import { parsePairedHomeUrl, pinnedHttpsPost, type PinnedPostInput, type PinnedPostResult } from '@/lib/woo/ssrf';
import type { ActiveWooConnection } from '@/lib/woo/active-connection';
import { normalizeWooRestBase } from './rest-base';

/* Server-to-plugin calls. The URL is always the paired home URL plus a fixed
   plugin route, so a caller can choose a body but never a destination. The
   request is signed exactly like plugin-to-server calls (same canonical
   string, per-site secret); the plugin verifies it and remembers the nonce. */

export const WOO_PLUGIN_ORDER_LOOKUP_PATH = '/wp-json/grindctrl/v1/order-lookup';
const ALLOWED_PATHS: ReadonlySet<string> = new Set([WOO_PLUGIN_ORDER_LOOKUP_PATH]);

const TIMEOUT_MS = 5_000;
const MAX_RESPONSE_BYTES = 64 * 1024;

export type PluginCallResult =
  | { ok: true; json: unknown }
  | { ok: false; reason: 'unavailable' | 'rejected' };

export type PluginTransport = (input: PinnedPostInput) => Promise<PinnedPostResult>;

let transportOverride: PluginTransport | null = null;

/** Test seam: replaces the network. */
export function setWooPluginTransportForTests(transport: PluginTransport | null): () => void {
  const previous = transportOverride;
  transportOverride = transport;
  return () => {
    transportOverride = previous;
  };
}

/** The pathname the plugin recomputes from its own home_url. */
export function pluginUrl(homeUrl: string, path: string, restBaseUrl?: string | null): URL | null {
  const home = parsePairedHomeUrl(homeUrl);
  if (!home || !ALLOWED_PATHS.has(path)) return null;
  if (restBaseUrl != null) {
    const normalized = normalizeWooRestBase(homeUrl, restBaseUrl);
    if (!normalized) return null;
    const base = new URL(normalized);
    const route = path.slice('/wp-json'.length);
    if (base.searchParams.has('rest_route')) base.searchParams.set('rest_route', route);
    else base.pathname += route.slice(1);
    return base;
  }
  return new URL(`${home.origin}${home.pathname.replace(/\/+$/, '')}${path}`);
}

export async function callWooPlugin(
  connection: ActiveWooConnection,
  path: string,
  payload: Record<string, unknown>,
): Promise<PluginCallResult> {
  const url = pluginUrl(connection.homeUrl, path, connection.restBaseUrl);
  const secret = deriveWooSiteSecret(connection.siteId, connection.secretVersion);
  if (!url || !secret) return { ok: false, reason: 'unavailable' };

  const body = JSON.stringify(payload);
  const headers = signWooRequest({
    secret,
    siteId: connection.siteId,
    method: 'POST',
    // The plugin signs its fixed route under the home path, whichever way
    // REST is reached (pretty permalinks or ?rest_route=).
    path: `${new URL(connection.homeUrl).pathname.replace(/\/+$/, '')}${path}`,
    body,
  });

  const response = await (transportOverride ?? pinnedHttpsPost)({
    url,
    headers: { ...headers, 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': 'GRINDCTRL-Store-Chat/1' },
    body,
    timeoutMs: TIMEOUT_MS,
    maxBytes: MAX_RESPONSE_BYTES,
  }).catch(() => null);

  if (!response) return { ok: false, reason: 'unavailable' };
  if (response.status === 401 || response.status === 403) return { ok: false, reason: 'rejected' };
  if (response.status !== 200 || !/^application\/json\b/i.test(response.contentType)) {
    return { ok: false, reason: 'unavailable' };
  }
  try {
    return { ok: true, json: JSON.parse(response.body) };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}
