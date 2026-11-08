import { NextRequest, NextResponse } from 'next/server';
import { clientIp, publicApiRatelimit, proxyVisitorRatelimit, proxyShopMintRatelimit } from '@/lib/ratelimit';
import { requireRateLimit, RequestRateLimitError, rateLimitErrorResponse } from '@/lib/request-rate-limit';
import { loadPublicSite, originAllowed, provenOrigin } from '@/lib/messenger/public-api';
import { getPasteConnection, pasteTrustedHosts, recordPasteSignal } from '@/lib/paste/store';
import { pasteCapabilitySecret, verifyLiquidSignature, type LiquidClaims } from '@/lib/paste/signing';
import { pasteTurnstileConfig } from '@/lib/paste/turnstile';
import { siteTenantKey } from '@/lib/tenancy/tenant-key';
import { isActiveTenant } from '@/lib/shopify/tokens';
import { assertSafeGarmentUrl, UnsafeGarmentUrlError } from '@/lib/woo/garment-url';
import { buildSiteTryOnConfig, siteConfigLocale } from '@/lib/woo/tryon-config';
import { readSiteLaunch } from '@/lib/woo/tryon-site';
import { createTryOnNonce, signStorefrontContext, normalizeVariantId } from '@/lib/try-on/storefront-context';
import { validateProductId } from '@/lib/try-on/validator';
import { storeFlags } from '@/lib/flags/store-flags';
import { getStoreLaunch } from '@/lib/launch/store-launch';
import { launchAudience, launchVisitorId } from '@/lib/launch/audience';
import { verifyPreviewTokenAnyApp } from '@/lib/launch/preview-token';
import { getShopEntitlement } from '@/lib/try-on/entitlement';
import { tryOnLaunchFromEntitlement } from '@/lib/try-on/launch';
import type { PasteContextResponse } from '@/lib/paste/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const MAX_BODY_BYTES = 8192;

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: {
    'Access-Control-Allow-Origin': request.headers.get('origin') ?? '', Vary: 'Origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type',
  } });
}

export async function POST(request: NextRequest) {
  const response = await mint(request);
  const origin = request.headers.get('origin');
  if (origin) response.headers.set('Access-Control-Allow-Origin', origin);
  response.headers.set('Vary', 'Origin');
  return response;
}

async function mint(request: NextRequest): Promise<Response> {
  try {
    const ip = clientIp(request) ?? 'unknown';
    await requireRateLimit(publicApiRatelimit, `paste-context:${ip}`);
    if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) return json({ error: 'invalid_request' }, 413);
    const text = await request.text();
    if (Buffer.byteLength(text) > MAX_BODY_BYTES) return json({ error: 'invalid_request' }, 413);
    const raw: unknown = JSON.parse(text);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return json({ error: 'invalid_request' }, 400);
    const b = raw as Record<string, unknown>;
    // The public key selects a site; a tenant is ALWAYS server-derived.
    if (b.tenant !== undefined || b.shop !== undefined || b.siteId !== undefined || typeof b.key !== 'string'
      || typeof b.productId !== 'string' || !validateProductId(b.productId).ok
      || typeof b.pageUrl !== 'string' || b.pageUrl.length > 2048
      || !URL.canParse(b.pageUrl)
      || typeof b.imageUrl !== 'string' || b.imageUrl.length > 2048
      || !launchVisitorId(b.visitorId) || (b.title !== undefined && typeof b.title !== 'string')
      || (b.preview !== undefined && (typeof b.preview !== 'string' || b.preview.length > 512))) {
      return json({ error: 'invalid_request' }, 400);
    }
    const variantId = normalizeVariantId(b.variantId);
    if (b.variantId != null && b.variantId !== '' && !variantId) return json({ error: 'invalid_request' }, 400);
    const site = await loadPublicSite(b.key);
    if (!site || site.status === 'disabled') return json({ error: 'not_found' }, 404);
    const connection = await getPasteConnection(site.id);
    if (!connection || connection.status !== 'active') return json({ error: 'paste_not_connected' }, 403);
    const tenant = siteTenantKey(site.id);
    await requireRateLimit(proxyVisitorRatelimit, `paste:${site.id}:${ip}:${b.visitorId}`);
    await requireRateLimit(proxyShopMintRatelimit, `paste:${site.id}`);
    if (!(await isActiveTenant(tenant))) return json({ error: 'site_disconnected' }, 403);

    const { origin, trusted } = provenOrigin(b.key, { headerOrigin: request.headers.get('origin'), originToken: b.originToken });
    const page = new URL(b.pageUrl);
    const hosts = await pasteTrustedHosts(connection);
    if (!trusted || !origin || page.origin !== origin || page.protocol !== 'https:' || page.username || page.password || page.port
      || !hosts.includes(page.hostname) || !originAllowed(site, origin, { trusted: true })) {
      return json({ error: 'origin_not_allowed' }, 403);
    }
    if (connection.platform === 'shopify') {
      const s = b.signed;
      if (!s || typeof s !== 'object' || Array.isArray(s)) return json({ error: 'bad_signature' }, 401);
      const claims = s as Record<string, unknown>;
      if (!['siteId', 'shopDomain', 'productId', 'variantId', 'issuedAt', 'customerId', 'signature']
        .every((key) => typeof claims[key] === 'string') || claims.productId !== b.productId || claims.variantId !== variantId) {
        return json({ error: 'bad_signature' }, 401);
      }
      const verified = await verifyLiquidSignature({ connection, claims: claims as unknown as LiquidClaims,
        signature: claims.signature as string, visitor: `${ip}:${b.visitorId}` });
      if (!verified.ok) return json({ error: verified.code }, verified.code === 'unavailable' ? 503 : verified.code === 'replayed' ? 409 : 401);
    }
    const features = await storeFlags({ widgetSiteId: site.id });
    const audience = launchAudience({
      launch: features.includes('n5_preview_mode') ? await getStoreLaunch(tenant) : null, features,
      preview: verifyPreviewTokenAnyApp(b.preview, tenant), visitorId: b.visitorId as string, now: new Date(),
    });
    if (!audience.show) return json({ error: audience.reason }, 409);
    const garment = await assertSafeGarmentUrl(b.imageUrl, [
      ...hosts, ...(connection.platform === 'shopify' ? ['cdn.shopify.com'] : []),
    ]);
    const state = await readSiteLaunch(site.id);
    let { launch } = state;
    // A signed render/trusted request is a real signal too, useful when the
    // loader's telemetry is blocked. Merely generating a snippet never is.
    const signal = await recordPasteSignal(site.id, origin);
    if (state.unsubscribed) {
      if (signal === 'apex_taken') return json({ error: 'free_plan_taken' }, 409);
      if (signal !== 'granted') return json({ error: 'unavailable' }, 503);
      launch = tryOnLaunchFromEntitlement(await getShopEntitlement(tenant));
    }
    if (launch.tryOn === 'hidden' && !(audience.test && launch.reason === 'out_of_looks')) {
      return json({ error: launch.reason }, launch.reason === 'unavailable' ? 503 : 409);
    }
    const secret = pasteCapabilitySecret(site.id);
    if (!secret) return json({ error: 'unavailable' }, 503);
    const nonce = createTryOnNonce();
    const title = typeof b.title === 'string' ? b.title.slice(0, 200) : '';
    const context = signStorefrontContext(secret, {
      shop: tenant, platform: connection.platform === 'shopify' ? 'paste-shopify' : 'paste-website',
      productId: b.productId, variantId, productGid: `paste:${b.productId}`, variantGid: `paste:${variantId ?? b.productId}`,
      canonicalGarmentUrl: garment.url.toString(), title, pageUrl: page.toString(), origin, nonce, test: audience.test,
    });
    const params = new URLSearchParams({ product: b.productId, title, garment: garment.url.toString(), shop: tenant,
      locale: siteConfigLocale(b.locale), variant: variantId ?? '', sheet: '1' });
    const appOrigin = (process.env.NEXT_PUBLIC_APP_URL || 'https://grindctrl.cloud').replace(/\/+$/, '');
    return json({
      context: { token: context.token, nonce, productId: b.productId, variantId, expiresAt: new Date(context.claims.exp * 1000).toISOString() },
      embedUrl: `${appOrigin}/embed/try-on?${params}#storefrontContext=${encodeURIComponent(context.token)}&storefrontNonce=${nonce}`,
      settings: await buildSiteTryOnConfig(site.id, b.locale),
      turnstile: connection.platform === 'website' && !audience.test ? pasteTurnstileConfig() : null,
    } satisfies PasteContextResponse);
  } catch (error) {
    if (error instanceof RequestRateLimitError) return rateLimitErrorResponse(error);
    if (error instanceof SyntaxError) return json({ error: 'invalid_request' }, 400);
    if (error instanceof UnsafeGarmentUrlError) return json({ error: 'garment_unsafe' }, 422);
    return json({ error: 'unavailable' }, 503);
  }
}
