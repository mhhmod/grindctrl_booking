import { NextRequest, NextResponse } from 'next/server';
import { clientIp, proxyShopReadRatelimit, publicApiRatelimit } from '@/lib/ratelimit';
import {
  rateLimitErrorResponse,
  RequestRateLimitError,
  requireRateLimit,
} from '@/lib/request-rate-limit';
import { isActiveTenant } from '@/lib/shopify/tokens';
import { siteTenantKey } from '@/lib/tenancy/tenant-key';
import { buildSiteTryOnConfig } from '@/lib/woo/tryon-config';
import { siteByEmbedKey } from '@/lib/woo/tryon-site';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* GET /api/woo/tryon-config?key=<embedKey>&locale=en|ar

   Public, CORS-open styling and availability for a WooCommerce or WordPress
   storefront, read by the plugin and by tryon-woo.js. The embed key is
   public (it ships in the page) and only selects whose button styling is
   returned; it grants no capability. Nothing here is secret. */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Expose-Headers': 'Retry-After',
};
const PUBLIC_CACHE = 'public, max-age=60, stale-while-revalidate=300';

function reply(body: Record<string, unknown>, status = 200, cache = 'no-store') {
  return NextResponse.json(body, { status, headers: { ...CORS, 'Cache-Control': cache } });
}

export async function GET(request: NextRequest) {
  try {
    await requireRateLimit(publicApiRatelimit, `wtcfg:${clientIp(request) ?? 'unknown'}`);
    const params = request.nextUrl.searchParams;
    const site = await siteByEmbedKey(params.get('key'));
    if (!site) return reply({ enabled: false, reason: 'unknown_site' }, 404);

    await requireRateLimit(proxyShopReadRatelimit, `wtcfg:${site.id}`);
    // Check before the shared cache: a disconnected site must never read as live.
    if (!(await isActiveTenant(siteTenantKey(site.id)))) {
      return reply({ enabled: false, reason: 'not_installed' });
    }
    const body = await buildSiteTryOnConfig(site.id, params.get('locale'));
    return reply(body, 200, body.reason === 'unavailable' ? 'no-store' : PUBLIC_CACHE);
  } catch (error) {
    if (error instanceof RequestRateLimitError) {
      const response = rateLimitErrorResponse(error);
      for (const [name, value] of Object.entries(CORS)) response.headers.set(name, value);
      return response;
    }
    console.error('[woo] tryon-config failed');
    return reply({ enabled: false, reason: 'unavailable' }, 503);
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
