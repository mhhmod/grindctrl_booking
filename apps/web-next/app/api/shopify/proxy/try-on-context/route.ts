import { NextRequest, NextResponse } from 'next/server';
import { RequestRateLimitError, rateLimitErrorResponse } from '@/lib/request-rate-limit';
import { proxyVisitorId, requireProxyRateLimit } from '@/lib/shopify/proxy-rate-limit';
import { verifyShopifyProxySignature } from '@/lib/messenger/identity';
import { normalizeShopDomain } from '@/lib/shopify/shop-authorization';
import {
  isTryOnNonce,
  normalizeVariantId,
  signStorefrontContext,
  STOREFRONT_CONTEXT_TTL_SECONDS,
} from '@/lib/try-on/storefront-context';
import { validateProductId } from '@/lib/try-on/validator';
import {
  ProductResolutionError,
  resolveStorefrontProduct,
} from '@/lib/shopify/product-resolver';
import { getConfiguredShopifyApps, resolveShopifyApp } from '@/lib/shopify/app-registry';
import { getTryOnLaunch } from '@/lib/try-on/launch';
import { storeFlags } from '@/lib/flags/store-flags';
import { launchAudience, launchVisitorId } from '@/lib/launch/audience';
import { getStoreLaunch } from '@/lib/launch/store-launch';
import { verifyPreviewTokenAnyApp } from '@/lib/launch/preview-token';

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
  const configured = getConfiguredShopifyApps().length > 0;
  const params = request.nextUrl.searchParams;
  const resolved = configured
    ? resolveShopifyApp((secret) => verifyShopifyProxySignature(params, secret))
    : null;

  /* Keyed by the signed shop and the script's visitor id, since the address
     here is Shopify's (phase zero item 3). Unsigned callers keep the
     address key and are refused just below. */
  try {
    await requireProxyRateLimit(request, {
      route: 'try-on-context',
      signedShop: resolved ? normalizeShopDomain(params.get('shop')) : null,
      visitorId: proxyVisitorId(params.get('vid')),
    });
  } catch (error) {
    if (error instanceof RequestRateLimitError) return rateLimitErrorResponse(error);
    throw error;
  }

  if (!configured) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }
  if (!resolved) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }
  const secret = resolved.app.secret;

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

  /* A product page cached before the looks ran out still shows the button.
     Refuse here, before a photo is ever asked for, with the launch reason
     as the code (N34: out_of_looks). A failed entitlement read is not a
     refusal: the credit reservation at generation is the real gate, so a
     database hiccup must not hide try-on from a store that has looks. */
  /* Who may start a look on this store now (phase zero item 9): nobody but
     the owner while it is in setup or preview, and nobody in the holdout's
     off arm. The owner's looks, from the signed preview link, are test
     looks: they never spend the store's looks, so running out does not
     stop them. */
  const [launch, features] = await Promise.all([getTryOnLaunch(shop), storeFlags({ shopDomain: shop })]);
  const storeLaunch = features.includes('n5_preview_mode') ? await getStoreLaunch(shop) : null;
  const audience = launchAudience({
    launch: storeLaunch,
    features,
    preview: verifyPreviewTokenAnyApp(params.get('preview'), shop),
    visitorId: launchVisitorId(params.get('vid')),
    now: new Date(),
  });
  if (!audience.show) {
    return NextResponse.json(
      { error: audience.reason },
      { status: 409, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  const blocked =
    launch.tryOn === 'hidden' &&
    launch.reason !== 'unavailable' &&
    !(audience.test && launch.reason === 'out_of_looks');
  if (blocked) {
    return NextResponse.json(
      { error: launch.reason },
      { status: 409, headers: { 'Cache-Control': 'no-store' } },
    );
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
      test: audience.test,
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
