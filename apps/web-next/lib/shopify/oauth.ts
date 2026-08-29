import { createHmac, timingSafeEqual } from 'node:crypto';

/* Shopify OAuth helpers. Pure functions so the signature rules — the part
   that decides whether a callback is genuinely from Shopify — are directly
   testable without a live install.

   Note this HMAC is NOT the app-proxy `signature` scheme in
   lib/messenger/identity.ts: proxy joins sorted `k=v` pairs with nothing
   between them, OAuth joins them with `&`. Using either rule in the other
   place verifies nothing. */

/** The scopes the app requests. `read_orders` is what order lookup needs,
 *  and adding it forces every existing install to re-consent. */
export const APP_SCOPES = 'read_products,read_orders,write_app_proxy';

export const OAUTH_STATE_COOKIE = 'gc_shopify_oauth_state';
export const OAUTH_STATE_TTL_SECONDS = 600;

/** Verifies the `hmac` parameter over the rest of the raw query string.
 *
 *  Operates on the RAW query, not URLSearchParams: Shopify signs the
 *  percent-encoded values it sent, and decoding then re-encoding them can
 *  produce a different byte string (spaces, `+`, unreserved characters),
 *  which would fail valid callbacks and, worse, could be made to pass
 *  crafted ones. */
export function verifyOAuthHmac(rawQuery: string, secret: string): boolean {
  if (!secret) return false;
  const query = rawQuery.startsWith('?') ? rawQuery.slice(1) : rawQuery;
  if (!query) return false;

  let provided = '';
  const pairs: string[] = [];
  for (const pair of query.split('&')) {
    if (!pair) continue;
    if (pair.startsWith('hmac=')) {
      provided = decodeURIComponent(pair.slice('hmac='.length));
      continue;
    }
    if (pair.startsWith('signature=')) continue; // legacy, excluded like hmac
    pairs.push(pair);
  }
  if (!provided) return false;

  pairs.sort();
  const expected = createHmac('sha256', secret).update(pairs.join('&'), 'utf8').digest('hex');

  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Constant-time state comparison. The cookie is the only place the state
 *  was ever stored, so a mismatch means this callback did not begin here. */
export function statesMatch(fromCookie: string | undefined, fromQuery: string | null): boolean {
  if (!fromCookie || !fromQuery) return false;
  const a = Buffer.from(fromCookie, 'utf8');
  const b = Buffer.from(fromQuery, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

export function buildAuthorizeUrl(input: {
  shopDomain: string;
  clientId: string;
  redirectUri: string;
  state: string;
  scopes?: string;
}): string {
  const params = new URLSearchParams({
    client_id: input.clientId,
    scope: input.scopes ?? APP_SCOPES,
    redirect_uri: input.redirectUri,
    state: input.state,
  });
  /* No `grant_options[]=per-user`, which is what makes this an OFFLINE
     token: it keeps working when nobody is logged into the admin, which is
     the entire point — a shopper asks about an order at 2am. */
  return `https://${input.shopDomain}/admin/oauth/authorize?${params.toString()}`;
}
