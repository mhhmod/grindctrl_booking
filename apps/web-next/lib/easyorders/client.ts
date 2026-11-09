import 'server-only';
import { decryptToken } from '@/lib/shopify/token-crypto';
import { readProviderBody } from '@/lib/provider-http';
import { requireRateLimit, RequestRateLimitError } from '@/lib/request-rate-limit';
import { easyOrdersRpc } from './store';
import type { EasyOrdersConnection } from './types';

export const EASYORDERS_API_BASE = 'https://api.easy-orders.net/api/v1/external-apps/';
export const EASYORDERS_AUTH_HEADER = 'Api-Key';
export type ApiResult = { ok: true; json: unknown } | {
  ok: false; reason: 'not_found' | 'unauthorized' | 'rate_limited' | 'unavailable'; retryAfterSeconds?: number;
};
/** `verify` spends the staged (not yet active) key's budget for the one
 *  confirmation read; the connection's own key is not yet set. */
export type RequestOptions = { verify?: boolean };
export function retryAfterSeconds(value: string | null, now = Date.now()): number {
  const seconds = value && /^\d+$/.test(value) ? Number(value) : value ? Math.ceil((Date.parse(value) - now) / 1000) : 60;
  return Number.isFinite(seconds) ? Math.max(60, Math.min(2147483647, seconds)) : 60;
}
async function recordHealth(c: EasyOrdersConnection, code: 'api_unavailable' | 'unauthorized' | null) {
  try { await easyOrdersRpc('record_easyorders_api_result', { p_site: c.widget_site_id, p_token: c.webhook_token, p_error: code }); }
  catch { /* The lookup still fails closed; health recording is best effort. */ }
}
export async function easyOrdersRequest(
  c: EasyOrdersConnection, path: string, method: 'GET' | 'DELETE' = 'GET', options: RequestOptions = {},
): Promise<ApiResult> {
  // Fixed origin, no redirects: credentials must never follow a provider redirect.
  if (!/^(orders\/(?:short\/)?[A-Za-z0-9_-]+|products(?:\?[^#]*)?|webhooks\/delete-by-url\?[^#]+)$/.test(path) || !c.api_key) {
    return { ok: false, reason: 'unavailable' };
  }
  try {
    await requireRateLimit({ limit: () => easyOrdersRpc('reserve_easyorders_request', {
      p_site: c.widget_site_id, p_token: c.webhook_token, p_cleanup: method === 'DELETE', p_verify: options.verify === true,
    }) }, c.widget_site_id);
    const response = await fetch(`${EASYORDERS_API_BASE}${path}`, {
      method, headers: { [EASYORDERS_AUTH_HEADER]: decryptToken(c.api_key), Accept: 'application/json' },
      signal: AbortSignal.timeout(8000), redirect: 'error', cache: 'no-store',
    });
    if (response.status === 429) {
      const seconds = retryAfterSeconds(response.headers.get('retry-after'));
      await response.body?.cancel();
      await easyOrdersRpc('cooldown_easyorders', { p_site: c.widget_site_id, p_token: c.webhook_token, p_seconds: seconds });
      return { ok: false, reason: 'rate_limited', retryAfterSeconds: seconds };
    }
    if (!response.ok) {
      await response.body?.cancel();
      const unauthorized = response.status === 401 || response.status === 403;
      await recordHealth(c, response.status === 404 ? null : unauthorized ? 'unauthorized' : 'api_unavailable');
      return { ok: false, reason: response.status === 404 ? 'not_found' : unauthorized ? 'unauthorized' : 'unavailable' };
    }
    if (method === 'DELETE' || response.status === 204) {
      await response.body?.cancel();
      return { ok: true, json: null };
    }
    const json = JSON.parse((await readProviderBody(response, 512_000)).toString('utf8'));
    await recordHealth(c, null);
    return { ok: true, json };
  } catch (error) {
    if (error instanceof RequestRateLimitError && error.status === 429) {
      return { ok: false, reason: 'rate_limited', retryAfterSeconds: error.retryAfterSeconds };
    }
    await recordHealth(c, 'api_unavailable');
    return { ok: false, reason: 'unavailable' };
  }
}
