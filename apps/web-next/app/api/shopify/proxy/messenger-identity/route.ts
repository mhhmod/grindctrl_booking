import { NextRequest, NextResponse } from 'next/server';
import { normalizeShopDomain } from '@/lib/shopify/shop-authorization';
import {
  extractProxyIdentity,
  signShopperToken,
  verifyShopifyProxySignature,
} from '@/lib/messenger/identity';
import { clientIp, publicApiRatelimit } from '@/lib/ratelimit';
import { requireRateLimit, RequestRateLimitError, rateLimitErrorResponse } from '@/lib/request-rate-limit';

/* GET /apps/grindctrl/messenger-identity  (Shopify App Proxy)
   Storefront flow:
     1. Loader calls this proxy with sid=<anonymousId>.
     2. Shopify adds shop + logged_in_customer_id and signs the full query.
     3. We verify HMAC + freshness and use ONLY Shopify's login ID.
     4. The JWT is bound to both sid and shop. Custom customer_id/email/name
        query parameters never establish identity, even when signed. */

const SID_RE = /^[A-Za-z0-9_-]{8,64}$/;

export async function GET(request: NextRequest) {
  try {
    await requireRateLimit(publicApiRatelimit, `mi:${clientIp(request) ?? 'unknown'}`);
  } catch (error) {
    if (error instanceof RequestRateLimitError) return rateLimitErrorResponse(error);
    throw error;
  }

  const secret = process.env.SHOPIFY_API_SECRET;
  const params = request.nextUrl.searchParams;

  if (!secret || !verifyShopifyProxySignature(params, secret)) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const timestamp = params.get('timestamp') ?? '';
  if (!/^\d{10}$/.test(timestamp) || Number(timestamp) <= nowSeconds - 300 || Number(timestamp) > nowSeconds + 30) {
    return NextResponse.json({ error: 'stale_proxy_request' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
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
  if (!identity) return NextResponse.json({ authenticated: false }, { headers: { 'Cache-Control': 'no-store' } });

  const token = signShopperToken(secret, { sessionId: sid, shop, identity });
  return NextResponse.json(
    { authenticated: true, token },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
