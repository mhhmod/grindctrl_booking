import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';

/* Shopper identity for the Support Messenger.

   Browser-supplied customer ids/emails are NEVER trusted. Identity arrives
   through the Shopify App Proxy: Liquid renders a link containing
   customer claims as query params, Shopify signs the full query string with
   the app secret, and our proxy endpoint verifies that HMAC server-side —
   exactly how Shopify itself documents proxy request verification.

   On success the shopper's browser receives a short-lived HS256 session JWT
   (signed with the same app secret, never exposed to storefront JS beyond
   the token itself). Messenger API calls present this token; the server
   re-verifies signature + expiry + audience before attaching any identity. */

const ISSUER = 'grindctrl-messenger';
const AUDIENCE = 'messenger-api';
const TOKEN_TTL_SECONDS = 60 * 60 * 12;

export interface VerifiedShopperIdentity {
  customerId: string | null;
  email: string | null;
  name: string | null;
}

function base64UrlEncode(buf: Buffer): string {
  return buf.toString('base64url');
}

function hmacSha256(secret: string, data: string): Buffer {
  return createHmac('sha256', secret).update(data, 'utf8').digest();
}

/** Verifies Shopify's app-proxy `signature` parameter over every other query
 *  param (sorted, concatenated k=v, secret appended) per Shopify docs. */
export function verifyShopifyProxySignature(
  params: URLSearchParams,
  secret: string,
): boolean {
  const signature = params.get('signature') ?? '';
  if (!signature || !secret) return false;

  const pairs: string[] = [];
  for (const [key, value] of params.entries()) {
    if (key === 'signature') continue;
    // Shopify documents escaping of &/%/= in values for signature purposes.
    pairs.push(`${key}=${value.replace(/&/g, '%26').replace(/=/g, '%3D')}`);
  }
  pairs.sort();

  const digest = hmacSha256(secret, pairs.join(''));
  const provided = Buffer.from(signature, 'utf8');
  const expectedHex = Buffer.from(digest.toString('hex'), 'utf8');
  if (provided.length !== expectedHex.length) return false;
  return timingSafeEqual(provided, expectedHex);
}

export type ProxyIdentityInput = {
  customer_id?: string;
  customer_email?: string;
  customer_name?: string;
};

/** Validates the signed proxy payload shape and returns sanitized claims. */
export function extractProxyIdentity(params: URLSearchParams): VerifiedShopperIdentity | null {
  const customerId = params.get('customer_id') ?? '';
  if (!/^\d{1,20}$/.test(customerId)) return null;
  const email = (params.get('customer_email') ?? '').trim();
  const name = (params.get('customer_name') ?? '').trim();
  return {
    customerId,
    email: email && email.length <= 200 ? email : null,
    name: name && name.length <= 120 ? name : null,
  };
}

interface JwtParts {
  header: { alg: 'HS256'; typ: 'JWT'; kid?: string };
  payload: {
    iss: string;
    aud: string;
    iat: number;
    exp: number;
    sid: string;
    sub: string | null;
    email: string | null;
    name: string | null;
  };
}

/** Issues the shopper session JWT bound to the visitor session id (`sid`)
 *  so tokens cannot be replayed across different browser sessions. */
export function signShopperToken(
  secret: string,
  claims: { sessionId: string; identity: VerifiedShopperIdentity },
): string {
  const now = Math.floor(Date.now() / 1000);
  const parts: JwtParts = {
    header: { alg: 'HS256', typ: 'JWT' },
    payload: {
      iss: ISSUER,
      aud: AUDIENCE,
      iat: now,
      exp: now + TOKEN_TTL_SECONDS,
      sid: claims.sessionId,
      sub: claims.identity.customerId,
      email: claims.identity.email,
      name: claims.identity.name,
    },
  };
  const encoded = `${base64UrlEncode(Buffer.from(JSON.stringify(parts.header)))}.${base64UrlEncode(
    Buffer.from(JSON.stringify(parts.payload)),
  )}`;
  const sig = base64UrlEncode(hmacSha256(secret, encoded));
  return `${encoded}.${sig}`;
}

export function verifyShopperToken(
  secret: string,
  token: string,
  expectedSessionId: string,
): VerifiedShopperIdentity | null {
  const pieces = token.split('.');
  if (pieces.length !== 3) return null;
  const [h, p, s] = pieces;

  const expectedSig = base64UrlEncode(hmacSha256(secret, `${h}.${p}`));
  const provided = Buffer.from(s);
  const expected = Buffer.from(expectedSig);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;

  let payload: JwtParts['payload'];
  try {
    payload = JSON.parse(Buffer.from(p.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
  } catch {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.iss !== ISSUER || payload.aud !== AUDIENCE) return null;
  if (typeof payload.exp !== 'number' || payload.exp < now - 30) return null;
  if (payload.sid !== expectedSessionId) return null;

  return {
    customerId: typeof payload.sub === 'string' ? payload.sub : null,
    email: typeof payload.email === 'string' ? payload.email : null,
    name: typeof payload.name === 'string' ? payload.name : null,
  };
}

export const MESSENGER_TOKEN_TTL_SECONDS = TOKEN_TTL_SECONDS;

/* ---- Storefront origin proof -------------------------------------------

   The panel runs in an iframe served from OUR origin, so every call it makes
   to /api/messenger/* is same-origin: the browser's Origin header says
   grindctrl.cloud and cannot name the store the shopper is actually on. The
   panel therefore used to report its own page origin in the request body —
   a value chosen by the caller, which proves nothing and which a stolen
   embed key could set to any store it liked.

   The one place that CAN establish the storefront honestly is the embed page
   itself: it is a top-level iframe navigation, so the browser sends Referer,
   and page script cannot forge it. So we verify there, once, and mint this
   token as the proof. Every subsequent API call presents the token instead
   of an origin, and the server recovers the origin from a signature only it
   can produce.

   Bound to the embed key so a token minted for one store cannot be replayed
   against another, and short-lived so a leaked one expires with the session. */

const ORIGIN_AUDIENCE = 'messenger-origin';
const ORIGIN_TOKEN_TTL_SECONDS = 60 * 60 * 12;

export function signOriginToken(
  secret: string,
  claims: { key: string; origin: string },
): string | null {
  if (!secret) return null;
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const payload = base64UrlEncode(
    Buffer.from(
      JSON.stringify({
        iss: ISSUER,
        aud: ORIGIN_AUDIENCE,
        iat: now,
        exp: now + ORIGIN_TOKEN_TTL_SECONDS,
        key: claims.key,
        org: claims.origin,
      }),
    ),
  );
  const encoded = `${header}.${payload}`;
  return `${encoded}.${base64UrlEncode(hmacSha256(secret, encoded))}`;
}

/** Returns the server-verified storefront origin, or null if the token is
 *  absent, malformed, expired, or minted for a different embed key. */
export function verifyOriginToken(
  secret: string,
  token: unknown,
  expectedKey: string,
): string | null {
  if (!secret || typeof token !== 'string') return null;
  const pieces = token.split('.');
  if (pieces.length !== 3) return null;
  const [h, p, s] = pieces;

  const expectedSig = base64UrlEncode(hmacSha256(secret, `${h}.${p}`));
  const provided = Buffer.from(s);
  const expected = Buffer.from(expectedSig);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;

  let payload: { iss?: string; aud?: string; exp?: number; key?: string; org?: string };
  try {
    payload = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.iss !== ISSUER || payload.aud !== ORIGIN_AUDIENCE) return null;
  if (typeof payload.exp !== 'number' || payload.exp < now - 30) return null;
  if (payload.key !== expectedKey) return null;
  return typeof payload.org === 'string' && payload.org ? payload.org : null;
}

export const MESSENGER_ORIGIN_TOKEN_TTL_SECONDS = ORIGIN_TOKEN_TTL_SECONDS;
