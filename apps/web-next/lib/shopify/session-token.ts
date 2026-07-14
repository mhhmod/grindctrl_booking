/* ─── Shopify embedded-app session token verification ───
   Session tokens are HS256 JWTs signed with the app's client secret.
   No external deps: node:crypto HMAC + manual claim checks. */

import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';

const CLIENT_ID = 'fc095fe656d9029fdc249a4af2315f19';

function b64urlDecode(input: string): Buffer {
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

export type VerifiedSession = { shop: string };

/**
 * Verifies a Shopify session token (from App Bridge idToken() or the
 * id_token query param). Returns the shop domain or null.
 */
export function verifySessionToken(token: string): VerifiedSession | null {
  const secret = process.env.SHOPIFY_API_SECRET;
  if (!secret || !token) return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const expected = createHmac('sha256', secret)
    .update(`${parts[0]}.${parts[1]}`)
    .digest();
  const actual = b64urlDecode(parts[2]);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }

  let payload: {
    aud?: string;
    dest?: string;
    exp?: number;
    nbf?: number;
  };
  try {
    payload = JSON.parse(b64urlDecode(parts[1]).toString('utf8'));
  } catch {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.aud !== CLIENT_ID) return null;
  if (typeof payload.exp !== 'number' || payload.exp < now - 5) return null;
  if (typeof payload.nbf === 'number' && payload.nbf > now + 5) return null;

  const shop = payload.dest?.replace(/^https:\/\//, '');
  if (!shop || !/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop)) return null;

  return { shop };
}

export const SHOPIFY_CLIENT_ID = CLIENT_ID;
