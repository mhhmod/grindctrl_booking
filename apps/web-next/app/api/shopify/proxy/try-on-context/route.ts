import { NextRequest, NextResponse } from 'next/server';
import { verifyShopifyProxySignature } from '@/lib/messenger/identity';
import { normalizeShopDomain } from '@/lib/shopify/shop-authorization';
import {
  isTryOnNonce,
  normalizeVariantId,
  signStorefrontContext,
  STOREFRONT_CONTEXT_TTL_SECONDS,
} from '@/lib/try-on/storefront-context';
import { validateProductId } from '@/lib/try-on/validator';
import { clientIp, publicApiRatelimit } from '@/lib/ratelimit';
import {
  ProductResolutionError,
  resolveStorefrontProduct,
} from '@/lib/shopify/product-resolver';

/* Shopify App Proxy child route:
 *   /apps/grindctrl/try-on-context -> /api/shopify/proxy/try-on-context
 *
 * Shopify signs the complete query, including the canonical `shop` it adds.
 * Only after verifying that signature do we mint a short-lived capability for
 * the iframe. A stale signed proxy URL is rejected rather than becoming a
 * reusable token-minting endpoint.
 */

export const runtime = 'nodejs';

const PROXY_TIMESTAMP_FUTURE_SKEW_SECONDS = 30;

function freshProxyTimestamp(raw: string | null, nowSeconds: number): number | null {
  if (!raw || !/^\d{10}$/.test(raw)) return null;
  const timestamp = Number(raw);
  if (
    !Number.isSafeInteger(timestamp) ||
    timestamp <= nowSeconds - STOREFRONT_CONTEXT_TTL_SECONDS ||
    timestamp > nowSeconds + PROXY_TIMESTAMP_FUTURE_SKEW_SECONDS
  ) {
    return null;
  }
  return timestamp;
}

export async function GET(request: NextRequest) {
  const limit = await publicApiRatelimit.limit(`tc:${clientIp(request) ?? 'unknown'}`);
  if (!limit.success) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const secret = process.env.SHOPIFY_API_SECRET?.trim();
  if (!secret) return NextResponse.json({ error: 'not_configured' }, { status: 503 });

  const params = request.nextUrl.searchParams;
  if (!verifyShopifyProxySignature(params, secret)) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const issuedAt = freshProxyTimestamp(params.get('timestamp'), nowSeconds);
  if (issuedAt === null) {
    return NextResponse.json({ error: 'stale_proxy_request' }, { status: 401 });
  }

  const shop = normalizeShopDomain(params.get('shop'));
  const productId = params.get('product') ?? '';
  const nonce = params.get('nonce') ?? '';
  const rawVariantId = params.get('variant');
  const variantId = normalizeVariantId(rawVariantId);

  if (!shop) return NextResponse.json({ error: 'bad_shop' }, { status: 400 });
  if (!validateProductId(productId).ok) {
    return NextResponse.json({ error: 'bad_product' }, { status: 400 });
  }
  if (!isTryOnNonce(nonce)) {
    return NextResponse.json({ error: 'bad_nonce' }, { status: 400 });
  }
  if (rawVariantId && !variantId) {
    return NextResponse.json({ error: 'bad_variant' }, { status: 400 });
  }

  let resolvedProduct;
  try {
    resolvedProduct = await resolveStorefrontProduct({ shop, handle: productId, variantId });
  } catch (error) {
    if (error instanceof ProductResolutionError) {
      const status = error.code === 'product_resolution_unavailable'
        ? 503
        : error.code === 'product_not_found'
          ? 404
          : 422;
      return NextResponse.json({ error: error.code }, { status });
    }
    return NextResponse.json({ error: 'product_resolution_unavailable' }, { status: 503 });
  }

  const context = signStorefrontContext(
    secret,
    {
      shop,
      productId: resolvedProduct.handle,
      variantId: resolvedProduct.variantId,
      productGid: resolvedProduct.productGid,
      variantGid: resolvedProduct.variantGid,
      canonicalGarmentUrl: resolvedProduct.garmentUrl,
      nonce,
    },
    issuedAt,
  );
  return NextResponse.json(
    {
      token: context.token,
      shop: context.claims.shop,
      productId: context.claims.productId,
      variantId: context.claims.variantId,
      nonce: context.claims.nonce,
      expiresAt: new Date(context.claims.exp * 1000).toISOString(),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
