import { NextRequest, NextResponse } from 'next/server';
import { getTryOnSettings } from '@/lib/try-on/settings';
import { getShopEntitlement } from '@/lib/try-on/entitlement';
import { isTryOnLocale, DEFAULT_TRYON_LOCALE, type TryOnLocale } from '@/lib/try-on/i18n';
import { pickMerchantCopy } from '@/lib/try-on/merchant-copy';

/* Shopify App Proxy target: storefront calls /apps/grindctrl/config and
   Shopify forwards here, appending ?shop=<domain>&signature=... .
   Same-origin on the shop side, so no CORS needed.
   ponytail: no HMAC check while this serves only public styling config;
   verify `signature` with the app secret before serving anything sensitive. */
export async function GET(request: NextRequest) {
  const shop = request.nextUrl.searchParams.get('shop');
  const settings = await getTryOnSettings(shop);

  /* The storefront has always sent ?locale, but this route ignored it, so
     every shopper got the merchant's strings in one language regardless of
     the store's language. */
  const requested = request.nextUrl.searchParams.get('locale');
  const locale: TryOnLocale = isTryOnLocale(requested) ? requested : DEFAULT_TRYON_LOCALE;
  const copy = pickMerchantCopy(settings, locale);
  let available = false;
  try {
    available = (await getShopEntitlement(shop)).available;
  } catch {
    available = false;
  }

  return NextResponse.json(
    {
      buttonLabel: copy.buttonLabel,
      accentBg: settings.accentBg,
      accentFg: settings.accentFg,
      radiusPx: settings.radiusPx,
      widgetTheme: settings.widgetTheme,
      iconBgFrom: settings.iconBgFrom,
      iconBgTo: settings.iconBgTo,
      loadingStyle: settings.loadingStyle,
      catalogLabel: copy.catalogLabel,
      catalogIconPx: settings.catalogIconPx,
      catalogFontPx: settings.catalogFontPx,
      catalogPadPx: settings.catalogPadPx,
      buttonIconPx: settings.buttonIconPx,
      showDownload: settings.showDownload,
      showWhatsapp: settings.showWhatsapp,
      showAddToCart: settings.showAddToCart,
      showTryAgain: settings.showTryAgain,
      disclaimerText: copy.disclaimerText,
      locale,
      available,
      messageKey: available ? null : 'tryOnTemporarilyUnavailable',
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
