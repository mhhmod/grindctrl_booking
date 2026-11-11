import 'server-only';

import type { configTiming } from '@/lib/storefront-config-cache';
import { cachedProxyConfig, proxyConfigCacheKey, storeProxyConfig } from '@/lib/shopify/proxy-config-cache';
import { storeFlags } from '@/lib/flags/store-flags';
import { flagStoreForTenant, siteTenantKey } from '@/lib/tenancy/tenant-key';
import { DEFAULT_TRYON_LOCALE, isTryOnLocale, type TryOnLocale } from '@/lib/try-on/i18n';
import { pickMerchantCopy } from '@/lib/try-on/merchant-copy';
import { getTryOnSettings, getTryOnSettingsForEdit } from '@/lib/try-on/settings';
import { readPublicPlacement } from '@/lib/try-on/placement-store';
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
  options?: { fresh?: boolean; timing?: ReturnType<typeof configTiming> },
): Promise<Record<string, unknown>> {
  const locale = siteConfigLocale(localeInput);
  const tenant = siteTenantKey(siteId);
  const cacheKey = proxyConfigCacheKey(tenant, locale);
  const cached = options?.fresh ? null : cachedProxyConfig(cacheKey);
  if (cached) return cached;

  const measure = options?.timing?.measure ?? (async <T,>(_phase: string, run: () => Promise<T>) => run());
  const [hasVerifiedDomain, settings, { launch, unsubscribed }, features, placement] = await Promise.all([
    verifiedSiteHosts(siteId).then((hosts) => hosts.length > 0).catch((error) => { if (options?.fresh) throw error; return false; }),
    measure('settings', () => options?.fresh ? getTryOnSettingsForEdit(tenant) : getTryOnSettings(tenant)),
    measure('plan', () => readSiteLaunch(siteId)),
    measure('flags', () => storeFlags(flagStoreForTenant(tenant) ?? { widgetSiteId: siteId }, Date.now(), { fresh: true, strict: true })),
    // Where the button goes (Pack B): { placement, spot? }, automatic when unread.
    readPublicPlacement(tenant),
  ]);
  if (options?.fresh && launch.reason === 'unavailable') throw new Error('site plan unavailable');
  const copy = pickMerchantCopy(settings, locale);
  const enabled = hasVerifiedDomain && (launch.tryOn === 'live' || unsubscribed);
  const reason = enabled ? null : hasVerifiedDomain ? launch.reason : 'no_verified_domain';

  const body: Record<string, unknown> = {
    enabled,
    reason,
    locale,
    ...placement,
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
  if (!options?.fresh && launch.reason !== 'unavailable') storeProxyConfig(cacheKey, body, enabled ? 20_000 : 5_000);
  return body;
}
