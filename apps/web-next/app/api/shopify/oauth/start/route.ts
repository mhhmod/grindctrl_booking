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
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!clientId || !appUrl) {
    console.error('[shopify] oauth start: SHOPIFY_API_KEY or NEXT_PUBLIC_APP_URL is not set');
    return NextResponse.json({ error: 'oauth_not_configured' }, { status: 503 });
  }

  const state = randomBytes(32).toString('hex');
  const response = NextResponse.redirect(
    buildAuthorizeUrl({
      shopDomain,
      clientId,
      redirectUri: `${appUrl.replace(/\/+$/, '')}/api/shopify/oauth/callback`,
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
