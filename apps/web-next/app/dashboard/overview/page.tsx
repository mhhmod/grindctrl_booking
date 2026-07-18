import React from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getTryOnOverview } from '@/lib/dashboard/overview-data';

export const dynamic = 'force-dynamic';

/* Week-over-week movement, spoken plainly instead of a bare percentage. */
function trend(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? 'new this week' : 'quiet';
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return 'level with last week';
  return pct > 0 ? `up ${pct}% on last week` : `down ${Math.abs(pct)}% on last week`;
}

function formatDay(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export default async function DashboardOverviewPage() {
  const overview = await getTryOnOverview();
  const { totals, byShop, dailySeries, recentFailures } = overview;

  const maxDailyJobs = Math.max(1, ...dailySeries.map((d) => d.jobs));
  const successRate =
    totals.jobsLast7d > 0 ? Math.round((totals.completedLast7d / totals.jobsLast7d) * 100) : null;

  return (
    <section className="grid min-w-0 gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
          <p className="text-sm text-muted-foreground">
            The try-on business this week, across every merchant store.
          </p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href="/dashboard/try-on">Manage try-on</Link>
        </Button>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Generations, 7 days</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-1">
            <p className="text-xl font-semibold text-foreground">{totals.jobsLast7d}</p>
            <p className="text-xs text-muted-foreground">
              {trend(totals.jobsLast7d, totals.jobsPrev7d)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Provider spend, 7 days</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-1">
            <p className="text-xl font-semibold text-foreground">
              ${totals.spendLast7dUsd.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground">
              {trend(totals.spendLast7dUsd, totals.spendPrev7dUsd)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Success rate, 7 days</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-1">
            <p className="text-xl font-semibold text-foreground">
              {successRate === null ? 'No jobs yet' : `${successRate}%`}
            </p>
            <p className="text-xs text-muted-foreground">
              {totals.failedLast7d > 0 ? `${totals.failedLast7d} failed` : 'no failures'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Installed shops</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-1">
            <p className="text-xl font-semibold text-foreground">{totals.installedShops}</p>
            <p className="text-xs text-muted-foreground">
              {totals.avgDurationMsLast7d
                ? `avg render ${(totals.avgDurationMsLast7d / 1000).toFixed(1)}s`
                : 'no renders this week'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Last 14 days</CardTitle>
          <CardDescription>Generations per day, all shops and the public demo.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Fixed-height columns so a quiet fortnight still reads as a timeline */}
          <div
            className="flex h-28 items-end gap-1.5"
            role="img"
            aria-label="Generations per day, last 14 days"
          >
            {dailySeries.map((d) => (
              <div key={d.day} className="group relative flex h-full flex-1 flex-col justify-end">
                <div
                  className="rounded-t bg-foreground/70 transition-colors group-hover:bg-foreground"
                  style={{ height: `${Math.max(4, (d.jobs / maxDailyJobs) * 100)}%` }}
                />
                <span className="pointer-events-none absolute -top-6 start-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-1.5 py-0.5 text-[10px] text-background group-hover:block rtl:translate-x-1/2">
                  {d.jobs} · ${d.spendUsd.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
            <span>{formatDay(dailySeries[0]?.day ?? '')}</span>
            <span>{formatDay(dailySeries[dailySeries.length - 1]?.day ?? '')}</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Shops this week</CardTitle>
            <CardDescription>Who is generating, and what it costs.</CardDescription>
          </CardHeader>
          <CardContent>
            {byShop.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No merchant shops yet. Install the app on a store and it appears here.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Shop</TableHead>
                    <TableHead className="text-end">Jobs 7d</TableHead>
                    <TableHead className="text-end">Spend 7d</TableHead>
                    <TableHead>Last activity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byShop.map((shop) => (
                    <TableRow key={shop.domain}>
                      <TableCell className="font-medium">
                        <span className="inline-flex items-center gap-2">
                          {shop.domain}
                          {shop.status === 'uninstalled' && (
                            <Badge variant="destructive">uninstalled</Badge>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="text-end tabular-nums">{shop.jobsLast7d}</TableCell>
                      <TableCell className="text-end tabular-nums">
                        ${shop.spendLast7dUsd.toFixed(2)}
                      </TableCell>
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

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Recent failures</CardTitle>
            <CardDescription>The last five failed generations, newest first.</CardDescription>
          </CardHeader>
          <CardContent>
            {recentFailures.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing failed recently. When a generation fails, the reason lands here.
              </p>
            ) : (
              <ul className="grid gap-3">
                {recentFailures.map((failure) => (
                  <li key={failure.id} className="grid gap-0.5 text-sm">
                    <span className="font-medium">
                      {failure.productId}
                      <span className="text-muted-foreground">
                        {' '}
                        · {failure.shop ?? 'demo'} · {new Date(failure.createdAt).toLocaleString()}
                      </span>
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {failure.message ?? 'No message recorded'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
