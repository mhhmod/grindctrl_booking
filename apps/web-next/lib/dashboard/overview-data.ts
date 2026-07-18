import 'server-only';

import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

export type TryOnOverview = {
  totals: {
    installedShops: number;
    jobsLast7d: number;
    jobsPrev7d: number;
    completedLast7d: number;
    failedLast7d: number;
    spendLast7dUsd: number;
    spendPrev7dUsd: number;
    avgDurationMsLast7d: number | null;
  };
  byShop: Array<{
    domain: string;
    jobsLast7d: number;
    spendLast7dUsd: number;
    lastJobAt: string | null;
    status: 'installed' | 'uninstalled';
  }>;
  dailySeries: Array<{ day: string; jobs: number; spendUsd: number }>;
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

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfUtcDay(value: Date) {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

function dayKey(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function numeric(value: number | null) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export function computeOverview(
  jobs: readonly TryOnOverviewJob[],
  shops: readonly TryOnOverviewShop[],
  now: Date,
): TryOnOverview {
  const todayStart = startOfUtcDay(now);
  const seriesStart = todayStart - 13 * DAY_MS;
  const currentWindowStart = todayStart - 6 * DAY_MS;
  const nowTimestamp = now.getTime();

  const dailySeries = Array.from({ length: 14 }, (_, index) => ({
    day: dayKey(seriesStart + index * DAY_MS),
    jobs: 0,
    spendUsd: 0,
  }));
  const seriesByDay = new Map(dailySeries.map((entry) => [entry.day, entry]));

  const shopsByDomain = new Map(
    shops.map((shop) => [
      shop.shop_domain,
      {
        domain: shop.shop_domain,
        jobsLast7d: 0,
        spendLast7dUsd: 0,
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

    const cost = numeric(job.cost_usd);
    const seriesEntry = seriesByDay.get(dayKey(timestamp));
    if (seriesEntry) {
      seriesEntry.jobs += 1;
      seriesEntry.spendUsd += cost;
    }

    if (timestamp >= currentWindowStart) {
      jobsLast7d += 1;
      spendLast7dUsd += cost;
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
        shopOverview.spendLast7dUsd += cost;
      }
    } else {
      jobsPrev7d += 1;
      spendPrev7dUsd += cost;
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
      spendLast7dUsd,
      spendPrev7dUsd,
      avgDurationMsLast7d:
        completedDurationCount > 0 ? completedDurationTotal / completedDurationCount : null,
    },
    byShop: [...shopsByDomain.values()].sort(
      (left, right) => right.jobsLast7d - left.jobsLast7d || left.domain.localeCompare(right.domain),
    ),
    dailySeries,
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

export async function getTryOnOverview(): Promise<TryOnOverview> {
  await requireDashboardOwner();

  const now = new Date();
  const emptyOverview = () => computeOverview([], [], now);
  const supabase = getServiceClient();
  if (!supabase) return emptyOverview();

  try {
    const since = new Date(startOfUtcDay(now) - 13 * DAY_MS).toISOString();
    const [jobsResult, shopsResult] = await Promise.all([
      supabase
        .from('tryon_jobs')
        .select('id, product_id, shop, status, cost_usd, duration_ms, message, created_at')
        .gte('created_at', since)
        .lte('created_at', now.toISOString()),
      supabase.from('tryon_shops').select('shop_domain, status'),
    ]);

    if (jobsResult.error) throw jobsResult.error;
    if (shopsResult.error) throw shopsResult.error;

    return computeOverview(
      (jobsResult.data ?? []) as TryOnOverviewJob[],
      (shopsResult.data ?? []) as TryOnOverviewShop[],
      now,
    );
  } catch (error) {
    console.error('getTryOnOverview failed:', error instanceof Error ? error.message : error);
    return emptyOverview();
  }
}
