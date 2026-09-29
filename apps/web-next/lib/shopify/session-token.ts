/* ─── Shopify embedded-app session token verification ───
   Session tokens are HS256 JWTs signed with the app's client secret.
   No external deps: node:crypto HMAC + manual claim checks. */

import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { findShopifyAppByClientId, primaryShopifyApp, type ShopifyAppCredentials } from './app-registry';

function b64urlDecode(input: string): Buffer {
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

export type VerifiedSession = { shop: string };

/**
 * Verifies a Shopify session token (from App Bridge idToken() or the
 * id_token query param) against whichever configured app it names, and
 * returns the shop domain or null.
 *
 * The token's own `aud` claim says which app signed it, so this looks that
 * app up directly rather than brute-forcing every configured secret: a
 * token whose `aud` matches no configured app is rejected before any HMAC
 * is computed, same as one whose `aud` matches an app it wasn't actually
 * signed with (the signature check below still requires that app's own
 * secret, not merely its clientId appearing in the payload).
 */
export function verifySessionTokenResolved(
  token: string,
): (VerifiedSession & { app: ShopifyAppCredentials }) | null {
  if (!token) return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

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

  if (typeof payload.aud !== 'string') return null;
  const app = findShopifyAppByClientId(payload.aud);
  if (!app) return null;

  const expected = createHmac('sha256', app.secret)
    .update(`${parts[0]}.${parts[1]}`)
    .digest();
  const actual = b64urlDecode(parts[2]);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp < now - 5) return null;
  if (typeof payload.nbf === 'number' && payload.nbf > now + 5) return null;

  const shop = payload.dest?.replace(/^https:\/\//, '');
  if (!shop || !/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop)) return null;

  return { shop, app };
}

/**
 * Verifies a Shopify session token and returns just the shop domain, for
 * the many callers that only ever needed that. See
 * verifySessionTokenResolved for callers (e.g. session-bootstrap) that also
 * need to know which app's clientId/secret pair to act as.
 */
export function verifySessionToken(token: string): VerifiedSession | null {
  const resolved = verifySessionTokenResolved(token);
  return resolved ? { shop: resolved.shop } : null;
}

/** Every Shopify-embedded route handler authenticates the same way: a
 *  Bearer session token from App Bridge's idToken(). One place to get the
 *  prefix-stripping right, instead of every route re-deriving it. */
export function authenticateShopifyRequest(request: NextRequest): VerifiedSession | null {
  const header = request.headers.get('authorization') ?? '';
  const token = header.replace(/^bearer\s+/i, '').trim();
  if (!token) return null;
  return verifySessionToken(token);
}

/* The embedded-admin shell (app/shopify/app/[[...rest]]/page.tsx) needs one
   client id up front, before any shop or session token is known, to hand
   App Bridge. With more than one app configured this is necessarily a
   guess — the primary (first-configured) app — same as every other
   capability in this codebase that has no per-request signal to resolve
   against. Routing a given shop's embedded admin at the app it actually
   installed is multi-app UI work this PR does not attempt; every
   *verification* path (session tokens, HMAC, proxy signatures, webhooks)
   is multi-app correct regardless of what this constant resolves to. */
export function currentShopifyClientId(): string | null {
  return primaryShopifyApp()?.clientId ?? null;
}
