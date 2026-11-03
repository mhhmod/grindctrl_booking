import React from 'react';
import { redirect } from 'next/navigation';
import { getTryOnSettingsForEdit } from '@/lib/try-on/settings';
import { getActiveStore, listDashboardShops } from '@/lib/dashboard/active-store-server';
import { shopChoices } from '@/lib/dashboard/shell-model';
import { isTryOnPlatformOperator } from '@/lib/shopify/platform-operator';
import { getRequestLocale } from '@/lib/auth/locale';
import { LaunchCard } from '@/components/dashboard/launch-card';
import { StoreFlagsCard } from '@/components/dashboard/store-flags-card';
import { storeFlagRows, storeFlags } from '@/lib/flags/store-flags';
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
import { V16NeedsShopify } from '@/components/dashboard/v16/states';
import { saveTryOnSettingsAction } from './actions';

/* The Try-On page (04-dashboard.md), drawn by both of its routes:
   /dashboard/try-on is Results and /dashboard/try-on/setup is Set up
   (TryOnStudio). Try-On belongs to a Shopify store, so a Store Chat site on
   another website, or a new account, is told to connect one. */
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
  const shop = activeStore.shopDomain;
  if (!shop) return <V16NeedsShopify locale={locale} feature="tryOn" shops={shopChoices(shops)} />;

  // Set up is for owners and admins (item 12); a member's Try-On is Results.
  const canSetUp = roleCan(shops.find((candidate) => candidate.domain === shop)?.role ?? null, 'settings');

  if (tab === 'setup') {
    // The save action checks the role again.
    if (!canSetUp) redirect('/dashboard/try-on');
    const [settings, storeLaunch, flagRows, entitlement, activeFlags] = await Promise.all([
      getTryOnSettingsForEdit(shop).catch((error: unknown) => {
        console.error('[try-on set up] settings failed:', error instanceof Error ? error.message : error);
        return null;
      }),
      getStoreLaunch(shop),
      canManagePlan ? storeFlagRows({ shopDomain: shop }) : null,
      getShopEntitlement(shop).catch(() => null),
      storeFlags({ shopDomain: shop }),
    ]);
    const launch = launchView(storeLaunch, new Date());
    const copy = getTryOnResultsCopy(locale);
    return (
      <V16TryOnFrame
        locale={locale}
        tab="setup"
        status={entitlement ? { live: entitlement.available, label: entitlement.available ? copy.liveOnStore : copy.hiddenOnStore } : null}
      >
        {settings ? (
          <V16TryOnStudio locale={locale} shop={shop} settings={settings} saveSettings={saveTryOnSettingsAction} />
        ) : (
          <V16TryOnStudioError locale={locale} />
        )}
        {/* Try it yourself and Go live (phase zero item 9), while n5_preview_mode is on. */}
        {activeFlags.includes('n5_preview_mode') && (
          <LaunchCard locale={locale === 'ar' ? 'ar' : 'en'} shop={shop} launch={launch} holdoutAvailable={activeFlags.includes('n6_holdout')} />
        )}
        {flagRows && <StoreFlagsCard kind="shop" storeKey={shop} storeLabel={shop} rows={flagRows} launchState={launch.state} />}
        {/* Not on the board: the Shopify app, and connecting another store. */}
        <V16TryOnApp locale={locale} shop={shop} />
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
