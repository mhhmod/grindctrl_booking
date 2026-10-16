import { NextRequest, NextResponse } from 'next/server';
import { clientIp, publicApiRatelimit } from '@/lib/ratelimit';
import { requireRateLimit, RequestRateLimitError, rateLimitErrorResponse } from '@/lib/request-rate-limit';
import { getTryOnSettings } from '@/lib/try-on/settings';
import { getTryOnLaunch } from '@/lib/try-on/launch';
import {
  cachedProxyConfig,
  proxyConfigCacheKey,
  storeProxyConfig,
} from '@/lib/shopify/proxy-config-cache';
import { isTryOnLocale, DEFAULT_TRYON_LOCALE, type TryOnLocale } from '@/lib/try-on/i18n';
import { pickMerchantCopy } from '@/lib/try-on/merchant-copy';
import { normalizeShopDomain } from '@/lib/shopify/shop-authorization';

/* Shopify App Proxy target: storefront calls /apps/grindctrl/config and
   Shopify forwards here, appending ?shop=<domain>&signature=... .
   Same-origin on the shop side, so no CORS needed.
   ponytail: no HMAC check while this serves only public styling config and
   the public launch answer; verify `signature` with the app secret before
   serving anything sensitive.

   This endpoint is unauthenticated and reachable by anyone, and each
   uncached call costs ~6 Supabase queries (settings + entitlement
   reconciliation). Answers are cached for a minute (proxy-config-cache),
   and every path that changes a shop's looks, plan or install clears the
   shop's entries, so the Try it on button follows the looks at once. */

export async function GET(request: NextRequest) {
  try {
    await requireRateLimit(publicApiRatelimit, `pc:${clientIp(request) ?? 'unknown'}`);
  } catch (error) {
    if (error instanceof RequestRateLimitError) return rateLimitErrorResponse(error);
    throw error;
  }

  /* Only well-formed myshopify domains may name a settings row; anything
     else resolves to the shared defaults without touching a per-shop key. */
  const rawShop = request.nextUrl.searchParams.get('shop');
  const shop = rawShop ? normalizeShopDomain(rawShop) : null;

  const requested = request.nextUrl.searchParams.get('locale');
  const locale: TryOnLocale = isTryOnLocale(requested) ? requested : DEFAULT_TRYON_LOCALE;

  const cacheKey = proxyConfigCacheKey(shop, locale);
  const cached = cachedProxyConfig(cacheKey);
  if (cached) {
    return NextResponse.json(cached, { headers: { 'Cache-Control': 'private, no-store' } });
  }

  const settings = await getTryOnSettings(shop);

  /* The storefront has always sent ?locale, but this route ignored it, so
     every shopper got the merchant's strings in one language regardless of
     the store's language. */
  const copy = pickMerchantCopy(settings, locale);
  /* The one launch answer both storefront scripts read: they keep the
     button and the catalogue pills out of the page unless it is live. */
  const launch = await getTryOnLaunch(shop);
  const available = launch.tryOn === 'live';

  const body: Record<string, unknown> = {
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
    tryOn: launch.tryOn,
    reason: launch.reason,
    // Kept for storefront scripts deployed before `tryOn` existed.
    available,
    messageKey: available ? null : 'tryOnTemporarilyUnavailable',
  };
  // A failed entitlement read is not cached, so the next request retries
  // instead of hiding the button for a full minute.
  if (launch.reason !== 'unavailable') storeProxyConfig(cacheKey, body);

  return NextResponse.json(body, { headers: { 'Cache-Control': 'private, no-store' } });
}
