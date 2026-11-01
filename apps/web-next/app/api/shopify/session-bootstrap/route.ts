import { NextRequest, NextResponse } from 'next/server';
import { requireRateLimit, RequestRateLimitError, rateLimitErrorResponse } from '@/lib/request-rate-limit';
import { verifySessionTokenResolved } from '@/lib/shopify/session-token';
import { acquireShopToken, requestShopifyToken, ShopifyCredentialError } from '@/lib/shopify/tokens';
import { publicApiRatelimit, clientIp } from '@/lib/ratelimit';
import { getConfiguredShopifyApps } from '@/lib/shopify/app-registry';
import { syncShopStorefrontDomains } from '@/lib/messenger/shop-domain-sync';
import { syncShopifyAppOrigin } from '@/lib/shopify/admin';

/* GET /api/shopify/session-bootstrap
   Ensures this shop has a stored, sufficiently-scoped Admin API access
   token, using Shopify's token-exchange grant against the App Bridge session
   token already proven valid on this request.

   This is the current Shopify-recommended way for an embedded app to obtain
   an offline token: no redirect, no breaking out of the iframe -- exchange
   happens silently, server-to-server, from inside the same request that
   already carries a verified session token (see
   shopify.dev/docs/apps/build/authentication-authorization/access-tokens#token-exchange-grant).
   /api/shopify/oauth/start + .../oauth/callback remain the flow behind the
   manual "Grant order access" button; this route does not replace them, it
   fills the gap they left -- nothing else ever provisioned a token
   automatically on install.

   Called once per embedded-admin page load (see
   components/shopify/ensure-shop-token.tsx), the same timing as the sibling
   auto-claim flow. A merchant who never triggers this on a given visit (App
   Bridge not ready yet, a transient network failure) simply gets it on
   their next visit -- there being no token yet is the same "not
   provisioned" state the rest of the app already tolerates via
   getShopToken() returning null. */

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    await requireRateLimit(publicApiRatelimit, `sb:${clientIp(request) ?? 'unknown'}`);
  } catch (error) {
    if (error instanceof RequestRateLimitError) return rateLimitErrorResponse(error);
    throw error;
  }

  if (getConfiguredShopifyApps().length === 0) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }

  const header = request.headers.get('authorization') ?? '';
  const sessionToken = header.replace(/^bearer\s+/i, '').trim();
  const session = sessionToken ? verifySessionTokenResolved(sessionToken) : null;
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  // The token's own aud already named the app; exchange with that SAME
  // app's clientId/secret pair, not necessarily the legacy fallback one.
  const clientId = session.app.clientId;
  const secret = session.app.secret;

  try {
    const token = await acquireShopToken({
      shopDomain: session.shop, appClientId: clientId,
      exchange: () => requestShopifyToken(session.shop, {
        client_id: clientId, client_secret: secret,
        grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
        subject_token: sessionToken,
        subject_token_type: 'urn:ietf:params:oauth:token-type:id_token',
        requested_token_type: 'urn:shopify:params:oauth:token-type:offline-access-token',
        expiring: session.app.tokenMode === 'non-expiring' ? 0 : 1,
      }),
    });
    void syncShopStorefrontDomains(session.shop, token.accessToken);
    void syncShopifyAppOrigin(session.shop, token.accessToken);
    return NextResponse.json({ ok: true, provisioned: 'ready', appClientId: clientId }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const code = error instanceof ShopifyCredentialError ? error.code : 'storage_unavailable';
    return NextResponse.json({ error: code }, {
      status: code === 'busy' ? 409 : 503,
      headers: { 'Cache-Control': 'no-store', 'Retry-After': '2' },
    });
  }
}
