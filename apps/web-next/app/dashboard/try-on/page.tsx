import React from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { listRecentTryOnJobs } from '@/lib/try-on/persistence';
import { getTryOnSettings } from '@/lib/try-on/settings';
import { listManagedTryOnShops } from '@/lib/shopify/shops';
import { normalizeShopDomain } from '@/lib/shopify/shop-authorization';
import { isTryOnPlatformOperator } from '@/lib/shopify/platform-operator';
import { SHOPIFY_APP_CLIENT_ID } from '@/lib/shopify/app-identity';
import { TryOnSettingsPanel } from '@/components/dashboard/tryon-settings-panel';
import { getRequestLocale } from '@/lib/auth/locale';
import { getDateLocale, getTryOnDashboardCopy, statusLabel } from '@/lib/try-on/dashboard-copy';
import { ShopPlanControl } from '@/components/dashboard/shop-plan-control';
import { getShopPlanState, listPlansCatalog } from './plan-actions';
import { formatProviderCost, summarizeProviderCosts } from '@/lib/dashboard/provider-cost';

export const dynamic = 'force-dynamic';

function statusTone(status: string) {
  if (status === 'completed') return 'secondary' as const;
  return 'destructive' as const;
}

export default async function DashboardTryOnPage({
  searchParams,
}: {
  searchParams: Promise<{ shop?: string }>;
}) {
  const params = await searchParams;
  const pageLocale = await getRequestLocale();
  const c = getTryOnDashboardCopy(pageLocale);
  const dateLocale = getDateLocale(pageLocale);

  const [shops, canManagePlan] = await Promise.all([listManagedTryOnShops(), isTryOnPlatformOperator()]);
  const hasShops = shops.length > 0;
  const shopDomains = shops.map((shop) => shop.domain);

  /* Only a shop we already know about may be selected; anything else falls
     back to the global defaults row. The save action re-checks server-side. */
  const requested = normalizeShopDomain(params.shop);
  const selectedShop =
    requested && shops.some((shop) => shop.domain === requested) ? requested : 'default';

  // A presentation link is never a reason to accept a query-string tenant.
  // The public client ID is verified in shopify.app.toml/app-identity.ts;
  // Shopify's embedded-app URL supports /apps/{clientId}, no guessed handle.
  const appShop = selectedShop !== 'default' ? selectedShop
    : shops.length === 1 ? normalizeShopDomain(shops[0].domain) : null;
  const shopifyAppUrl = appShop
    ? ['https://admin.shopify.com/store', appShop.split('.')[0], 'apps', SHOPIFY_APP_CLIENT_ID].join('/')
    : null;

  const jobs = await listRecentTryOnJobs(shopDomains, 25);
  /* The global defaults row ('default') is shared, public-demo config -- a
     caller with no linked shop has nothing of their own to configure, so
     these calls (and the cards that render them) are skipped entirely
     rather than exposing that shared row to every new sign-up. */
  const [settings, catalog, planState] = hasShops
    ? await Promise.all([getTryOnSettings(selectedShop), listPlansCatalog(), getShopPlanState(selectedShop)])
    : [null, null, null];

  const completed = jobs.filter((j) => j.status === 'completed');
  const { knownSpendUsd, missingCostCount } = summarizeProviderCosts(jobs.map((job) => job.cost_usd));
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
    {
      label: c.providerSpend,
      value: formatProviderCost(knownSpendUsd, c.costUnreported),
      note: missingCostCount > 0 ? c.missingProviderCosts(missingCostCount) : undefined,
    },
  ];

  return (
    <section className="grid min-w-0 gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="pb-2">
              <CardDescription>{kpi.label}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-semibold text-foreground">{kpi.value}</p>
              {kpi.note && <p className="mt-1 text-xs text-muted-foreground">{kpi.note}</p>}
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
            <p className="text-sm text-muted-foreground">{c.noShopsYet}</p>
          ) : (
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
          )}
        </CardContent>
      </Card>

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
                  <TableHead className="text-end">{c.columnCost}</TableHead>
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
                      {formatProviderCost(job.cost_usd, c.costUnreported, 4)}
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
}
