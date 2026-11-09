import 'server-only';
import { requireSiteAccess } from '@/lib/messenger/provisioning';
import { encryptToken } from '@/lib/shopify/token-crypto';
import { hash, newToken, signInstallState, verifyInstallState } from './state';
import { easyOrdersRpc, loadEasyOrdersConnection } from './store';
import { EasyOrdersError } from './types';

export const EASYORDERS_RETURN_PATH = '/dashboard/store-chat/easyorders/return';
/** EasyOrders' redirect_url: a public route that sees the Clerk session
 *  without forcing sign-in (app/connect/easyorders/route.ts), then forwards
 *  to EASYORDERS_RETURN_PATH. */
export const EASYORDERS_REDIRECT_PATH = '/connect/easyorders';
export function easyOrdersOrigin(): string {
  const url = new URL(process.env.NEXT_PUBLIC_APP_URL ?? '');
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new EasyOrdersError('unavailable');
  }
  return url.origin;
}
export function webhookUrls(origin: string, token: string): [string, string] {
  return [`${origin}/api/easyorders/webhook/${token}?event=order-created`,
    `${origin}/api/easyorders/webhook/${token}?event=order-status-update`];
}
export async function createInstallLink(siteId: string, userId: string): Promise<string> {
  const origin = easyOrdersOrigin();
  const { state, claims } = signInstallState(siteId, userId);
  const token = newToken();
  const started = await easyOrdersRpc<boolean>('begin_easyorders_install', {
    p_site: siteId, p_user: userId, p_nonce: hash(claims.nonce), p_expires: new Date(claims.exp * 1000).toISOString(),
    p_token: token, p_origin: origin,
  });
  if (started !== true) throw new EasyOrdersError('connection_conflict');
  const [orders, statuses] = webhookUrls(origin, token);
  const callback = new URL('/api/easyorders/callback', origin);
  callback.searchParams.set('state', state);
  // The consenting browser lands on our dashboard with the same state. Only
  // the link's creator, signed in there, can turn the staged key into a
  // connection (lib/easyorders/activation.ts).
  const redirect = new URL(EASYORDERS_REDIRECT_PATH, origin);
  redirect.searchParams.set('state', state);
  const params = new URLSearchParams({
    app_name: 'GRINDCTRL', app_description: 'Store Chat order lookup and product knowledge',
    app_icon: `${origin}/favicon.ico`, callback_url: callback.toString(),
    orders_webhook: orders, order_status_webhook: statuses,
    permissions: 'orders:read,products:read', redirect_url: redirect.toString(),
  });
  return `https://app.easy-orders.net/#/install-app?${params}`;
}
/** Provider callback: STAGES the delivered key for the creator's dashboard
 *  confirmation. It never activates, imports or looks anything up, because
 *  whoever approved in EasyOrders may not be the person who made the link.
 *  No cookie or undocumented body field participates in tenant binding. */
export async function stageInstall(state: string | null, body: unknown): Promise<void> {
  const claims = verifyInstallState(state);
  if (!claims) throw new EasyOrdersError('invalid_state');
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new EasyOrdersError('invalid_state');
  const { api_key: key, store_id: rawStore } = body as Record<string, unknown>;
  const store = typeof rawStore === 'number' && Number.isSafeInteger(rawStore) && rawStore > 0 ? String(rawStore) : rawStore;
  if (typeof key !== 'string' || !key || key.length > 4096 || /[\s\x00-\x1f\x7f]/.test(key)
    || typeof store !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(store)) throw new EasyOrdersError('invalid_state');
  // Check the initiator still owns the site at delivery time, not just when
  // the link was generated. A transferred site cannot consume the old link.
  await requireSiteAccess(claims.userId, claims.siteId, 'store');
  const c = await loadEasyOrdersConnection(claims.siteId);
  if (!c || c.status !== 'pending') throw new EasyOrdersError('invalid_state');
  const result = await easyOrdersRpc<boolean>('stage_easyorders_install', {
    p_site: claims.siteId, p_user: claims.userId, p_nonce: hash(claims.nonce),
    p_store: store, p_key: encryptToken(key), p_key_hash: hash(key),
  });
  if (result !== true) throw new EasyOrdersError('invalid_state');
}
