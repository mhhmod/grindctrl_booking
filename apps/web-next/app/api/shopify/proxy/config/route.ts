import { NextRequest, NextResponse } from 'next/server';
import { getTryOnSettings } from '@/lib/try-on/settings';

/* Shopify App Proxy target: storefront calls /apps/grindctrl/config and
   Shopify forwards here, appending ?shop=<domain>&signature=... .
   Same-origin on the shop side, so no CORS needed.
   ponytail: no HMAC check while this serves only public styling config;
   verify `signature` with the app secret before serving anything sensitive. */
export async function GET(request: NextRequest) {
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
      showDownload: settings.showDownload,
      showWhatsapp: settings.showWhatsapp,
      showAddToCart: settings.showAddToCart,
      showTryAgain: settings.showTryAgain,
      disclaimerText: settings.disclaimerText,
    },
    { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } },
  );
}
