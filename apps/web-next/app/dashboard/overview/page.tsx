import React from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getRequestLocale } from '@/lib/auth/locale';
import { getTryOnOverview } from '@/lib/dashboard/overview-data';
import { getOverviewCopy, type OverviewCopy } from '@/lib/dashboard/overview-copy';
import { getDateLocale } from '@/lib/try-on/dashboard-copy';

export const dynamic = 'force-dynamic';

/* Week-over-week movement, spoken plainly instead of a bare percentage. */
function trend(c: OverviewCopy, current: number, previous: number): string {
  if (previous === 0) return current > 0 ? c.trendNewThisWeek : c.trendQuiet;
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return c.trendLevel;
  return pct > 0 ? c.trendUp(pct) : c.trendDown(Math.abs(pct));
}

function formatDay(day: string, dateLocale: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString(dateLocale, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export default async function DashboardOverviewPage() {
  const [locale, overview] = await Promise.all([getRequestLocale(), getTryOnOverview()]);
  const c = getOverviewCopy(locale);
  const dateLocale = getDateLocale(locale);
  const { totals, byShop, dailySeries, recentFailures } = overview;

  const maxDailyJobs = Math.max(1, ...dailySeries.map((d) => d.jobs));
  const successRate =
    totals.jobsLast7d > 0 ? Math.round((totals.completedLast7d / totals.jobsLast7d) * 100) : null;

  return (
    <section className="grid min-w-0 gap-6">
      <div className="flex justify-end">
        <Button asChild size="sm" variant="outline">
          <Link href="/dashboard/try-on">{c.manageTryOn}</Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{c.generations7d}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-1">
            <p className="text-xl font-semibold text-foreground">{totals.jobsLast7d}</p>
            <p className="text-xs text-muted-foreground">
              {trend(c, totals.jobsLast7d, totals.jobsPrev7d)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{c.providerSpend7d}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-1">
            <p className="text-xl font-semibold text-foreground">
              ${totals.spendLast7dUsd.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground">
              {trend(c, totals.spendLast7dUsd, totals.spendPrev7dUsd)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{c.successRate7d}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-1">
            <p className="text-xl font-semibold text-foreground">
              {successRate === null ? c.noJobsYet : `${successRate}%`}
            </p>
            <p className="text-xs text-muted-foreground">
              {totals.failedLast7d > 0 ? c.failedCount(totals.failedLast7d) : c.noFailures}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{c.installedShopsCard}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-1">
            <p className="text-xl font-semibold text-foreground">{totals.installedShops}</p>
            <p className="text-xs text-muted-foreground">
              {totals.avgDurationMsLast7d
                ? c.avgRender((totals.avgDurationMsLast7d / 1000).toFixed(1))
                : c.noRendersThisWeek}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{c.last14Days}</CardTitle>
          <CardDescription>{c.last14DaysBody}</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Fixed-height columns so a quiet fortnight still reads as a timeline */}
          <div
            className="flex h-28 items-end gap-1.5"
            role="img"
            aria-label={c.dailyChartAriaLabel}
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
            <span>{formatDay(dailySeries[0]?.day ?? '', dateLocale)}</span>
            <span>{formatDay(dailySeries[dailySeries.length - 1]?.day ?? '', dateLocale)}</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>{c.shopsThisWeek}</CardTitle>
            <CardDescription>{c.shopsThisWeekBody}</CardDescription>
          </CardHeader>
          <CardContent>
            {byShop.length === 0 ? (
              <p className="text-sm text-muted-foreground">{c.noMerchantShopsYet}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{c.columnShop}</TableHead>
                    <TableHead className="text-end">{c.columnJobs7d}</TableHead>
                    <TableHead className="text-end">{c.columnSpend7d}</TableHead>
                    <TableHead>{c.columnLastActivity}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byShop.map((shop) => (
                    <TableRow key={shop.domain}>
                      <TableCell className="font-medium">
                        <span className="inline-flex items-center gap-2">
                          {shop.domain}
                          {shop.status === 'uninstalled' && (
                            <Badge variant="destructive">{c.uninstalledBadge}</Badge>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="text-end tabular-nums">{shop.jobsLast7d}</TableCell>
                      <TableCell className="text-end tabular-nums">
                        ${shop.spendLast7dUsd.toFixed(2)}
                      </TableCell>
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

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>{c.recentFailures}</CardTitle>
            <CardDescription>{c.recentFailuresBody}</CardDescription>
          </CardHeader>
          <CardContent>
            {recentFailures.length === 0 ? (
              <p className="text-sm text-muted-foreground">{c.nothingFailedRecently}</p>
            ) : (
              <ul className="grid gap-3">
                {recentFailures.map((failure) => (
                  <li key={failure.id} className="grid gap-0.5 text-sm">
                    <span className="font-medium">
                      {failure.productId}
                      <span className="text-muted-foreground">
                        {' '}
                        · {failure.shop ?? c.demoShop} ·{' '}
                        {new Date(failure.createdAt).toLocaleString(dateLocale)}
                      </span>
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {failure.message ?? c.noMessageRecorded}
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
