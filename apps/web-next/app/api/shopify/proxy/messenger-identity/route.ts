import { NextRequest, NextResponse } from 'next/server';
import { normalizeShopDomain } from '@/lib/shopify/shop-authorization';
import {
  extractProxyIdentity,
  signShopperToken,
  verifyShopifyProxySignature,
} from '@/lib/messenger/identity';
import { publicApiRatelimit } from '@/lib/ratelimit';

/* GET /apps/grindctrl/messenger-identity  (Shopify App Proxy)
   Storefront flow:
     1. Theme block renders customer claims into the page ONLY for logged-in
        customers (Liquid server-side — never client-supplied).
     2. Loader calls /apps/grindctrl/messenger-identity on the STORE's own
        origin with those claims + sid=<anonymousId>.
     3. Shopify signs every query param with the app secret and proxies here.
     4. We verify the HMAC, then hand back a short-lived HS256 session token
        bound to sid. The signing secret never reaches storefront JS.
   No valid signature → no identity. That is the whole security model. */

const SID_RE = /^[A-Za-z0-9_-]{8,64}$/;

export async function GET(request: NextRequest) {
  const limit = await publicApiRatelimit.limit(`mi:${request.headers.get('x-real-ip') ?? 'unknown'}`);
  if (!limit.success) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });

  const secret = process.env.SHOPIFY_API_SECRET;
  const params = request.nextUrl.searchParams;

  if (!secret || !verifyShopifyProxySignature(params, secret)) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }

  const shop = normalizeShopDomain(params.get('shop'));
  if (!shop) return NextResponse.json({ error: 'bad_shop' }, { status: 400 });

  // Anonymous session id the loader generated; binds the issued token so it
  // cannot be replayed from another browser/session.
  const sid = params.get('sid') ?? '';
  if (!SID_RE.test(sid)) return NextResponse.json({ error: 'bad_sid' }, { status: 400 });

  // Logged-out storefronts legitimately reach here: return an explicit
  // anonymous verdict rather than an error, so the loader stops retrying.
  const identity = extractProxyIdentity(params);
  if (!identity) return NextResponse.json({ authenticated: false });

  const token = signShopperToken(secret, { sessionId: sid, identity });
  return NextResponse.json(
    { authenticated: true, token },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
