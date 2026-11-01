/* ─── Shopify embedded-app session token verification ───
   Session tokens are HS256 JWTs signed with the app's client secret.
   No external deps: node:crypto HMAC + manual claim checks. */

import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { isActiveShopifyInstallation } from './tokens';
import { findShopifyAppByClientId, getConfiguredShopifyApps, type ShopifyAppCredentials } from './app-registry';

function b64urlDecode(input: string): Buffer {
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

export type VerifiedSession = { shop: string; appClientId: string; subject: string };

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
  if (!token || token.length > 8192 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  let payload: {
    aud?: string;
    dest?: string;
    exp?: number;
    nbf?: number;
    iss?: string;
    sub?: string;
    iat?: number;
  };
  try {
    const header = JSON.parse(b64urlDecode(parts[0]).toString('utf8'));
    if (header.alg !== 'HS256' || (header.typ !== undefined && header.typ !== 'JWT')) return null;
    payload = JSON.parse(b64urlDecode(parts[1]).toString('utf8'));
    if (!payload || typeof payload !== 'object') return null;
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
  if (!Number.isSafeInteger(payload.exp) || payload.exp! <= now) return null;
  if (!Number.isSafeInteger(payload.nbf) || payload.nbf! > now + 5) return null;
  if (payload.iat !== undefined && (!Number.isSafeInteger(payload.iat) || payload.iat > now + 5)) return null;
  if (typeof payload.sub !== 'string' || !/^[1-9][0-9]*$/.test(payload.sub)) return null;
  if (typeof payload.dest !== 'string' || typeof payload.iss !== 'string') return null;
  let shop: string;
  try {
    const dest = new URL(payload.dest);
    const issuer = new URL(payload.iss);
    if (dest.protocol !== 'https:' || issuer.protocol !== 'https:' || dest.hostname !== issuer.hostname
      || dest.username || dest.password || dest.port || issuer.username || issuer.password || issuer.port
      || dest.search || dest.hash || issuer.search || issuer.hash
      || !['', '/'].includes(dest.pathname) || issuer.pathname !== '/admin') return null;
    shop = dest.hostname;
  } catch { return null; }
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop)) return null;
  return { shop, appClientId: app.clientId, subject: payload.sub, app };
}

/**
 * Verifies a Shopify session token and returns just the shop domain, for
 * the many callers that only ever needed that. See
 * verifySessionTokenResolved for callers (e.g. session-bootstrap) that also
 * need to know which app's clientId/secret pair to act as.
 */
export function verifySessionToken(token: string): VerifiedSession | null {
  const resolved = verifySessionTokenResolved(token);
  return resolved ? { shop: resolved.shop, appClientId: resolved.app.clientId, subject: resolved.subject } : null;
}

/** Every Shopify-embedded route handler authenticates the same way: a
 *  Bearer session token from App Bridge's idToken(). One place to get the
 *  prefix-stripping right, instead of every route re-deriving it. */
export async function authenticateShopifyRequest(request: NextRequest): Promise<VerifiedSession | null> {
  const header = request.headers.get('authorization') ?? '';
  const token = header.replace(/^bearer\s+/i, '').trim();
  if (!token) return null;
  const session = verifySessionToken(token);
  return session && await isActiveShopifyInstallation(session.shop, session.appClientId) ? session : null;
}

/** A sole configured registration is safe for the original one-app entry.
 * Multiple apps require an explicit configured route or verified ID token. */
export function currentShopifyClientId(): string | null {
  const apps = getConfiguredShopifyApps();
  return apps.length === 1 ? apps[0].clientId : null;
}
