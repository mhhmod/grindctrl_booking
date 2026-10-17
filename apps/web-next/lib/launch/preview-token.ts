import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';
import { primaryShopifyApp, resolveShopifyApp } from '@/lib/shopify/app-registry';
import { normalizeShopDomain } from '@/lib/shopify/shop-authorization';

/* The owner's preview link (N5, phase zero item 9). While a store is in
   setup or preview only its owner sees Try it on and Store Chat, by opening
   the store from the dashboard with ?gc_preview=<token>. The token names
   the shop and a purpose and lasts 24 hours; it is signed with a key
   derived from the Shopify app secret, like the origin token, so it cannot
   be replayed as any other capability. The storefront scripts keep it in
   the store's own storage and send it with their config calls. */

export const PREVIEW_TOKEN_TTL_SECONDS = 24 * 60 * 60;
const KEY_CONTEXT = 'grindctrl:launch:preview:v1';
const PURPOSE = 'storefront-preview';
const MAX_LENGTH = 512;

type PreviewPayload = { p: typeof PURPOSE; shop: string; iat: number; exp: number };

function key(secret: string): Buffer {
  return createHmac('sha256', secret).update(KEY_CONTEXT, 'utf8').digest();
}

function sign(secret: string, body: string): string {
  return createHmac('sha256', key(secret)).update(body, 'utf8').digest('base64url');
}

export function signPreviewToken(
  secret: string,
  shop: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): { token: string; expiresAt: string } {
  const domain = normalizeShopDomain(shop);
  if (!secret.trim() || !domain) throw new Error('A preview link needs a shop and a signing secret.');
  const payload: PreviewPayload = { p: PURPOSE, shop: domain, iat: nowSeconds, exp: nowSeconds + PREVIEW_TOKEN_TTL_SECONDS };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return {
    token: `${body}.${sign(secret.trim(), body)}`,
    expiresAt: new Date(payload.exp * 1000).toISOString(),
  };
}

/** True when the token was signed for this shop and has not expired. */
export function verifyPreviewToken(
  secret: string,
  token: unknown,
  shop: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (!secret.trim() || typeof token !== 'string' || token.length > MAX_LENGTH) return false;
  const [body, signature, extra] = token.split('.');
  if (!body || !signature || extra !== undefined) return false;
  const expected = Buffer.from(sign(secret.trim(), body));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return false;
  let payload: Partial<PreviewPayload>;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Partial<PreviewPayload>;
  } catch {
    return false;
  }
  return (
    payload.p === PURPOSE &&
    typeof payload.shop === 'string' &&
    payload.shop === normalizeShopDomain(shop) &&
    typeof payload.exp === 'number' &&
    typeof payload.iat === 'number' &&
    payload.exp > nowSeconds &&
    payload.exp - payload.iat <= PREVIEW_TOKEN_TTL_SECONDS
  );
}

/** Checks the token against every configured Shopify app's secret. */
export function verifyPreviewTokenAnyApp(token: unknown, shop: string): boolean {
  if (typeof token !== 'string' || !token) return false;
  return resolveShopifyApp((secret) => (verifyPreviewToken(secret, token, shop) ? true : null)) !== null;
}

/** Signs with the primary app's secret, as the origin token does. */
export function signPreviewTokenForShop(shop: string): { token: string; expiresAt: string } | null {
  const app = primaryShopifyApp();
  if (!app) return null;
  return signPreviewToken(app.secret, shop);
}
