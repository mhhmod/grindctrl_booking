import { randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { normalizeShopDomain } from '@/lib/shopify/shop-authorization';
import {
  buildAuthorizeUrl,
  resolveCallbackBase,
  OAUTH_APP_COOKIE,
  OAUTH_STATE_COOKIE,
  OAUTH_STATE_TTL_SECONDS,
} from '@/lib/shopify/oauth';
import { findShopifyAppByClientId, primaryShopifyApp } from '@/lib/shopify/app-registry';

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

  // The caller (today, only the "Grant order access" button) may name which
  // configured app to authorize as; omitted, this is the primary app, same
  // as a single-app deployment always was. The chosen app's clientId rides
  // along in its own cookie so the callback -- which gets no client id back
  // from Shopify -- verifies and exchanges against that SAME app, not
  // whichever happens to be primary by the time the callback lands.
  const requestedAppId = request.nextUrl.searchParams.get('app');
  const app = requestedAppId ? findShopifyAppByClientId(requestedAppId) : primaryShopifyApp();
  if (!app) {
    console.error('[shopify] oauth start: no matching Shopify app is configured');
    return NextResponse.json({ error: 'oauth_not_configured' }, { status: 503 });
  }
  const clientId = app.clientId;

  /* The callback MUST come back to the host that is about to be handed the
     state cookie — see resolveCallbackBase for why the forwarded headers,
     and not nextUrl.origin, are what answer that. */
  const base = resolveCallbackBase({
    forwardedHost: request.headers.get('x-forwarded-host'),
    host: request.headers.get('host'),
    forwardedProto: request.headers.get('x-forwarded-proto'),
    fallbackAppUrl: process.env.NEXT_PUBLIC_APP_URL ?? null,
  });
  if (!base) {
    console.error('[shopify] oauth start: untrusted host and NEXT_PUBLIC_APP_URL is not set');
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
  response.cookies.set(OAUTH_APP_COOKIE, clientId, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/api/shopify/oauth',
    maxAge: OAUTH_STATE_TTL_SECONDS,
  });
  return response;
}
