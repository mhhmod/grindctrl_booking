import { NextRequest, NextResponse } from 'next/server';
import { clientIp, proxyShopReadRatelimit, publicApiRatelimit } from '@/lib/ratelimit';
import { rateLimitErrorResponse, RequestRateLimitError, requireRateLimit } from '@/lib/request-rate-limit';
import { getPasteConnection, pasteTrust } from '@/lib/paste/store';
import { isActiveTenant } from '@/lib/shopify/tokens';
import { siteTenantKey } from '@/lib/tenancy/tenant-key';
import { buildSiteTryOnConfig } from '@/lib/woo/tryon-config';
import { siteByEmbedKey } from '@/lib/woo/tryon-site';
import { launchAudience, launchVisitorId } from '@/lib/launch/audience';
import { getStoreLaunch } from '@/lib/launch/store-launch';
import { verifyPreviewTokenAnyApp } from '@/lib/launch/preview-token';

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
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Expose-Headers': 'Retry-After',
};

function reply(body: Record<string, unknown>, cache = 'no-store', status = 200) {
  return NextResponse.json(body, { status, headers: { ...CORS, 'Cache-Control': cache } });
}

function hidden(reason: string, status = 200) {
  return reply({ tryOn: 'hidden', reason, showCardPill: false }, 'no-store', status);
}

export async function GET(request: NextRequest) {
  try {
    await requireRateLimit(publicApiRatelimit, `paste-config:${clientIp(request) ?? 'unknown'}`);
    const params = request.nextUrl.searchParams;
    const site = await siteByEmbedKey(params.get('key'));
    if (!site || site.status === 'disabled') return hidden('not_found', 404);
    await requireRateLimit(proxyShopReadRatelimit, `paste-config:${site.id}`);

    const trust = pasteTrust(await getPasteConnection(site.id));
    if (trust !== 'trusted') return hidden(trust === 'not_connected' ? 'paste_not_connected' : trust);
    const tenant = siteTenantKey(site.id);
    // Before the shared config cache: a disconnected site must never read as live.
    if (!(await isActiveTenant(tenant))) return hidden('site_disconnected');

    const config = await buildSiteTryOnConfig(site.id, params.get('locale'));
    const features = Array.isArray(config.features) ? (config.features as string[]) : [];
    const audience = launchAudience({
      launch: features.includes('n5_preview_mode') ? await getStoreLaunch(tenant) : null,
      features,
      preview: verifyPreviewTokenAnyApp(params.get('preview'), tenant),
      visitorId: launchVisitorId(params.get('vid')),
      now: new Date(),
    });
    // The owner's test looks do not spend the store's looks.
    const live = config.enabled === true || (audience.test && config.reason === 'out_of_looks');
    const tryOn = audience.show && live ? 'live' : 'hidden';
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
    }, config.reason === 'unavailable' ? 'no-store' : 'private, max-age=60');
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
