import 'server-only';

import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { listManagedTryOnShops } from '@/lib/shopify/shops';
import { reportedCostUsd } from './provider-cost';
import { withoutTestLooks } from '@/lib/try-on/test-looks';
import { addStoreDays, startOfStoreDay, storeDayKey, UTC } from '@/lib/time/store-day';

export type TryOnOverview = {
  totals: {
    installedShops: number;
    jobsLast7d: number;
    jobsPrev7d: number;
    completedLast7d: number;
    failedLast7d: number;
    /** Known spend only; null when a nonempty window has no reported costs. */
    spendLast7dUsd: number | null;
    spendPrev7dUsd: number | null;
    missingCostJobsLast7d: number;
    missingCostJobsPrev7d: number;
    avgDurationMsLast7d: number | null;
  };
  byShop: Array<{
    domain: string;
    jobsLast7d: number;
    spendLast7dUsd: number | null;
    missingCostJobsLast7d: number;
    lastJobAt: string | null;
    status: 'installed' | 'uninstalled';
  }>;
  dailySeries: Array<{ day: string; jobs: number; spendUsd: number | null; missingCostJobs: number }>;
  recentFailures: Array<{
    id: string;
    productId: string;
    shop: string | null;
    message: string | null;
    createdAt: string;
  }>;
};

export type TryOnOverviewJob = {
  id: string;
  product_id: string;
  shop: string | null;
  status: string;
  cost_usd: number | null;
  duration_ms: number | null;
  message: string | null;
  created_at: string;
};

export type TryOnOverviewShop = {
  shop_domain: string;
  status: 'installed' | 'uninstalled';
};

/* The 14-day series and the 7-day windows run on the store's calendar
   (phase zero item 32), so "today" starts at the store's midnight, not
   UTC's. Callers without a store zone get UTC, as before. */
export function computeOverview(
  jobs: readonly TryOnOverviewJob[],
  shops: readonly TryOnOverviewShop[],
  now: Date,
  timeZone: string = UTC,
): TryOnOverview {
  const todayStart = startOfStoreDay(now, timeZone);
  const seriesStart = addStoreDays(todayStart, -13, timeZone);
  const currentWindowStart = addStoreDays(todayStart, -6, timeZone);
  const nowTimestamp = now.getTime();
  const dayKey = (timestamp: number) => storeDayKey(timestamp, timeZone);

  const dailySeries = Array.from({ length: 14 }, (_, index) => ({
    day: dayKey(addStoreDays(seriesStart, index, timeZone)),
    jobs: 0,
    spendUsd: 0,
    missingCostJobs: 0,
  }));
  const seriesByDay = new Map(dailySeries.map((entry) => [entry.day, entry]));

  const shopsByDomain = new Map(
    shops.map((shop) => [
      shop.shop_domain,
      {
        domain: shop.shop_domain,
        jobsLast7d: 0,
        spendLast7dUsd: 0,
        missingCostJobsLast7d: 0,
        lastJobAt: null as string | null,
        status: shop.status,
      },
    ]),
  );

  let jobsLast7d = 0;
  let jobsPrev7d = 0;
  let completedLast7d = 0;
  let failedLast7d = 0;
  let spendLast7dUsd = 0;
  let spendPrev7dUsd = 0;
  let missingCostJobsLast7d = 0;
  let missingCostJobsPrev7d = 0;
  let completedDurationTotal = 0;
  let completedDurationCount = 0;

  for (const job of jobs) {
    const timestamp = Date.parse(job.created_at);
    if (!Number.isFinite(timestamp)) continue;

    const shopOverview = job.shop ? shopsByDomain.get(job.shop) : undefined;
    if (shopOverview && (shopOverview.lastJobAt === null || timestamp > Date.parse(shopOverview.lastJobAt))) {
      shopOverview.lastJobAt = job.created_at;
    }

    if (timestamp < seriesStart || timestamp > nowTimestamp) continue;

    const cost = reportedCostUsd(job.cost_usd);
    const seriesEntry = seriesByDay.get(dayKey(timestamp));
    if (seriesEntry) {
      seriesEntry.jobs += 1;
      if (cost === null) seriesEntry.missingCostJobs += 1;
      else seriesEntry.spendUsd += cost;
    }

    if (timestamp >= currentWindowStart) {
      jobsLast7d += 1;
      if (cost === null) missingCostJobsLast7d += 1;
      else spendLast7dUsd += cost;
      if (job.status === 'completed') {
        completedLast7d += 1;
        if (
          typeof job.duration_ms === 'number' &&
          Number.isFinite(job.duration_ms) &&
          job.duration_ms >= 0
        ) {
          completedDurationTotal += job.duration_ms;
          completedDurationCount += 1;
        }
      }
      if (job.status === 'failed') failedLast7d += 1;

      if (shopOverview) {
        shopOverview.jobsLast7d += 1;
        if (cost === null) shopOverview.missingCostJobsLast7d += 1;
        else shopOverview.spendLast7dUsd += cost;
      }
    } else {
      jobsPrev7d += 1;
      if (cost === null) missingCostJobsPrev7d += 1;
      else spendPrev7dUsd += cost;
    }
  }

  const recentFailures = jobs
    .filter((job) => job.status === 'failed' && Number.isFinite(Date.parse(job.created_at)))
    .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))
    .slice(0, 5)
    .map((job) => ({
      id: job.id,
      productId: job.product_id,
      shop: job.shop,
      message: job.message,
      createdAt: job.created_at,
    }));

  return {
    totals: {
      installedShops: [...shopsByDomain.values()].filter((shop) => shop.status === 'installed')
        .length,
      jobsLast7d,
      jobsPrev7d,
      completedLast7d,
      failedLast7d,
      spendLast7dUsd: jobsLast7d > 0 && missingCostJobsLast7d === jobsLast7d ? null : spendLast7dUsd,
      spendPrev7dUsd: jobsPrev7d > 0 && missingCostJobsPrev7d === jobsPrev7d ? null : spendPrev7dUsd,
      missingCostJobsLast7d,
      missingCostJobsPrev7d,
      avgDurationMsLast7d:
        completedDurationCount > 0 ? completedDurationTotal / completedDurationCount : null,
    },
    byShop: [...shopsByDomain.values()].map((shop) => ({
      ...shop,
      spendLast7dUsd: shop.jobsLast7d > 0 && shop.missingCostJobsLast7d === shop.jobsLast7d
        ? null : shop.spendLast7dUsd,
    })).sort(
      (left, right) => right.jobsLast7d - left.jobsLast7d || left.domain.localeCompare(right.domain),
    ),
    dailySeries: dailySeries.map((day) => ({
      ...day,
      spendUsd: day.jobs > 0 && day.missingCostJobs === day.jobs ? null : day.spendUsd,
    })),
    recentFailures,
  };
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  return createClient(url, key, { auth: { persistSession: false } });
}

async function requireDashboardOwner() {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');
}

export async function getTryOnOverview({ timeZone = UTC }: { timeZone?: string } = {}): Promise<TryOnOverview> {
  await requireDashboardOwner();

  const now = new Date();
  const emptyOverview = () => computeOverview([], [], now, timeZone);

  try {
    // The owned-shop list is the single source of truth for "what can this
    // caller see" -- reusing it here (instead of a second unfiltered
    // tryon_shops query) means this function inherits shops.ts's ownership
    // scoping instead of needing its own copy of the same filter.
    const shops = await listManagedTryOnShops();
    const domains = shops.map((shop) => shop.domain);
    if (domains.length === 0) return emptyOverview();

    const supabase = getServiceClient();
    if (!supabase) return emptyOverview();

    const since = new Date(addStoreDays(startOfStoreDay(now, timeZone), -13, timeZone)).toISOString();
    // The owner's test looks are not looks shoppers made.
    const jobsResult = await withoutTestLooks((excludeTestLooks) => {
      const query = supabase
        .from('tryon_jobs')
        .select('id, product_id, shop, status, cost_usd, duration_ms, message, created_at')
        .in('shop', domains)
        .gte('created_at', since)
        .lte('created_at', now.toISOString());
      return excludeTestLooks ? query.eq('is_test', false) : query;
    });

    if (jobsResult.error) throw jobsResult.error;

    return computeOverview(
      (jobsResult.data ?? []) as TryOnOverviewJob[],
      shops.map((shop) => ({ shop_domain: shop.domain, status: shop.status }) satisfies TryOnOverviewShop),
      now,
      timeZone,
    );
  } catch (error) {
    console.error('getTryOnOverview failed:', error instanceof Error ? error.message : error);
    return emptyOverview();
  }
}
