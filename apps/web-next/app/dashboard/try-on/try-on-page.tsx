import React from 'react';
import { redirect } from 'next/navigation';
import { getTryOnSettingsForEdit } from '@/lib/try-on/settings';
import { getActiveStore, getActiveStoreRole, getPendingPasteShop, listDashboardShops } from '@/lib/dashboard/active-store-server';
import { activeTenantKey } from '@/lib/dashboard/active-store';
import { wpAdminUrls } from '@/lib/dashboard/tryon-studio-model';
import { getActiveWooSiteContext } from '@/lib/woo/connection';
import { shopChoices } from '@/lib/dashboard/shell-model';
import { isTryOnPlatformOperator } from '@/lib/shopify/platform-operator';
import { getRequestLocale } from '@/lib/auth/locale';
import { LaunchCard } from '@/components/dashboard/launch-card';
import { flagStoreForTenant, storeFlags } from '@/lib/flags/store-flags';
import { getStoreLaunch } from '@/lib/launch/store-launch';
import { launchView } from '@/lib/launch/audience';
import { roleCan } from '@/lib/rbac/dashboard-policy';
import { getShopEntitlement } from '@/lib/try-on/entitlement';
import { getTryOnResultsFacts } from '@/lib/dashboard/tryon-insights-data';
import { buildTryOnResultsView, parsePeriod, type TryOnResultsView } from '@/lib/dashboard/tryon-insights-model';
import { getTryOnResultsCopy } from '@/lib/dashboard/tryon-insights-copy';
import { getTodayCopy } from '@/lib/dashboard/today-copy';
import { V16TryOnFrame, V16TryOnResults, V16TryOnResultsError } from '@/components/dashboard/v16/try-on/v16-tryon';
import { V16TryOnStudio, V16TryOnStudioError } from '@/components/dashboard/v16/try-on/v16-tryon-studio';
import { V16TryOnApp } from '@/components/dashboard/v16/try-on/v16-tryon-app';
import { V16FinishConfirming, V16NeedsStore } from '@/components/dashboard/v16/states';
import { tryOnButtonStatus } from '@/lib/dashboard/tryon-button-status';
import { readPasteCodeOutdated } from '@/lib/paste/status';
import { isActiveTenant } from '@/lib/shopify/tokens';
import { isSiteTenantKey } from '@/lib/tenancy/tenant-key';
import { saveTryOnSettingsAction, setTryOnButtonAction, setTryOnCardPillAction } from './actions';
import { createPickLinkAction, readPlacementAction, setPlacementAction } from './placement-actions';

const PLACEMENT_ACTIONS = { read: readPlacementAction, set: setPlacementAction, open: createPickLinkAction };

/* The Try-On page (04-dashboard.md), drawn by both of its routes:
   /dashboard/try-on is Results and /dashboard/try-on/setup is Set up
   (TryOnStudio). Try-On belongs to a Shopify store or a paired WooCommerce
   store (its tenant), so a Store Chat site with neither, or a new account,
   is told to connect one. */
export async function TryOnPage({
  params,
  tab,
}: {
  params: { shop?: string; period?: string };
  tab: 'results' | 'setup';
}) {
  const locale = await getRequestLocale();
  const [shops, canManagePlan] = await Promise.all([
    listDashboardShops().catch(() => []),
    isTryOnPlatformOperator(),
  ]);
  const activeStore = await getActiveStore({ shop: params.shop }, { shops });
  /* The tenant Try-On, plans and launch state are kept under: the shop
     domain, or `site:<id>` for a WooCommerce store. It is passed on as
     `shop` wherever a component or action only needs to name the store. */
  const shop = activeTenantKey(activeStore);
  if (!shop) {
    const pending = await getPendingPasteShop(activeStore);
    return pending ? <V16FinishConfirming locale={locale} shop={pending} />
      : <V16NeedsStore locale={locale} feature="tryOn" shops={shopChoices(shops)} />;
  }
  const isWoo = activeStore.platform === 'woocommerce';

  // Set up is for owners and admins (item 12); a member's Try-On is Results.
  const canSetUp = roleCan(await getActiveStoreRole(activeStore), 'settings');

  if (tab === 'setup') {
    // The save action checks the role again.
    if (!canSetUp) redirect('/dashboard/try-on');
    const [settings, storeLaunch, entitlement, activeFlags, installed, codeOutdated] = await Promise.all([
      getTryOnSettingsForEdit(shop).catch((error: unknown) => {
        console.error('[try-on set up] settings failed:', error instanceof Error ? error.message : error);
        return null;
      }),
      getStoreLaunch(shop),
      getShopEntitlement(shop).catch(() => null),
      storeFlags(flagStoreForTenant(shop)),
      // A paired WooCommerce or trusted pasted-code site, or an installed Shopify app.
      isSiteTenantKey(shop)
        ? isActiveTenant(shop)
        : shops.some((candidate) => candidate.domain === shop && candidate.status === 'installed'),
      // Only pasted code has a code version; never fails the page.
      activeStore.platform === 'paste' && activeStore.siteId ? readPasteCodeOutdated(activeStore.siteId) : false,
    ]);
    const wpAdmin = isWoo && activeStore.siteId
      ? wpAdminUrls((await getActiveWooSiteContext(activeStore.siteId).catch(() => null))?.homeUrl ?? '')
      : null;
    const launch = launchView(storeLaunch, new Date());
    const copy = getTryOnResultsCopy(locale);
    // The storefront button switch and the header status it feeds; null when the settings could not be read.
    const buttonStatus = settings
      ? tryOnButtonStatus({
          installed,
          showButton: settings.showButton,
          entitlement,
          launchState: activeFlags.includes('n5_preview_mode') ? launch.state : 'live',
          codeOutdated,
        })
      : null;
    const live = Boolean(entitlement?.available) && (settings?.showButton ?? true);
    return (
      <V16TryOnFrame
        locale={locale}
        tab="setup"
        status={entitlement ? { live, label: live ? copy.liveOnStore : copy.hiddenOnStore } : null}
      >
        {settings ? (
          <V16TryOnStudio
            locale={locale}
            shop={shop}
            wpAdmin={wpAdmin}
            settings={settings}
            saveSettings={saveTryOnSettingsAction}
            buttonStatus={buttonStatus}
            setButton={setTryOnButtonAction}
            cardPill={settings.showCardPill}
            setCardPill={setTryOnCardPillAction}
            // The Shopify app block is placed in the theme editor; pasted code and Woo pick here.
            placementActions={installed && isSiteTenantKey(shop) ? PLACEMENT_ACTIONS : undefined}
          />
        ) : (
          <V16TryOnStudioError locale={locale} />
        )}
        {/* Try it yourself and Go live (phase zero item 9), while n5_preview_mode is on. */}
        {activeFlags.includes('n5_preview_mode') && (
          <LaunchCard locale={locale === 'ar' ? 'ar' : 'en'} shop={shop} launch={launch} holdoutAvailable={activeFlags.includes('n6_holdout')} />
        )}
        {/* Not on the board: the Shopify app, and connecting another store. */}
        {activeStore.platform === 'shopify' && <V16TryOnApp locale={locale} shop={shop} />}
      </V16TryOnFrame>
    );
  }

  let view: TryOnResultsView | null = null;
  try {
    const facts = await getTryOnResultsFacts({ shop, period: parsePeriod(params.period) });
    view = buildTryOnResultsView(facts, getTryOnResultsCopy(locale), getTodayCopy(locale), locale);
  } catch (error) {
    console.error('[try-on results] failed:', error instanceof Error ? error.message : error);
  }
  return view ? (
    <V16TryOnResults view={view} locale={locale} canSetUp={canSetUp} />
  ) : (
    <V16TryOnResultsError locale={locale} canSetUp={canSetUp} />
  );
}
