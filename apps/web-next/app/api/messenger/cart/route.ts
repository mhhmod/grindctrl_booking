import { NextRequest, NextResponse } from 'next/server';
import { requireRateLimit, RequestRateLimitError, rateLimitErrorResponse } from '@/lib/request-rate-limit';
import { publicApiRatelimit, clientIp } from '@/lib/ratelimit';
import { resolveShopperSession } from '@/lib/messenger/public-session';
import { patchConversationMetadata } from '@/lib/messenger/conversations';
import { parseCart } from '@/lib/messenger/cart';
import { flagStoreForSite, storeFlags } from '@/lib/flags/store-flags';

/* POST /api/messenger/cart  (N16's cart, for N25's big-order rule; phase
   zero item 10)
   The storefront loader reads Shopify's /cart.js when the panel opens and
   when the cart changes, and the panel posts it here as
   { cart: { totalMinor, currency, items: [{ handle, variantId, title,
   quantity, priceMinor }] } }. It is kept on the conversation as
   metadata.cart with cart_updated_at, read by the big-order rule, and
   erased with the conversation. Answers 204, or 404 not_enabled while the
   store's n25_handoff_rules flag is off, so no cart is kept for a store
   that does not use it. */

export async function POST(request: NextRequest) {
  try {
    await requireRateLimit(publicApiRatelimit, `mc:${clientIp(request) ?? 'unknown'}`);
  } catch (error) {
    if (error instanceof RequestRateLimitError) return rateLimitErrorResponse(error);
    throw error;
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 400 });
  }
  const cart = parseCart(body.cart);
  if (!cart) return NextResponse.json({ ok: false, error: 'bad_cart' }, { status: 400 });

  try {
    const session = await resolveShopperSession({
      key: body.key,
      origin: body.origin,
      originToken: body.originToken,
      anonymousId: body.anonymousId,
      conversationId: body.conversationId,
    });
    if (!session.ok) {
      return NextResponse.json({ ok: false, error: session.code }, { status: session.status });
    }
    const { site, conversation } = session;

    const features = await storeFlags(flagStoreForSite(site));
    if (!features.includes('n25_handoff_rules')) {
      return NextResponse.json({ ok: false, error: 'not_enabled' }, { status: 404 });
    }

    await patchConversationMetadata(conversation.id, {
      cart,
      cart_updated_at: new Date().toISOString(),
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('[messenger] cart failed:', error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, error: 'unavailable' }, { status: 503 });
  }
}
