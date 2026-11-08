import 'server-only';

import { cachedProxyConfig, proxyConfigCacheKey, storeProxyConfig } from '@/lib/shopify/proxy-config-cache';
import { storeFlags } from '@/lib/flags/store-flags';
import { flagStoreForTenant, siteTenantKey } from '@/lib/tenancy/tenant-key';
import { DEFAULT_TRYON_LOCALE, isTryOnLocale, type TryOnLocale } from '@/lib/try-on/i18n';
import { pickMerchantCopy } from '@/lib/try-on/merchant-copy';
import { getTryOnSettings } from '@/lib/try-on/settings';
import { cardPillsOn } from '@/lib/try-on/card-pill';
import { verifiedSiteHosts } from './garment-url';
import { readSiteLaunch } from './tryon-site';

/* The Try-On styling and availability a WooCommerce or WordPress storefront
   reads. Same fields as the Shopify App Proxy config, keyed by the site
   tenant, with `enabled` as the one answer the plugin and the script use.

   A site with a verified domain and no plan yet counts as enabled: its free
   plan is granted when the first shopper starts a look, so hiding the button
   until a plan exists would mean it never could. */

export function siteConfigLocale(value: unknown): TryOnLocale {
  return isTryOnLocale(value) ? value : DEFAULT_TRYON_LOCALE;
}

export async function buildSiteTryOnConfig(
  siteId: string,
  localeInput: unknown,
): Promise<Record<string, unknown>> {
  const locale = siteConfigLocale(localeInput);
  const tenant = siteTenantKey(siteId);
  const cacheKey = proxyConfigCacheKey(tenant, locale);
  const cached = cachedProxyConfig(cacheKey);
  if (cached) return cached;

  let hasVerifiedDomain = false;
  try {
    hasVerifiedDomain = (await verifiedSiteHosts(siteId)).length > 0;
  } catch {
    hasVerifiedDomain = false;
  }
  const [settings, { launch, unsubscribed }, features] = await Promise.all([
    getTryOnSettings(tenant),
    readSiteLaunch(siteId),
    storeFlags(flagStoreForTenant(tenant) ?? { widgetSiteId: siteId }),
  ]);
  const copy = pickMerchantCopy(settings, locale);
  const enabled = hasVerifiedDomain && (launch.tryOn === 'live' || unsubscribed);
  const reason = enabled ? null : hasVerifiedDomain ? launch.reason : 'no_verified_domain';

  const body: Record<string, unknown> = {
    enabled,
    reason,
    locale,
    buttonLabel: copy.buttonLabel,
    accentBg: settings.accentBg,
    accentFg: settings.accentFg,
    radiusPx: settings.radiusPx,
    widgetTheme: settings.widgetTheme,
    iconBgFrom: settings.iconBgFrom,
    iconBgTo: settings.iconBgTo,
    buttonIconPx: settings.buttonIconPx,
    catalogLabel: copy.catalogLabel,
    catalogIconPx: settings.catalogIconPx,
    catalogFontPx: settings.catalogFontPx,
    catalogPadPx: settings.catalogPadPx,
    // Product card pills (the WooCommerce plugin's catalog cards, pasted code).
    showCardPill: cardPillsOn(settings),
    features,
  };
  // A failed read is not cached: the next request retries.
  if (launch.reason !== 'unavailable') storeProxyConfig(cacheKey, body);
  return body;
}
