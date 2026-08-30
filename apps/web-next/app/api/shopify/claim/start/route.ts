import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken } from '@/lib/shopify/session-token';
import { signClaimToken } from '@/lib/shopify/claim-token';
import { ensureShopOwnedSite } from '@/lib/messenger/shop-provisioning';
import { publicApiRatelimit, clientIp } from '@/lib/ratelimit';

/* GET /api/shopify/claim/start
   Mints a short-lived claim token for "adopt this store into my account"
   (see /claim, the redeem side). JSON, not a redirect: the session token
   only exists as a header on an App Bridge fetch() from inside Shopify
   admin — there is nowhere to attach it to a browser navigation.

   The shop MUST come from the verified session token, never from a query
   string or body: those are attacker-controlled on any request reaching
   this route, and the whole security property of a claim link is "minted
   only for someone who opened that store's Shopify admin".

   middleware.ts excludes api/shopify wholesale (see its matcher comment —
   the embed/proxy routes are cookie-less), so nothing upstream throttles
   this route either. Same limiter as the sibling proxy route
   (messenger-identity): a valid session token alone would otherwise buy
   unlimited service-role provisioning calls through ensureShopOwnedSite. */

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const limit = await publicApiRatelimit.limit(`cs:${clientIp(request) ?? 'unknown'}`);
  if (!limit.success) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });

  // ?.trim(): a whitespace-only env value is truthy, and would otherwise
  // fail HMAC verification below with a 401 instead of this diagnostic 503.
  const secret = process.env.SHOPIFY_API_SECRET?.trim();
  if (!secret) return NextResponse.json({ error: 'not_configured' }, { status: 503 });

  const header = request.headers.get('authorization') ?? '';
  const token = header.replace(/^bearer\s+/i, '');
  const session = token ? verifySessionToken(token) : null;
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  try {
    // There must be something to claim: a merchant who never opened the
    // dashboard still gets a live config to claim, same as opening the
    // embedded app itself does. Scoped to just this call: a TypeError from
    // a programming error elsewhere in this handler must surface as a 500,
    // not get reported as the infrastructure-unavailable 503 below.
    await ensureShopOwnedSite(session.shop);
  } catch (error) {
    console.error('[shopify] claim start: failed to provision shop-owned site', error);
    return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  }

  return NextResponse.json({ token: signClaimToken(secret, session.shop) });
}
