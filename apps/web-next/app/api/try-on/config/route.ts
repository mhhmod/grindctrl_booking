import { NextRequest, NextResponse } from 'next/server';
import { clientIp, publicApiRatelimit } from '@/lib/ratelimit';
import { requireRateLimit, RequestRateLimitError, rateLimitErrorResponse } from '@/lib/request-rate-limit';
import { getTryOnSettings } from '@/lib/try-on/settings';

/* Public, non-sensitive styling config for the storefront block.
   CORS-open on purpose: it only exposes what the button looks like. */
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
};

export async function GET(request: NextRequest) {
  try {
    await requireRateLimit(publicApiRatelimit, `tconfig:${clientIp(request) ?? 'unknown'}`);
  } catch (error) {
    if (!(error instanceof RequestRateLimitError)) throw error;
    const response = rateLimitErrorResponse(error);
    response.headers.set('Access-Control-Allow-Origin', CORS_HEADERS['Access-Control-Allow-Origin']);
    response.headers.set('Access-Control-Allow-Methods', CORS_HEADERS['Access-Control-Allow-Methods']);
    response.headers.set('Access-Control-Expose-Headers', 'Retry-After');
    // Do not copy successful config's public cache policy onto a denial.
    return response;
  }

  const shop = request.nextUrl.searchParams.get('shop');
  const settings = await getTryOnSettings(shop);

  return NextResponse.json(
    {
      buttonLabel: settings.buttonLabel,
      accentBg: settings.accentBg,
      accentFg: settings.accentFg,
      radiusPx: settings.radiusPx,
      widgetTheme: settings.widgetTheme,
      iconBgFrom: settings.iconBgFrom,
      iconBgTo: settings.iconBgTo,
      loadingStyle: settings.loadingStyle,
      catalogLabel: settings.catalogLabel,
      catalogIconPx: settings.catalogIconPx,
      catalogFontPx: settings.catalogFontPx,
      catalogPadPx: settings.catalogPadPx,
      buttonIconPx: settings.buttonIconPx,
      showDownload: settings.showDownload,
      showWhatsapp: settings.showWhatsapp,
      showAddToCart: settings.showAddToCart,
      showTryAgain: settings.showTryAgain,
      disclaimerText: settings.disclaimerText,
    },
    { headers: CORS_HEADERS },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
