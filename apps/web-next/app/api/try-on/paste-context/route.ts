import { recordPhotoHealth } from '@/lib/store-health/signals';
import { NextRequest, NextResponse } from 'next/server';
import { clientIp, publicApiRatelimit, proxyVisitorRatelimit, proxyShopMintRatelimit } from '@/lib/ratelimit';
import { requireRateLimit, RequestRateLimitError, rateLimitErrorResponse } from '@/lib/request-rate-limit';
import { isJsonObject, readLimitedJson } from '@/lib/http/read-limited-body';
import { loadPublicSite, originAllowed, provenOrigin } from '@/lib/messenger/public-api';
import {
  getPasteConnection, pasteDomainOf, pasteProofHosts, pasteTrust, pasteTrustedHosts, pasteTryOnHosts, readPasteDomainPlatforms,
  recordPasteCodeVersion, recordPasteSignal,
} from '@/lib/paste/store';
import { schedulePasteDomainCheck } from '@/lib/paste/domain-check';
import { isAnyPlatformImageHost, platformImageHosts } from '@/lib/paste/platform-image-hosts';
import { schedulePasteDomainPlatformCheck } from '@/lib/paste/platform-check';
import { checkPasteShop } from '@/lib/paste/shop-proof';
import { PasteError, type PasteContextResponse, type PasteProofResponse } from '@/lib/paste/types';
import { pasteCapabilitySecret, verifyLiquidSignature, type LiquidClaims } from '@/lib/paste/signing';
import { pasteTurnstileConfig } from '@/lib/paste/turnstile';
import { siteTenantKey } from '@/lib/tenancy/tenant-key';
import { isActiveTenant } from '@/lib/shopify/tokens';
import { assertSafeGarmentUrl, checkGarmentUrl, garmentRefusalReason, UnsafeGarmentUrlError } from '@/lib/woo/garment-url';
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
    const parsed = await readLimitedJson(request, MAX_BODY_BYTES);
    if (!parsed.ok) return json({ error: 'invalid_request' }, parsed.status);
    if (!isJsonObject(parsed.value)) return json({ error: 'invalid_request' }, 400);
    const b = parsed.value;
    /* `proof`: messenger.js asking only to finish a pending Shopify shop's
       proof with this page's signed render, so Store Chat can start without
       Try-On (no image, no context minted). Every check below still runs:
       rate limits, origin, signature and replay, then the storefront check. */
    const proof = b.proof === true;
    // The public key selects a site; a tenant is ALWAYS server-derived.
    if (b.tenant !== undefined || b.shop !== undefined || b.siteId !== undefined || typeof b.key !== 'string'
      || (b.proof !== undefined && !proof)
      || typeof b.productId !== 'string' || !validateProductId(b.productId).ok
      || typeof b.pageUrl !== 'string' || b.pageUrl.length > 2048
      || !URL.canParse(b.pageUrl)
      || (!proof && (typeof b.imageUrl !== 'string' || b.imageUrl.length > 2048))
      || !launchVisitorId(b.visitorId) || (b.title !== undefined && typeof b.title !== 'string')
      || (b.preview !== undefined && (typeof b.preview !== 'string' || b.preview.length > 512))
      || (b.codeVersion !== undefined && !(Number.isInteger(b.codeVersion) && (b.codeVersion as number) >= 1 && (b.codeVersion as number) <= 99))) {
      return json({ error: 'invalid_request' }, 400);
    }
    const variantId = normalizeVariantId(b.variantId);
    if (b.variantId != null && b.variantId !== '' && !variantId) return json({ error: 'invalid_request' }, 400);
    const site = await loadPublicSite(b.key);
    if (!site || site.status === 'disabled') return json({ error: 'not_found' }, 404);
    const connection = await getPasteConnection(site.id);
    const trust = pasteTrust(connection);
    if (!connection || trust === 'not_connected') return json({ error: 'paste_not_connected' }, 403);
    if (trust === 'shopify_app_installed') return json({ error: 'shopify_app_installed' }, 409);
    if (proof && connection.platform !== 'shopify') return json({ error: 'invalid_request' }, 400);
    const tenant = siteTenantKey(site.id);
    await requireRateLimit(proxyVisitorRatelimit, `paste:${site.id}:${ip}:${b.visitorId}`);
    await requireRateLimit(proxyShopMintRatelimit, `paste:${site.id}`);

    const { origin, trusted } = provenOrigin(b.key, { headerOrigin: request.headers.get('origin'), originToken: b.originToken });
    const page = new URL(b.pageUrl);
    // A pending shop is not trusted anywhere yet. Its render may arrive from
    // the shop host or a storefront domain row; see the storefront proof below.
    const pending = trust === 'shop_proof_pending';
    const hosts = pending ? await pasteProofHosts(connection) : await pasteTrustedHosts(connection);
    if (!trusted || !origin || page.origin !== origin || page.protocol !== 'https:' || page.username || page.password || page.port
      || !hosts.includes(page.hostname)
      || !originAllowed(pending ? { ...site, pasteShopDomain: connection.shop_domain } : site, origin, { trusted: true })) {
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
        signature: claims.signature as string });
      if (!verified.ok) return json({ error: verified.code }, verified.code === 'unavailable' ? 503 : verified.code === 'replayed' ? 409 : 401);
      // Which snippet the store runs, for the dashboard's "copy the new code".
      // Unsigned, so only a hint, and only after this render verified.
      if (typeof b.codeVersion === 'number') await recordPasteCodeVersion(site.id, b.codeVersion);
      if (pending) {
        // A verified render is only the second factor: anyone can sign a
        // render naming any shop. It triggers our storefront fetch, which
        // must find this site's signed snippet on the shop itself before
        // this site becomes the shop's holder and displaces other claims.
        let shopProof;
        try {
          shopProof = await checkPasteShop(connection, { kind: 'render' });
        } catch (error) {
          if (error instanceof PasteError && error.code === 'connection_conflict') return json({ error: 'shopify_app_installed' }, 409);
          if (error instanceof PasteError && error.code === 'not_found') return json({ error: 'paste_not_connected' }, 403);
          throw error;
        }
        if (shopProof.shopProof !== 'proven') return json({ error: 'shop_proof_pending' }, 403);
      }
      // The shop is proven (now or before): that is all a proof request asks.
      if (proof) return json({ proven: true } satisfies PasteProofResponse);
    }
    // Try-On runs only where our server confirmed this site's code: the
    // proven shop host, or a domain whose page it found the snippet on.
    // Store Chat keeps working on a domain that is still waiting; the
    // button stays hidden there while our check runs.
    if (!(await pasteTryOnHosts(connection)).includes(page.hostname)) {
      schedulePasteDomainCheck(site.id, page.hostname);
      return json({ error: 'not_installed' }, 409);
    }
    if (!(await isActiveTenant(tenant))) return json({ error: 'site_disconnected' }, 403);
    const features = await storeFlags({ widgetSiteId: site.id });
    const audience = launchAudience({
      launch: features.includes('n5_preview_mode') ? await getStoreLaunch(tenant) : null, features,
      preview: verifyPreviewTokenAnyApp(b.preview, tenant), visitorId: b.visitorId as string, now: new Date(),
    });
    if (!audience.show) return json({ error: audience.reason }, 409);
    const siteHosts = [...hosts, ...(connection.platform === 'shopify' ? ['cdn.shopify.com'] : [])];
    // Validated above for every request that is not proof-only (those returned).
    const imageUrl = b.imageUrl as string;
    // Website pages may also use the image servers of the platform OUR
    // server fingerprinted on this page's own domain. Read only when needed.
    const platforms = connection.platform === 'website' && !checkGarmentUrl(imageUrl, siteHosts)
      ? await readPasteDomainPlatforms(site.id) : null;
    const pageDomain = platforms && pasteDomainOf(platforms, page.hostname);
    let garment: Awaited<ReturnType<typeof assertSafeGarmentUrl>>;
    try {
      garment = await assertSafeGarmentUrl(imageUrl, { site: siteHosts, exact: platformImageHosts(pageDomain?.platform) });
    } catch (error) {
      if (!(error instanceof UnsafeGarmentUrlError)) throw error;
      await recordPhotoHealth(site.id, imageUrl, false);
      const reason = garmentRefusalReason(error);
      const imageHost = URL.canParse(imageUrl) ? new URL(imageUrl).hostname.toLowerCase() : null;
      console.warn('[paste] garment refused', { code: reason, site: site.id, host: imageHost, platform: pageDomain?.platform ?? null });
      // A platform image server on a domain never fingerprinted (an install
      // older than the check): look once, so the next look can pass.
      if (reason === 'garment_host_untrusted' && pageDomain && pageDomain.platform === null && imageHost && isAnyPlatformImageHost(imageHost)) {
        schedulePasteDomainPlatformCheck(site.id, pageDomain.domain);
      }
      // `error` stays garment_unsafe so every loader already hides only this product.
      return json({ error: 'garment_unsafe', reason }, 422);
    }
    const state = await readSiteLaunch(site.id);
    let { launch } = state;
    // A signed render/trusted request is a real signal too, useful when the
    // loader's telemetry is blocked. Merely generating a snippet never is.
    const signal = await recordPasteSignal(site.id, origin, { signed: connection.platform === 'shopify' });
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
      turnstile: audience.test ? null : pasteTurnstileConfig(),
    } satisfies PasteContextResponse);
  } catch (error) {
    if (error instanceof RequestRateLimitError) return rateLimitErrorResponse(error);
    if (error instanceof SyntaxError) return json({ error: 'invalid_request' }, 400);
    return json({ error: 'unavailable' }, 503);
  }
}
