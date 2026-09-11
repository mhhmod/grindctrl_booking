import { NextRequest, NextResponse } from 'next/server';
import { requireRateLimit, RequestRateLimitError, rateLimitErrorResponse } from '@/lib/request-rate-limit';
import { verifySessionToken } from '@/lib/shopify/session-token';
import { getShopToken, hasRequiredScopes, storeShopToken } from '@/lib/shopify/tokens';
import { publicApiRatelimit, clientIp } from '@/lib/ratelimit';

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

  const secret = process.env.SHOPIFY_API_SECRET?.trim();
  const clientId = process.env.SHOPIFY_API_KEY?.trim();
  if (!secret || !clientId) return NextResponse.json({ error: 'not_configured' }, { status: 503 });

  const header = request.headers.get('authorization') ?? '';
  const sessionToken = header.replace(/^bearer\s+/i, '').trim();
  const session = sessionToken ? verifySessionToken(sessionToken) : null;
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const existing = await getShopToken(session.shop);
  if (existing && hasRequiredScopes(existing.scopes)) {
    return NextResponse.json({ ok: true, provisioned: 'existing' });
  }

  let granted: { access_token?: string; scope?: string };
  try {
    const exchange = await fetch(`https://${session.shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: secret,
        grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
        subject_token: sessionToken,
        subject_token_type: 'urn:ietf:params:oauth:token-type:id_token',
        requested_token_type: 'urn:shopify:params:oauth:token-type:offline-access-token',
      }),
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    });
    if (!exchange.ok) {
      console.error('[shopify] session bootstrap: token exchange returned', exchange.status);
      return NextResponse.json({ error: 'exchange_failed' }, { status: 502 });
    }
    granted = (await exchange.json()) as { access_token?: string; scope?: string };
  } catch (error) {
    console.error(
      '[shopify] session bootstrap: token exchange failed:',
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json({ error: 'exchange_failed' }, { status: 502 });
  }

  if (!granted.access_token) {
    return NextResponse.json({ error: 'exchange_failed' }, { status: 502 });
  }

  try {
    await storeShopToken({
      shopDomain: session.shop,
      accessToken: granted.access_token,
      scopes: granted.scope ?? '',
    });
  } catch (error) {
    // Most likely SHOPIFY_TOKEN_ENC_KEY is missing, which is deliberately
    // fatal here rather than storing a credential in the clear.
    console.error(
      '[shopify] session bootstrap: token store failed:',
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json({ error: 'store_failed' }, { status: 503 });
  }

  return NextResponse.json({ ok: true, provisioned: 'exchanged' });
}
