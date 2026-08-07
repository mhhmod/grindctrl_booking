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
import { TryOnSettingsPanel } from '@/components/dashboard/tryon-settings-panel';
import { getRequestLocale } from '@/lib/auth/locale';
import { getTryOnDashboardCopy, statusLabel } from '@/lib/try-on/dashboard-copy';
import { ShopPlanControl } from '@/components/dashboard/shop-plan-control';
import { getShopPlanState, listPlansCatalog } from './plan-actions';

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

  /* Arabic month and day names, but Latin digits: a column of dates is read
     by comparing it down the page, and Arabic-Indic digits make that harder.
     Dropping -u-nu-latn switches them back. */
  const dateLocale = pageLocale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US';

  const shops = await listManagedTryOnShops();

  /* Only a shop we already know about may be selected; anything else falls
     back to the global defaults row. The save action re-checks server-side. */
  const requested = normalizeShopDomain(params.shop);
  const selectedShop =
    requested && shops.some((shop) => shop.domain === requested) ? requested : 'default';

  const [jobs, settings, catalog, planState] = await Promise.all([
    listRecentTryOnJobs(25),
    getTryOnSettings(selectedShop),
    listPlansCatalog(),
    getShopPlanState(selectedShop),
  ]);

  const completed = jobs.filter((j) => j.status === 'completed');
  const totalCost = jobs.reduce((sum, j) => sum + (j.cost_usd ?? 0), 0);
  const avgSeconds = completed.length
    ? completed.reduce((sum, j) => sum + (j.duration_ms ?? 0), 0) / completed.length / 1000
    : 0;
  const installed = shops.filter((shop) => shop.status === 'installed');

  const kpis = [
    { label: c.installedShops, value: String(installed.length) },
    { label: c.recentGenerations, value: String(jobs.length) },
    {
      label: c.avgGenerationTime,
      value: completed.length ? `${avgSeconds.toFixed(1)}s` : c.noDataYet,
    },
    { label: c.providerSpend, value: `$${totalCost.toFixed(2)}` },
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

      <Card>
        <CardHeader>
          <CardTitle>{c.planAndCredits}</CardTitle>
          <CardDescription>{c.planAndCreditsBody}</CardDescription>
        </CardHeader>
        <CardContent>
          <ShopPlanControl
            shop={selectedShop}
            state={planState}
            plans={catalog.plans}
            packs={catalog.packs}
          />
        </CardContent>
      </Card>

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
                      ${(job.cost_usd ?? 0).toFixed(4)}
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      {job.duration_ms ? `${(job.duration_ms / 1000).toFixed(1)}s` : c.noData}
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

      <Card>
        <CardHeader>
          <CardTitle>{c.shopifyApp}</CardTitle>
          <CardDescription>{c.shopifyAppBody}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" size="sm">
            <Link
              href="https://admin.shopify.com/store/grindctrl/apps/grindctrl-tryon"
              target="_blank"
            >
              {c.openShopifyApp}
            </Link>
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}
