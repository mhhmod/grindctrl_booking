import { NextRequest, NextResponse } from 'next/server';
import { normalizeShopDomain } from '@/lib/shopify/shop-authorization';
import { recordTryOnShopSeen } from '@/lib/shopify/shops';
import { storeShopToken } from '@/lib/shopify/tokens';
import { OAUTH_STATE_COOKIE, resolveCallbackBase, statesMatch, verifyOAuthHmac } from '@/lib/shopify/oauth';

/* GET /api/shopify/oauth/callback
   Completes authorization and stores the offline Admin token, encrypted.

   Three independent checks before the code is ever exchanged: the state
   matches the cookie this browser was given, the HMAC proves Shopify signed
   the callback, and the shop is a well-formed myshopify domain. */

export const runtime = 'nodejs';

/* Back to the button that started this. Exactly one thing links to
   /api/shopify/oauth/start — "Grant order access" in Support Desk settings —
   so this is where the merchant was and where the answer belongs.

   It used to land on /dashboard/install, a design mock that is not in the
   nav, ignores the result entirely, and hands out a placeholder site key
   alongside a script URL that 404s. A merchant who granted order access was
   shown installation instructions for something that does not exist, and was
   never told whether the grant had worked. */
function ordersReturn(appUrl: string, outcome: 'connected' | 'failed'): string {
  return `${appUrl}/dashboard/messenger?tab=behaviour&orders=${outcome}`;
}

function failure(appUrl: string, reason: string): NextResponse {
  console.error('[shopify] oauth callback rejected:', reason);
  // Never echo the reason to the browser: a precise failure tells whoever
  // is probing which of the three checks they still need to defeat.
  return NextResponse.redirect(ordersReturn(appUrl, 'failed'));
}

export async function GET(request: NextRequest) {
  /* Send the merchant back to the host they started on, not to whatever
     NEXT_PUBLIC_APP_URL happens to say — on this VPS it names a hostname
     that 404s, so a successful connect would have ended on a dead page.
     The callback only reaches this host because it was the redirect_uri, so
     the request's own forwarded host is the right answer. */
  const appUrl =
    resolveCallbackBase({
      forwardedHost: request.headers.get('x-forwarded-host'),
      host: request.headers.get('host'),
      forwardedProto: request.headers.get('x-forwarded-proto'),
      fallbackAppUrl: 'https://grindctrl.cloud',
    }) ?? 'https://grindctrl.cloud';
  const secret = process.env.SHOPIFY_API_SECRET?.trim();
  const clientId = process.env.SHOPIFY_API_KEY?.trim();
  if (!secret || !clientId) return failure(appUrl, 'oauth is not configured');

  const params = request.nextUrl.searchParams;
  const shopDomain = normalizeShopDomain(params.get('shop'));
  const code = params.get('code');
  if (!shopDomain || !code) return failure(appUrl, 'missing shop or code');

  const cookieState = request.cookies.get(OAUTH_STATE_COOKIE)?.value;
  if (!statesMatch(cookieState, params.get('state'))) return failure(appUrl, 'state mismatch');
  if (!verifyOAuthHmac(request.nextUrl.search, secret)) return failure(appUrl, 'hmac mismatch');

  let granted: { access_token?: string; scope?: string };
  try {
    const exchange = await fetch(`https://${shopDomain}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: secret, code }),
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    });
    if (!exchange.ok) return failure(appUrl, `token exchange returned ${exchange.status}`);
    granted = (await exchange.json()) as { access_token?: string; scope?: string };
  } catch (error) {
    return failure(appUrl, `token exchange failed: ${error instanceof Error ? error.message : error}`);
  }

  if (!granted.access_token) return failure(appUrl, 'token exchange returned no token');

  try {
    await storeShopToken({
      shopDomain,
      accessToken: granted.access_token,
      scopes: granted.scope ?? '',
    });
  } catch (error) {
    // Most likely SHOPIFY_TOKEN_ENC_KEY is missing, which is deliberately
    // fatal here rather than storing a credential in the clear.
    return failure(appUrl, `token store failed: ${error instanceof Error ? error.message : error}`);
  }

  void recordTryOnShopSeen(shopDomain);

  const response = NextResponse.redirect(ordersReturn(appUrl, 'connected'));
  response.cookies.delete(OAUTH_STATE_COOKIE);
  return response;
}
