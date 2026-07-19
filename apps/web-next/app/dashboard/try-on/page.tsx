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
    { label: 'Installed shops', value: String(installed.length) },
    { label: 'Recent generations', value: String(jobs.length) },
    {
      label: 'Avg generation time',
      value: completed.length ? `${avgSeconds.toFixed(1)}s` : 'No data yet',
    },
    { label: 'Provider spend (recent)', value: `$${totalCost.toFixed(2)}` },
  ];

  return (
    <section className="grid gap-6">
      <header className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Try-On</h1>
        <p className="text-sm text-muted-foreground">
          Every merchant surface reads the settings below. Generation history and provider
          spend are live.
        </p>
      </header>

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
          <CardTitle>Merchant shops</CardTitle>
          <CardDescription>
            A shop appears the first time its admin opens the app, and drops to uninstalled
            when Shopify tells us it was removed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {shops.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No shop has opened the app yet. Once a merchant opens it from their Shopify
              admin, they appear here and can be configured individually.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Shop</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-end">Generations</TableHead>
                  <TableHead>Last generation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shops.map((shop) => (
                  <TableRow key={shop.domain}>
                    <TableCell className="font-medium">{shop.domain}</TableCell>
                    <TableCell>
                      <Badge variant={shop.status === 'installed' ? 'secondary' : 'destructive'}>
                        {shop.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-end tabular-nums">{shop.jobCount}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {shop.lastJobAt ? new Date(shop.lastJobAt).toLocaleString() : 'None yet'}
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
          <CardTitle>Plan and credits</CardTitle>
          <CardDescription>
            Payment is collected outside the app, so activating here is what grants credits.
            Every action is recorded in the ledger with its payment reference.
          </CardDescription>
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
          <CardTitle>Appearance and journey</CardTitle>
          <CardDescription>
            The same controls the merchant sees in their Shopify admin, writing to the same
            record. Changes go live within a minute.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TryOnSettingsPanel
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
          <CardTitle>Recent generations</CardTitle>
          <CardDescription>The last 25 live jobs, newest first, with what each cost.</CardDescription>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No generations yet. Run a try-on from a storefront and it lands here with its
              cost and timing.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Shop</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-end">Cost</TableHead>
                  <TableHead className="text-end">Time</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="font-medium">{job.product_id}</TableCell>
                    <TableCell className="text-muted-foreground">{job.shop ?? 'Demo'}</TableCell>
                    <TableCell>
                      <Badge variant={statusTone(job.status)}>{job.status}</Badge>
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      ${(job.cost_usd ?? 0).toFixed(4)}
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      {job.duration_ms ? `${(job.duration_ms / 1000).toFixed(1)}s` : 'No data'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(job.created_at).toLocaleString()}
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
          <CardTitle>Shopify app</CardTitle>
          <CardDescription>
            Merchants install and configure from their own admin. This is what they open.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" size="sm">
            <Link
              href="https://admin.shopify.com/store/grindctrl/apps/grindctrl-tryon"
              target="_blank"
            >
              Open the Shopify app
            </Link>
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}
