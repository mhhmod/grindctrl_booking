import { NextRequest, NextResponse } from 'next/server';
import { validateProductId } from '@/lib/try-on/validator';
import { clientIp, publicApiRatelimit, rateLimitedResponse } from '@/lib/ratelimit';
import { getProduct } from '@/lib/try-on/products';
import {
  createTryOnNonce,
  normalizeVariantId,
  signStorefrontContext,
  signTryOnSession,
  verifyStorefrontContext,
} from '@/lib/try-on/storefront-context';
import { normalizeShopDomain } from '@/lib/shopify/shop-authorization';
import {
  ProductResolutionError,
  resolveStorefrontProduct,
} from '@/lib/shopify/product-resolver';
import {
  legacyStorefrontCompatEnabled,
  warnLegacyStorefrontCompat,
} from '@/lib/try-on/legacy-compat';
import type { TryOnApiResponse, TryOnSession } from '@/lib/try-on/types';

/**
 * POST /api/try-on/session
 * Creates a new try-on session for a product.
 * Body: {
 *   productId: string,
 *   context: 'storefront' | 'public-demo',
 *   storefrontContext?: string,
 *   storefrontNonce?: string,
 *   variantId?: string
 * }
 *
 * A billable storefront shop is accepted only from a verified, Shopify App
 * Proxy-minted context. Body/query shop and request keys are never authority.
 */
export async function POST(request: NextRequest) {
  try {
    const limit = await publicApiRatelimit.limit(clientIp(request) ?? 'unknown');
    if (!limit.success) return rateLimitedResponse(limit.reset);

    const body = (await request.json()) as {
      productId?: string;
      context?: unknown;
      storefrontContext?: unknown;
      storefrontNonce?: unknown;
      variantId?: unknown;
      shop?: unknown;
      requestKey?: unknown;
    };
    const productId = body.productId ?? '';

    const validation = validateProductId(productId);
    if (!validation.ok) {
      const res: TryOnApiResponse = { ok: false, error: validation.error };
      return NextResponse.json(res, { status: 400 });
    }

    const legacyStorefrontRequest =
      body.shop !== undefined &&
      body.storefrontContext === undefined &&
      (body.context === undefined || body.context === 'storefront');
    if (legacyStorefrontRequest && !publicApiRatelimit.configured) {
      const res: TryOnApiResponse = {
        ok: false,
        error: 'Legacy compatibility is unavailable.',
      };
      return NextResponse.json(res, { status: 503 });
    }
    if (
      body.requestKey !== undefined ||
      (body.shop !== undefined &&
        (!legacyStorefrontRequest || !legacyStorefrontCompatEnabled()))
    ) {
      const res: TryOnApiResponse = {
        ok: false,
        error: 'Client billing overrides are not allowed.',
      };
      return NextResponse.json(res, { status: 400 });
    }

    const secret = process.env.SHOPIFY_API_SECRET?.trim();
    if (!secret) {
      const res: TryOnApiResponse = { ok: false, error: 'Try-on is not configured.' };
      return NextResponse.json(res, { status: 503 });
    }

    if (
      body.context !== 'storefront' &&
      body.context !== 'public-demo' &&
      !legacyStorefrontRequest
    ) {
      const res: TryOnApiResponse = { ok: false, error: 'Invalid try-on context.' };
      return NextResponse.json(res, { status: 400 });
    }

    let signedSession: ReturnType<typeof signTryOnSession>;
    if (legacyStorefrontRequest) {
      const shop = normalizeShopDomain(body.shop);
      const variantId = normalizeVariantId(body.variantId);
      if (!shop || (body.variantId !== undefined && body.variantId !== null && body.variantId !== '' && !variantId)) {
        const res: TryOnApiResponse = { ok: false, error: 'Invalid legacy storefront context.' };
        return NextResponse.json(res, { status: 400 });
      }

      try {
        const resolved = await resolveStorefrontProduct({
          shop,
          handle: productId,
          variantId,
        });
        const context = signStorefrontContext(secret, {
          shop,
          productId: resolved.handle,
          variantId: resolved.variantId,
          productGid: resolved.productGid,
          variantGid: resolved.variantGid,
          canonicalGarmentUrl: resolved.garmentUrl,
          nonce: createTryOnNonce(),
        });
        signedSession = signTryOnSession(secret, {
          purpose: 'legacy-compat',
          context: context.claims,
        });
        warnLegacyStorefrontCompat('session_non_billable', shop);
      } catch (error) {
        if (error instanceof ProductResolutionError) {
          const status = error.code === 'product_resolution_unavailable'
            ? 503
            : error.code === 'product_not_found'
              ? 404
              : 422;
          return NextResponse.json({ ok: false, error: error.code }, { status });
        }
        throw error;
      }
    } else if (body.context === 'storefront') {
      const contextToken = typeof body.storefrontContext === 'string'
        ? body.storefrontContext
        : '';
      const nonce = typeof body.storefrontNonce === 'string' ? body.storefrontNonce : '';
      const variantId = normalizeVariantId(body.variantId);
      if (body.variantId !== undefined && body.variantId !== null && body.variantId !== '' && !variantId) {
        const res: TryOnApiResponse = { ok: false, error: 'Invalid storefront variant.' };
        return NextResponse.json(res, { status: 400 });
      }

      const storefront = verifyStorefrontContext(secret, contextToken, {
        productId,
        variantId: body.variantId === undefined ? undefined : variantId,
        nonce,
      });
      if (!storefront) {
        const res: TryOnApiResponse = { ok: false, error: 'Invalid storefront context.' };
        return NextResponse.json(res, { status: 401 });
      }
      signedSession = signTryOnSession(secret, { purpose: 'storefront', context: storefront });
    } else {
      // The public demo is deliberately a different capability. It cannot
      // name a shop and is limited to the app's seeded demo catalog.
      if (
        body.storefrontContext !== undefined ||
        body.storefrontNonce !== undefined ||
        body.variantId !== undefined ||
        !getProduct(productId)
      ) {
        const res: TryOnApiResponse = { ok: false, error: 'Invalid public demo context.' };
        return NextResponse.json(res, { status: 400 });
      }
      signedSession = signTryOnSession(secret, { purpose: 'public-demo', productId });
    }

    const session: TryOnSession = {
      sessionId: signedSession.token,
      productId: signedSession.claims.productId,
      shop: signedSession.claims.shop,
      variantId: signedSession.claims.variantId,
      garmentUrl: signedSession.claims.canonicalGarmentUrl,
      nonce: signedSession.claims.nonce,
      createdAt: new Date(signedSession.claims.iat * 1000).toISOString(),
      expiresAt: new Date(signedSession.claims.exp * 1000).toISOString(),
    };
    const res: TryOnApiResponse<TryOnSession> = { ok: true, data: session };
    return NextResponse.json(res, { status: 200 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      const res: TryOnApiResponse = { ok: false, error: 'Invalid JSON payload.' };
      return NextResponse.json(res, { status: 400 });
    }

    const res: TryOnApiResponse = { ok: false, error: 'Unable to create try-on session.' };
    return NextResponse.json(res, { status: 500 });
  }
}
