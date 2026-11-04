import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';
import { deriveWooSiteSecret } from '@/lib/woo/site-secret';
import { loadActiveWooConnection } from '@/lib/woo/active-connection';

/* Verified WordPress shopper identity.

   The plugin mints, for a logged-in user only, from a no-store REST route:

     gcw1.<payload>.<signature>

   payload   = base64url(JSON {"v":1,"site":<widget site uuid>,"wpUserId":<int>,
               "sid":<visitor anonymous id>,"exp":<unix seconds>,"email_hash":<sha256 hex>})
   signature = base64url(HMAC-SHA256(siteSecret, "gc-woo-identity-v1\n" + payload))

   The site secret never leaves the server or the plugin; the token proves a
   logged-in user at that site, for that chat session, for at most 10 minutes. */

export const WOO_IDENTITY_PREFIX = 'gcw1.';
const DOMAIN = 'gc-woo-identity-v1\n';
const MAX_LIFETIME_SECONDS = 600;
const SKEW_SECONDS = 30;
const MAX_TOKEN_LENGTH = 1024;
const BASE64URL_RE = /^[A-Za-z0-9_-]+$/;
const SID_RE = /^[A-Za-z0-9_-]{8,64}$/;

export function isWooIdentityToken(token: unknown): token is string {
  return typeof token === 'string' && token.startsWith(WOO_IDENTITY_PREFIX);
}

export function signWooIdentityPayload(secret: string, payloadB64: string): string {
  return createHmac('sha256', secret).update(DOMAIN + payloadB64, 'utf8').digest('base64url');
}

export type WooIdentityClaims = { wpUserId: string; emailHash: string | null };

/** Pure check against a known secret. Null for anything but a fresh token for
 *  exactly this site and chat session. */
export function verifyWooIdentityTokenWithSecret(
  secret: string,
  token: string,
  expected: { siteId: string; sid: string },
  nowSeconds: number = Math.floor(Date.now() / 1000),
): WooIdentityClaims | null {
  if (!secret || !isWooIdentityToken(token) || token.length > MAX_TOKEN_LENGTH) return null;
  if (!SID_RE.test(expected.sid)) return null;
  const pieces = token.slice(WOO_IDENTITY_PREFIX.length).split('.');
  if (pieces.length !== 2) return null;
  const [payloadB64, signature] = pieces;
  if (!BASE64URL_RE.test(payloadB64) || !BASE64URL_RE.test(signature)) return null;

  const provided = Buffer.from(signature, 'utf8');
  const wanted = Buffer.from(signWooIdentityPayload(secret, payloadB64), 'utf8');
  if (provided.length !== wanted.length || !timingSafeEqual(provided, wanted)) return null;

  let payload: Record<string, unknown>;
  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    payload = parsed as Record<string, unknown>;
  } catch {
    return null;
  }

  if (payload.v !== 1 || payload.site !== expected.siteId || payload.sid !== expected.sid) return null;
  const exp = payload.exp;
  if (typeof exp !== 'number' || !Number.isSafeInteger(exp)) return null;
  if (exp < nowSeconds - SKEW_SECONDS || exp > nowSeconds + MAX_LIFETIME_SECONDS + SKEW_SECONDS) return null;
  const userId = payload.wpUserId;
  if (typeof userId !== 'number' || !Number.isSafeInteger(userId) || userId < 1) return null;
  const emailHash = typeof payload.email_hash === 'string' && /^[0-9a-f]{64}$/.test(payload.email_hash)
    ? payload.email_hash
    : null;
  return { wpUserId: String(userId), emailHash };
}

/** Looks up the site's active pairing, then verifies. A disconnected or
 *  non-WooCommerce site, or any lookup failure, yields no identity. */
export async function verifyWooIdentityToken(
  token: unknown,
  expected: { siteId: string; sid: string },
): Promise<WooIdentityClaims | null> {
  if (!isWooIdentityToken(token)) return null;
  try {
    const connection = await loadActiveWooConnection(expected.siteId);
    if (!connection) return null;
    const secret = deriveWooSiteSecret(connection.siteId, connection.secretVersion);
    return secret ? verifyWooIdentityTokenWithSecret(secret, token, expected) : null;
  } catch {
    return null;
  }
}
