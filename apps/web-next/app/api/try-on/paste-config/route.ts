import { StorefrontConfigCache, configTiming } from '@/lib/storefront-config-cache';
import { NextRequest, NextResponse } from 'next/server';
import { clientIp, proxyShopReadRatelimit, publicApiRatelimit } from '@/lib/ratelimit';
import { rateLimitErrorResponse, RequestRateLimitError, requireRateLimit } from '@/lib/request-rate-limit';
import { getPasteConnection, pasteTrust } from '@/lib/paste/store';
import { isActiveTenant } from '@/lib/shopify/tokens';
import { siteTenantKey } from '@/lib/tenancy/tenant-key';
import { buildSiteTryOnConfig, siteConfigLocale } from '@/lib/woo/tryon-config';
import { siteByEmbedKey } from '@/lib/woo/tryon-site';
import { launchAudience, launchVisitorId } from '@/lib/launch/audience';
import { getStoreLaunch } from '@/lib/launch/store-launch';
import { verifyPreviewTokenAnyApp } from '@/lib/launch/preview-token';

const configs = new StorefrontConfigCache<Record<string, unknown>>();
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* GET /api/try-on/paste-config?key=<embedKey>&locale=en|ar&vid=<visitor>&preview=<token>

   What pasted code needs before it adds a product page button or any "Try
   on" pill: whether this visitor may see Try-On now (the site's launch
   answer, then the store's preview/holdout audience, as the Shopify App
   Proxy config does), the card pill switch, and the button's and pill's
   label and styling.
   Public and read-only, like /api/woo/tryon-config: the embed key ships in
   the page and selects only whose public styling is returned. It grants
   nothing; a look still needs a signed render through paste-context. */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Timing-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Expose-Headers': 'Retry-After, Server-Timing',
};

function reply(body: Record<string, unknown>, cache = 'no-store', status = 200) {
  return NextResponse.json(body, { status, headers: { ...CORS, 'Cache-Control': cache } });
}

function hidden(reason: string, status = 200) {
  return reply({ tryOn: 'hidden', reason, showCardPill: false }, 'no-store', status);
}

export async function GET(request: NextRequest) {
  const timing = configTiming();
  return timing.finish(await getConfig(request, timing));
}

async function getConfig(request: NextRequest, timing: ReturnType<typeof configTiming>) {
  try {
    await requireRateLimit(publicApiRatelimit, `paste-config:${clientIp(request) ?? 'unknown'}`);
    const params = request.nextUrl.searchParams;
    const site = await timing.measure('site', () => siteByEmbedKey(params.get('key')));
    if (!site || site.status === 'disabled') return hidden('not_found', 404);
    await requireRateLimit(proxyShopReadRatelimit, `paste-config:${site.id}`);

    const tenant = siteTenantKey(site.id);
    const [connection, active] = await Promise.all([getPasteConnection(site.id), isActiveTenant(tenant)]);
    const trust = pasteTrust(connection);
    if (trust !== 'trusted') return hidden(trust === 'not_connected' ? 'paste_not_connected' : trust);
    // Before the shared config cache: a disconnected site must never read as live.
    if (!active) return hidden('site_disconnected');

    const cacheKey = JSON.stringify([site.id, site.settings_version ?? 0, siteConfigLocale(params.get('locale'))]);
    const config = await configs.read(cacheKey,
      () => buildSiteTryOnConfig(site.id, params.get('locale'), { fresh: true, timing }),
      (value) => value.reason === 'unavailable' ? 0 : value.enabled === true ? 20_000 : 5_000);
    const features = Array.isArray(config.features) ? (config.features as string[]) : [];
    const audience = launchAudience({
      launch: features.includes('n5_preview_mode') ? await timing.measure('plan', () => getStoreLaunch(tenant)) : null,
      features,
      preview: verifyPreviewTokenAnyApp(params.get('preview'), tenant),
      visitorId: launchVisitorId(params.get('vid')),
      now: new Date(),
    });
    // The owner's test looks do not spend the store's looks.
    const live = config.enabled === true || (audience.test && config.reason === 'out_of_looks');
    const tryOn = audience.show && live ? 'live' : 'hidden';
    if (tryOn === 'hidden') configs.delete(cacheKey);
    return reply({
      tryOn,
      reason: !audience.show ? audience.reason : live ? null : config.reason,
      showCardPill: tryOn === 'live' && config.showCardPill === true,
      locale: config.locale,
      catalogLabel: config.catalogLabel,
      catalogIconPx: config.catalogIconPx,
      catalogFontPx: config.catalogFontPx,
      catalogPadPx: config.catalogPadPx,
      accentBg: config.accentBg,
      accentFg: config.accentFg,
      radiusPx: config.radiusPx,
      // The product button's look, so pasted code shows it from the first paint.
      // The same locale-resolved label paste-context returns in its settings.
      buttonLabel: config.buttonLabel,
      iconBgFrom: config.iconBgFrom,
      iconBgTo: config.iconBgTo,
      buttonIconPx: config.buttonIconPx,
    }, 'no-store');
  } catch (error) {
    if (error instanceof RequestRateLimitError) {
      const response = rateLimitErrorResponse(error);
      for (const [name, value] of Object.entries(CORS)) response.headers.set(name, value);
      return response;
    }
    console.error('[paste] config failed', { code: 'paste_config' });
    return hidden('unavailable', 503);
  }
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
