import { describe, expect, it } from 'vitest';
import {
  computeOverview,
  type TryOnOverviewJob,
  type TryOnOverviewShop,
} from './overview-data';

const NOW = new Date('2026-07-18T12:00:00.000Z');

function job(overrides: Partial<TryOnOverviewJob> = {}): TryOnOverviewJob {
  return {
    id: 'job-1',
    product_id: 'product-1',
    shop: 'alpha.myshopify.com',
    status: 'completed',
    cost_usd: 0.1,
    duration_ms: 1_000,
    message: null,
    created_at: '2026-07-18T08:00:00.000Z',
    ...overrides,
  };
}

const shops: TryOnOverviewShop[] = [
  { shop_domain: 'alpha.myshopify.com', status: 'installed' },
  { shop_domain: 'beta.myshopify.com', status: 'installed' },
  { shop_domain: 'old.myshopify.com', status: 'uninstalled' },
];

describe('computeOverview', () => {
  it('buckets the current and previous seven UTC calendar days', () => {
    const overview = computeOverview(
      [
        job({ id: 'current-start', created_at: '2026-07-12T00:00:00.000Z', cost_usd: 1 }),
        job({ id: 'current-latest', created_at: '2026-07-18T11:59:59.000Z', cost_usd: 2 }),
        job({ id: 'previous-latest', created_at: '2026-07-11T23:59:59.000Z', cost_usd: 4 }),
        job({ id: 'previous-start', created_at: '2026-07-05T00:00:00.000Z', cost_usd: 8 }),
        job({ id: 'too-old', created_at: '2026-07-04T23:59:59.000Z', cost_usd: 16 }),
        job({ id: 'future', created_at: '2026-07-18T12:00:01.000Z', cost_usd: 32 }),
      ],
      shops,
      NOW,
    );

    expect(overview.totals).toMatchObject({
      installedShops: 2,
      jobsLast7d: 2,
      jobsPrev7d: 2,
      completedLast7d: 2,
      failedLast7d: 0,
      spendLast7dUsd: 3,
      spendPrev7dUsd: 12,
      avgDurationMsLast7d: 1_000,
    });
  });

  it('fills all fourteen UTC days, including days without jobs', () => {
    const overview = computeOverview(
      [job({ created_at: '2026-07-18T08:00:00.000Z', cost_usd: 0.25 })],
      [],
      NOW,
    );

    expect(overview.dailySeries).toHaveLength(14);
    expect(overview.dailySeries[0]).toEqual({ day: '2026-07-05', jobs: 0, spendUsd: 0, missingCostJobs: 0 });
    expect(overview.dailySeries[12]).toEqual({ day: '2026-07-17', jobs: 0, spendUsd: 0, missingCostJobs: 0 });
    expect(overview.dailySeries[13]).toEqual({ day: '2026-07-18', jobs: 1, spendUsd: 0.25, missingCostJobs: 0 });
  });

  it('counts demo jobs in totals and series but never adds a demo shop row', () => {
    const overview = computeOverview(
      [
        job({ id: 'demo', shop: null, cost_usd: 0.4 }),
        job({ id: 'store', shop: 'alpha.myshopify.com', cost_usd: 0.6 }),
      ],
      shops,
      NOW,
    );

    expect(overview.totals.jobsLast7d).toBe(2);
    expect(overview.totals.spendLast7dUsd).toBe(1);
    expect(overview.dailySeries[13]).toMatchObject({ jobs: 2, spendUsd: 1 });
    expect(overview.byShop.map((shop) => shop.domain)).not.toContain('demo');
    expect(overview.byShop).toContainEqual({
      domain: 'beta.myshopify.com',
      jobsLast7d: 0,
      spendLast7dUsd: 0,
      missingCostJobsLast7d: 0,
      lastJobAt: null,
      status: 'installed',
    });
    expect(overview.byShop[0]).toMatchObject({
      domain: 'alpha.myshopify.com',
      jobsLast7d: 1,
      spendLast7dUsd: 0.6,
    });
  });

  it('sorts and caps recent failures at five', () => {
    const failures = Array.from({ length: 7 }, (_, index) =>
      job({
        id: `failure-${index}`,
        product_id: `product-${index}`,
        shop: index === 6 ? null : 'alpha.myshopify.com',
        status: 'failed',
        message: `Failure ${index}`,
        created_at: `2026-07-${String(10 + index).padStart(2, '0')}T08:00:00.000Z`,
      }),
    );

    const overview = computeOverview(failures, shops, NOW);

    expect(overview.recentFailures).toHaveLength(5);
    expect(overview.recentFailures.map((failure) => failure.id)).toEqual([
      'failure-6',
      'failure-5',
      'failure-4',
      'failure-3',
      'failure-2',
    ]);
    expect(overview.recentFailures[0]).toEqual({
      id: 'failure-6',
      productId: 'product-6',
      shop: null,
      message: 'Failure 6',
      createdAt: '2026-07-16T08:00:00.000Z',
    });
  });

  it('separates partial known spend from missing costs across periods, days and shops', () => {
    const overview = computeOverview([
      job({ id: 'known', cost_usd: 0.2 }),
      job({ id: 'zero', cost_usd: 0 }),
      job({ id: 'unknown', cost_usd: null }),
      job({ id: 'failed', status: 'failed', cost_usd: 0.3 }),
      job({ id: 'other-shop', shop: 'beta.myshopify.com', cost_usd: null, created_at: '2026-07-17T08:00:00Z' }),
      job({ id: 'previous', cost_usd: null, created_at: '2026-07-08T08:00:00Z' }),
    ], shops, NOW);

    expect(overview.totals).toMatchObject({
      spendLast7dUsd: 0.5, missingCostJobsLast7d: 2,
      spendPrev7dUsd: null, missingCostJobsPrev7d: 1,
    });
    expect(overview.byShop.find((shop) => shop.domain === 'alpha.myshopify.com'))
      .toMatchObject({ spendLast7dUsd: 0.5, missingCostJobsLast7d: 1 });
    expect(overview.byShop.find((shop) => shop.domain === 'beta.myshopify.com'))
      .toMatchObject({ spendLast7dUsd: null, missingCostJobsLast7d: 1 });
    expect(overview.dailySeries[12]).toMatchObject({ spendUsd: null, missingCostJobs: 1 });
    expect(overview.dailySeries[13]).toMatchObject({ spendUsd: 0.5, missingCostJobs: 1 });
  });

  it('treats invalid costs as unknown without confusing a reported zero or an empty window', () => {
    const overview = computeOverview([
      job({ cost_usd: Number.NaN }), job({ cost_usd: -1 }), job({ cost_usd: Number.POSITIVE_INFINITY }),
    ], shops, NOW);
    expect(overview.totals).toMatchObject({ spendLast7dUsd: null, missingCostJobsLast7d: 3 });
    expect(computeOverview([job({ cost_usd: 0 })], shops, NOW).totals)
      .toMatchObject({ spendLast7dUsd: 0, missingCostJobsLast7d: 0 });
    expect(computeOverview([], shops, NOW).totals)
      .toMatchObject({ spendLast7dUsd: 0, missingCostJobsLast7d: 0 });
  });
});
