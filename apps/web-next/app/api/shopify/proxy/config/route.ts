import { NextRequest, NextResponse } from 'next/server';
import { getTryOnSettings } from '@/lib/try-on/settings';
import { getShopEntitlement } from '@/lib/try-on/entitlement';
import { isTryOnLocale, DEFAULT_TRYON_LOCALE, type TryOnLocale } from '@/lib/try-on/i18n';
import { pickMerchantCopy } from '@/lib/try-on/merchant-copy';
import { normalizeShopDomain } from '@/lib/shopify/shop-authorization';

/* Shopify App Proxy target: storefront calls /apps/grindctrl/config and
   Shopify forwards here, appending ?shop=<domain>&signature=... .
   Same-origin on the shop side, so no CORS needed.
   ponytail: no HMAC check while this serves only public styling config;
   verify `signature` with the app secret before serving anything sensitive.

   This endpoint is unauthenticated and reachable by anyone, and each
   uncached call costs ~6 Supabase queries (settings + entitlement
   reconciliation). The short-lived response cache below keeps a scripted
   flood from multiplying into database load while still letting merchants
   see styling edits within a minute. */
const CACHE_TTL_MS = 60_000;
const CACHE_MAX_ENTRIES = 200;
const responseCache = new Map<string, { expires: number; body: Record<string, unknown> }>();

function cachedConfig(key: string): Record<string, unknown> | null {
  const hit = responseCache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expires) {
    responseCache.delete(key);
    return null;
  }
  // Refresh insertion order so the map itself acts as an LRU eviction queue.
  responseCache.delete(key);
  responseCache.set(key, hit);
  return hit.body;
}

function storeConfig(key: string, body: Record<string, unknown>): void {
  while (responseCache.size >= CACHE_MAX_ENTRIES) {
    const oldest = responseCache.keys().next().value;
    if (oldest === undefined) break;
    responseCache.delete(oldest);
  }
  responseCache.set(key, { expires: Date.now() + CACHE_TTL_MS, body });
}

export async function GET(request: NextRequest) {
  /* Only well-formed myshopify domains may name a settings row; anything
     else resolves to the shared defaults without touching a per-shop key. */
  const rawShop = request.nextUrl.searchParams.get('shop');
  const shop = rawShop ? normalizeShopDomain(rawShop) : null;

  const requested = request.nextUrl.searchParams.get('locale');
  const locale: TryOnLocale = isTryOnLocale(requested) ? requested : DEFAULT_TRYON_LOCALE;

  const cacheKey = `${shop ?? 'default'}:${locale}`;
  const cached = cachedConfig(cacheKey);
  if (cached) {
    return NextResponse.json(cached, { headers: { 'Cache-Control': 'private, no-store' } });
  }

  const settings = await getTryOnSettings(shop);

  /* The storefront has always sent ?locale, but this route ignored it, so
     every shopper got the merchant's strings in one language regardless of
     the store's language. */
  const copy = pickMerchantCopy(settings, locale);
  let available = false;
  try {
    available = (await getShopEntitlement(shop)).available;
  } catch {
    available = false;
  }

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
    available,
    messageKey: available ? null : 'tryOnTemporarilyUnavailable',
  };
  storeConfig(cacheKey, body);

  return NextResponse.json(body, { headers: { 'Cache-Control': 'private, no-store' } });
}
