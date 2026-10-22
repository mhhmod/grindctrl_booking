import React from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { listRecentTryOnJobs } from '@/lib/try-on/persistence';
import { getTryOnSettings } from '@/lib/try-on/settings';
import { getActiveStore, listDashboardShops } from '@/lib/dashboard/active-store-server';
import { normalizeShopDomain } from '@/lib/shopify/shop-authorization';
import { isTryOnPlatformOperator } from '@/lib/shopify/platform-operator';
import { SHOPIFY_APP_CLIENT_ID } from '@/lib/shopify/app-identity';
import { TryOnSettingsPanel } from '@/components/dashboard/tryon-settings-panel';
import { getRequestLocale } from '@/lib/auth/locale';
import { getDateLocale, getTryOnDashboardCopy, statusLabel } from '@/lib/try-on/dashboard-copy';
import { ShopPlanControl } from '@/components/dashboard/shop-plan-control';
import { ConnectShopPanel } from '@/components/dashboard/connect-shop-panel';
import { getShopPlanState, listPlansCatalog } from './plan-actions';
import { StoreFlagsCard } from '@/components/dashboard/store-flags-card';
import { storeFlagRows, storeFlags } from '@/lib/flags/store-flags';
import { LaunchCard } from '@/components/dashboard/launch-card';
import { getStoreLaunch } from '@/lib/launch/store-launch';
import { launchView } from '@/lib/launch/audience';
import { roleCan } from '@/lib/rbac/dashboard-policy';
import { getShopEntitlement } from '@/lib/try-on/entitlement';
import { getTryOnResultsFacts } from '@/lib/dashboard/tryon-insights-data';
import { buildTryOnResultsView, parsePeriod, type TryOnResultsView } from '@/lib/dashboard/tryon-insights-model';
import { getTryOnResultsCopy } from '@/lib/dashboard/tryon-insights-copy';
import { getTodayCopy } from '@/lib/dashboard/today-copy';
import { V16TryOnFrame, V16TryOnResults, V16TryOnResultsError } from '@/components/dashboard/v16/try-on/v16-tryon';

function statusTone(status: string) {
  if (status === 'completed') return 'secondary' as const;
  return 'destructive' as const;
}

/* The Try-On page, drawn by both of its routes: /dashboard/try-on
   (Results under v16, today's page otherwise) and /dashboard/try-on/setup
   (Set up, which is today's page under the v16 tabs). */
export async function TryOnPage({
  params,
  tab,
}: {
  params: { shop?: string; period?: string };
  tab: 'results' | 'setup';
}) {
  const pageLocale = await getRequestLocale();
  const c = getTryOnDashboardCopy(pageLocale);
  const dateLocale = getDateLocale(pageLocale);

  const [shops, canManagePlan] = await Promise.all([listDashboardShops(), isTryOnPlatformOperator()]);
  const activeStore = await getActiveStore({ shop: params.shop }, { shops });
  const hasShops = shops.length > 0;
  const shopDomains = shops.map((shop) => shop.domain);

  /* The dashboard's active store (phase zero item 33): only a shop we
     already know about may be selected, from the link, then the one chosen
     last, then the most recently active installed shop. An active Store
     Chat site on another website has no shop here, so the page falls back
     to the merchant's own first shop. The global defaults row is never an
     edit target here: the save action refuses it, so opening on it made a
     merchant's first save fail and hid their plan. 'default' remains only
     for a caller with no shop, whose cards are not rendered. The save
     action re-checks server-side. */
  const ownShop = shops.find((shop) => shop.status === 'installed') ?? shops[0];
  const selectedShop = activeStore.shopDomain ?? ownShop?.domain ?? 'default';

  /* The v16 Try-On (04-dashboard.md) for an active shop whose v16_dashboard
     flag is on: Results from the shop's own looks, and Set up, which is
     the page below until TryOnStudio lands. */
  const v16Shop =
    activeStore.shopDomain && (await storeFlags({ shopDomain: activeStore.shopDomain })).includes('v16_dashboard')
      ? activeStore.shopDomain
      : null;
  if (v16Shop && tab === 'results') {
    let view: TryOnResultsView | null = null;
    try {
      const facts = await getTryOnResultsFacts({ shop: v16Shop, period: parsePeriod(params.period) });
      view = buildTryOnResultsView(facts, getTryOnResultsCopy(pageLocale), getTodayCopy(pageLocale), pageLocale);
    } catch (error) {
      console.error('[try-on results] failed:', error instanceof Error ? error.message : error);
    }
    return view ? <V16TryOnResults view={view} locale={pageLocale} /> : <V16TryOnResultsError locale={pageLocale} />;
  }

  // A presentation link is never a reason to accept a query-string tenant.
  // The public client ID is verified in shopify.app.toml/app-identity.ts;
  // Shopify's embedded-app URL supports /apps/{clientId}, no guessed handle.
  const appShop = selectedShop !== 'default' ? selectedShop
    : shops.length === 1 ? normalizeShopDomain(shops[0].domain) : null;
  const shopifyAppUrl = appShop
    ? ['https://admin.shopify.com/store', appShop.split('.')[0], 'apps', SHOPIFY_APP_CLIENT_ID].join('/')
    : null;

  /* The caller's role on the selected shop (item 12): only its owner sees
     the plan, and only the owner or an admin sets the shop up. The actions
     behind these cards check the same role again on the server. */
  const selectedRole = shops.find((shop) => shop.domain === selectedShop)?.role ?? null;
  const canSeeBilling = roleCan(selectedRole, 'billing');
  const canSetUp = roleCan(selectedRole, 'settings');

  const jobs = await listRecentTryOnJobs(shopDomains, 25);
  /* The global defaults row ('default') is shared, public-demo config -- a
     caller with no linked shop has nothing of their own to configure, so
     these calls (and the cards that render them) are skipped entirely
     rather than exposing that shared row to every new sign-up. */
  const [settings, catalog, planState] = hasShops
    ? await Promise.all([
        canSetUp ? getTryOnSettings(selectedShop) : null,
        canSeeBilling ? listPlansCatalog(selectedShop) : null,
        canSeeBilling ? getShopPlanState(selectedShop) : null,
      ])
    : [null, null, null];

  // Only the platform operator sees, or may change, a shop's v16 flags.
  const flagRows =
    canManagePlan && selectedShop !== 'default' ? await storeFlagRows({ shopDomain: selectedShop }) : null;
  /* Try it yourself and Go live (phase zero item 9), for the owner of the
     selected shop while its n5_preview_mode flag is on. */
  const [shopFeatures, storeLaunch] =
    hasShops && selectedShop !== 'default'
      ? await Promise.all([storeFlags({ shopDomain: selectedShop }), getStoreLaunch(selectedShop)])
      : [[], null];
  const launch = launchView(storeLaunch, new Date());

  const completed = jobs.filter((j) => j.status === 'completed');
  const avgSeconds = completed.length
    ? completed.reduce((sum, j) => sum + (j.duration_ms ?? 0), 0) / completed.length / 1000
    : 0;
  const installed = shops.filter((shop) => shop.status === 'installed');

  const kpis = [
    { label: c.installedShops, value: String(installed.length) },
    { label: c.recentGenerations, value: String(jobs.length) },
    {
      label: c.avgGenerationTime,
      value: completed.length ? `${avgSeconds.toFixed(1)}${c.secondsSuffix}` : c.noDataYet,
    },
  ];

  const body = (
    <section className="grid min-w-0 gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="pb-2">
              <CardDescription>{kpi.label}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-semibold text-foreground">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{c.merchantShops}</CardTitle>
          <CardDescription>{c.merchantShopsBody}</CardDescription>
        </CardHeader>
        <CardContent>
          {shops.length === 0 ? (
            <div className="grid gap-4">
              <p className="text-sm text-muted-foreground">{c.noShopsYet}</p>
              <ConnectShopPanel locale={pageLocale} />
            </div>
          ) : (
            <div className="grid gap-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{c.columnShop}</TableHead>
                    <TableHead>{c.columnStatus}</TableHead>
                    <TableHead className="text-end">{c.columnGenerations}</TableHead>
                    <TableHead>{c.columnLastGeneration}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shops.map((shop) => (
                    <TableRow key={shop.domain}>
                      <TableCell className="font-medium">{shop.domain}</TableCell>
                      <TableCell>
                        <Badge variant={shop.status === 'installed' ? 'secondary' : 'destructive'}>
                          {statusLabel(c, shop.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-end tabular-nums">{shop.jobCount}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {shop.lastJobAt
                          ? new Date(shop.lastJobAt).toLocaleString(dateLocale)
                          : c.noneYet}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <ConnectShopPanel locale={pageLocale} hasShops />
            </div>
          )}
        </CardContent>
      </Card>

      {hasShops && canSetUp && selectedShop !== 'default' && shopFeatures.includes('n5_preview_mode') && (
        <LaunchCard
          locale={pageLocale === 'ar' ? 'ar' : 'en'}
          shop={selectedShop}
          launch={launch}
          holdoutAvailable={shopFeatures.includes('n6_holdout')}
        />
      )}

      {hasShops && catalog && planState && (
        <Card>
          <CardHeader>
            <CardTitle>{c.planAndCredits}</CardTitle>
            <CardDescription>{canManagePlan ? c.planAndCreditsOperatorBody : c.planAndCreditsBody}</CardDescription>
          </CardHeader>
          <CardContent>
            <ShopPlanControl
              locale={pageLocale}
              canManagePlan={canManagePlan}
              shop={selectedShop}
              state={planState}
              plans={catalog.plans}
              packs={catalog.packs}
            />
          </CardContent>
        </Card>
      )}

      {flagRows && (
        <StoreFlagsCard
          kind="shop"
          storeKey={selectedShop}
          storeLabel={selectedShop}
          rows={flagRows}
          launchState={launch.state}
        />
      )}

      {hasShops && settings && (
        <Card>
          <CardHeader>
            <CardTitle>{c.appearance}</CardTitle>
            <CardDescription>{c.appearanceBody}</CardDescription>
          </CardHeader>
          <CardContent>
            <TryOnSettingsPanel
              locale={pageLocale}
              shops={shops.map((shop) => ({
                domain: shop.domain,
                status: shop.status,
                jobCount: shop.jobCount,
              }))}
              selectedShop={selectedShop}
              settings={settings}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{c.recentGenerations}</CardTitle>
          <CardDescription>{c.recentGenerationsBody}</CardDescription>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">{c.noGenerationsYet}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{c.columnProduct}</TableHead>
                  <TableHead>{c.columnShop}</TableHead>
                  <TableHead>{c.columnStatus}</TableHead>
                  <TableHead className="text-end">{c.columnTime}</TableHead>
                  <TableHead>{c.columnWhen}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="font-medium">{job.product_id}</TableCell>
                    <TableCell className="text-muted-foreground">{job.shop ?? c.demoShop}</TableCell>
                    <TableCell>
                      <Badge variant={statusTone(job.status)}>{statusLabel(c, job.status)}</Badge>
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      {job.duration_ms
                        ? `${(job.duration_ms / 1000).toFixed(1)}${c.secondsSuffix}`
                        : c.noData}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(job.created_at).toLocaleString(dateLocale)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {hasShops && (
        <Card>
          <CardHeader>
            <CardTitle>{c.shopifyApp}</CardTitle>
            <CardDescription>{c.shopifyAppBody}</CardDescription>
          </CardHeader>
          <CardContent>
            {shopifyAppUrl ? <Button asChild variant="outline" size="sm">
              <Link
                href={shopifyAppUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {c.openShopifyApp}
              </Link>
            </Button> : <p className="text-sm text-muted-foreground">{c.chooseShopForApp}</p>}
          </CardContent>
        </Card>
      )}
    </section>
  );

  if (!v16Shop) return body;
  const entitlement = await getShopEntitlement(v16Shop).catch(() => null);
  const copy = getTryOnResultsCopy(pageLocale);
  return (
    <V16TryOnFrame
      locale={pageLocale}
      tab="setup"
      status={entitlement ? { live: entitlement.available, label: entitlement.available ? copy.liveOnStore : copy.hiddenOnStore } : null}
    >
      {body}
    </V16TryOnFrame>
  );
}
