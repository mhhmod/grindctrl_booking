import { randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { normalizeShopDomain } from '@/lib/shopify/shop-authorization';
import {
  buildAuthorizeUrl,
  OAUTH_STATE_COOKIE,
  OAUTH_STATE_TTL_SECONDS,
} from '@/lib/shopify/oauth';

/* GET /api/shopify/oauth/start?shop=<store>.myshopify.com
   Begins the merchant's authorization so the app can read their orders.

   The CSRF `state` lives in an HttpOnly cookie rather than a database row:
   single-use falls out of clearing the cookie, expiry falls out of Max-Age,
   and there is no table of stale nonces to sweep. */

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const shopDomain = normalizeShopDomain(request.nextUrl.searchParams.get('shop'));
  if (!shopDomain) {
    return NextResponse.json({ error: 'invalid_shop' }, { status: 400 });
  }

  const clientId = process.env.SHOPIFY_API_KEY?.trim();
  if (!clientId) {
    console.error('[shopify] oauth start: SHOPIFY_API_KEY is not set');
    return NextResponse.json({ error: 'oauth_not_configured' }, { status: 503 });
  }

  /* The callback MUST come back to the host that is about to be handed the
     state cookie. This app is served on more than one hostname (the
     marketing domain and the dashboard subdomain), and NEXT_PUBLIC_APP_URL
     names only one of them — starting the flow from the other one produced
     a redirect_uri on a host that never received the cookie, so every
     callback failed the state check.

     The Host header is client-controlled, hence the suffix check: an
     unrecognised host falls back to the configured app URL. Shopify's own
     redirect_uri whitelist is the second gate; this is the first. */
  const requestOrigin = request.nextUrl.origin;
  const originHost = (() => {
    try {
      return new URL(requestOrigin).hostname;
    } catch {
      return '';
    }
  })();
  const trusted = originHost === 'grindctrl.cloud' || originHost.endsWith('.grindctrl.cloud');
  const base = (trusted ? requestOrigin : process.env.NEXT_PUBLIC_APP_URL?.trim() ?? '').replace(/\/+$/, '');
  if (!base) {
    console.error('[shopify] oauth start: no trusted origin and NEXT_PUBLIC_APP_URL is not set');
    return NextResponse.json({ error: 'oauth_not_configured' }, { status: 503 });
  }

  const state = randomBytes(32).toString('hex');
  const response = NextResponse.redirect(
    buildAuthorizeUrl({
      shopDomain,
      clientId,
      redirectUri: `${base}/api/shopify/oauth/callback`,
      state,
    }),
  );

  /* Lax, not Strict: the callback is a top-level navigation arriving from
     accounts.shopify.com, and Strict would withhold the cookie on exactly
     that request. */
  response.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/api/shopify/oauth',
    maxAge: OAUTH_STATE_TTL_SECONDS,
  });
  return response;
}
