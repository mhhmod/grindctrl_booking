import { NextRequest, NextResponse } from 'next/server';
import { proxyShopMintRatelimit, proxyVisitorRatelimit } from '@/lib/ratelimit';
import {
  rateLimitErrorResponse,
  RequestRateLimitError,
  requireRateLimit,
} from '@/lib/request-rate-limit';
import { invalidateProxyConfig } from '@/lib/shopify/proxy-config-cache';
import { isActiveTenant } from '@/lib/shopify/tokens';
import { siteTenantKey } from '@/lib/tenancy/tenant-key';
import { getShopEntitlement } from '@/lib/try-on/entitlement';
import { tryOnLaunchFromEntitlement } from '@/lib/try-on/launch';
import { wooTryOnKeyForSite } from '@/lib/try-on/signing-keys';
import { createTryOnNonce, signStorefrontContext } from '@/lib/try-on/storefront-context';
import { assertSafeGarmentUrl, UnsafeGarmentUrlError, verifiedSiteHosts } from '@/lib/woo/garment-url';
import { verifyWooSignedRequest, wooSignedRequestErrorResponse } from '@/lib/woo/signed-request';
import { buildSiteTryOnConfig, siteConfigLocale } from '@/lib/woo/tryon-config';
import { ensureSiteFreePlan, FreePlanTakenError, readSiteLaunch } from '@/lib/woo/tryon-site';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* POST /api/woo/tryon-context  (plugin to GRINDCTRL, signed)

   The WooCommerce counterpart of the Shopify App Proxy try-on-context
   route. The plugin calls it at click time from its own REST route with the
   product's data read from WooCommerce; this route checks the store, the
   page, the image and the plan, then mints the short-lived storefront
   context and the embed URL that carries it in the fragment.

   Request:  { productId, variationId?, title, imageUrl, pageUrl, locale,
               visitorHash }
   Response: { context, embedUrl, settings }  (Cache-Control: no-store) */

const MAX_BODY_BYTES = 8 * 1024;
const POSITIVE_INT_RE = /^[1-9]\d{0,15}$/;
const VISITOR_HASH_RE = /^[A-Za-z0-9_-]{16,64}$/;

type ContextInput = {
  productId: string;
  variationId: string | null;
  title: string;
  imageUrl: string;
  pageUrl: string;
  locale: 'en' | 'ar';
  visitorHash: string;
};

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

function id(value: unknown): string | null {
  const text = typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : '';
  return POSITIVE_INT_RE.test(text) ? text : null;
}

function parseInput(raw: unknown): ContextInput | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const body = raw as Record<string, unknown>;
  const productId = id(body.productId);
  const variationId = body.variationId === undefined || body.variationId === null || body.variationId === 0 || body.variationId === ''
    ? null
    : id(body.variationId);
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 200) : '';
  const visitorHash = typeof body.visitorHash === 'string' ? body.visitorHash : '';
  if (
    !productId
    || (body.variationId !== undefined && body.variationId !== null && body.variationId !== 0 && body.variationId !== '' && !variationId)
    || typeof body.imageUrl !== 'string'
    || typeof body.pageUrl !== 'string'
    || !VISITOR_HASH_RE.test(visitorHash)
  ) {
    return null;
  }
  return {
    productId,
    variationId,
    title,
    imageUrl: body.imageUrl,
    pageUrl: body.pageUrl,
    locale: siteConfigLocale(body.locale),
    visitorHash,
  };
}

/** The page the shopper is on must be one of the site's verified hosts. */
function pageHostVerified(pageUrl: string, hosts: readonly string[]): boolean {
  try {
    const url = new URL(pageUrl);
    if (url.protocol !== 'https:' || url.username || url.password) return false;
    const host = url.hostname.toLowerCase();
    return hosts.some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const declaredLength = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return json({ error: 'invalid_request' }, 413);
  }
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return json({ error: 'invalid_request' }, 400);
  }
  if (Buffer.byteLength(rawBody, 'utf8') > MAX_BODY_BYTES) return json({ error: 'invalid_request' }, 413);

  const verified = await verifyWooSignedRequest(request, rawBody);
  if (!verified.ok) {
    console.warn('[woo] tryon-context rejected', { code: verified.code, siteId: verified.siteId });
    return wooSignedRequestErrorResponse(verified);
  }
  const siteId = verified.siteId;

  let input: ContextInput | null = null;
  try {
    input = parseInput(JSON.parse(rawBody));
  } catch {
    input = null;
  }
  if (!input) return json({ error: 'invalid_request' }, 400);

  try {
    // Keyed by the verified site and the plugin's salted visitor hash: the
    // request reaches us from the store's server, not the shopper.
    await requireRateLimit(proxyVisitorRatelimit, `wtc:${siteId}:${input.visitorHash}`);
    await requireRateLimit(proxyShopMintRatelimit, `wtc:${siteId}`);
  } catch (error) {
    if (error instanceof RequestRateLimitError) return rateLimitErrorResponse(error);
    throw error;
  }

  const tenant = siteTenantKey(siteId);
  try {
    if (!(await isActiveTenant(tenant))) return json({ error: 'site_disconnected' }, 403);

    let hosts: string[];
    try {
      hosts = await verifiedSiteHosts(siteId);
    } catch {
      return json({ error: 'unavailable' }, 503);
    }
    if (hosts.length === 0) return json({ error: 'no_verified_domain' }, 409);
    if (!pageHostVerified(input.pageUrl, hosts)) return json({ error: 'page_not_verified' }, 403);

    // The free plan is granted on the first look, once per apex domain.
    let { launch, unsubscribed } = await readSiteLaunch(siteId);
    if (unsubscribed) {
      try {
        await ensureSiteFreePlan(siteId, hosts);
      } catch (error) {
        if (error instanceof FreePlanTakenError) return json({ error: 'free_plan_taken' }, 409);
        throw error;
      }
      invalidateProxyConfig(tenant);
      launch = tryOnLaunchFromEntitlement(await getShopEntitlement(tenant));
    }
    if (launch.tryOn === 'hidden') {
      return json({ error: launch.reason }, launch.reason === 'unavailable' ? 503 : 409);
    }

    let garment: Awaited<ReturnType<typeof assertSafeGarmentUrl>>;
    try {
      garment = await assertSafeGarmentUrl(input.imageUrl, hosts);
    } catch (error) {
      if (error instanceof UnsafeGarmentUrlError) {
        console.warn('[woo] tryon-context unsafe garment', { siteId, reason: error.code });
        return json({ error: 'garment_unsafe' }, 422);
      }
      throw error;
    }

    const key = await wooTryOnKeyForSite(siteId);
    if (!key) return json({ error: 'unavailable' }, 503);

    const nonce = createTryOnNonce();
    const context = signStorefrontContext(key.app.secret, {
      shop: tenant,
      platform: 'woocommerce',
      productId: `woo-${input.productId}`,
      variantId: input.variationId,
      productGid: `woo:${input.productId}`,
      variantGid: `woo:${input.variationId ?? input.productId}`,
      canonicalGarmentUrl: garment.url.toString(),
      title: input.title,
      pageUrl: input.pageUrl,
      origin: new URL(input.pageUrl).origin,
      nonce,
    });

    const appOrigin = (process.env.NEXT_PUBLIC_APP_URL || 'https://grindctrl.cloud').replace(/\/+$/, '');
    const query = new URLSearchParams({
      product: context.claims.productId,
      title: input.title,
      garment: context.claims.canonicalGarmentUrl,
      shop: tenant,
      locale: input.locale,
      variant: input.variationId ?? '',
      sheet: '1',
    });
    // The capability rides the fragment so it never reaches a server log.
    const embedUrl = `${appOrigin}/embed/try-on?${query.toString()}#storefrontContext=${encodeURIComponent(
      context.token,
    )}&storefrontNonce=${encodeURIComponent(nonce)}`;

    return json({
      context: {
        token: context.token,
        nonce,
        productId: context.claims.productId,
        variantId: context.claims.variantId,
        expiresAt: new Date(context.claims.exp * 1000).toISOString(),
      },
      embedUrl,
      settings: await buildSiteTryOnConfig(siteId, input.locale),
    });
  } catch (error) {
    if (error instanceof RequestRateLimitError) return rateLimitErrorResponse(error);
    console.error('[woo] tryon-context failed', {
      siteId,
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
    return json({ error: 'unavailable' }, 503);
  }
}
