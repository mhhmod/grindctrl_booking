import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TryOnOverviewView } from './tryon-overview-view';
import type { TryOnOverview } from '@/lib/dashboard/overview-data';

/* Fixture mirrors the exact shape getTryOnOverview() returns, so this test
   catches a prop/shape drift between the data layer and the view without
   needing Supabase or Clerk. */
const overview: TryOnOverview = {
  totals: {
    installedShops: 1,
    jobsLast7d: 64,
    jobsPrev7d: 51,
    completedLast7d: 61,
    failedLast7d: 3,
    spendLast7dUsd: 12.5,
    spendPrev7dUsd: 9.8,
    missingCostJobsLast7d: 0,
    missingCostJobsPrev7d: 0,
    avgDurationMsLast7d: 11_400,
  },
  byShop: [
    {
      domain: 'demo-store.myshopify.com',
      jobsLast7d: 64,
      spendLast7dUsd: 12.5,
      missingCostJobsLast7d: 0,
      lastJobAt: '2026-09-16T10:00:00.000Z',
      status: 'installed',
    },
  ],
  dailySeries: Array.from({ length: 14 }, (_, index) => ({
    day: `2026-09-${String(index + 1).padStart(2, '0')}`,
    jobs: index >= 7 ? Math.max(0, index - 5) : 0,
    spendUsd: null,
    missingCostJobs: 0,
  })),
  recentFailures: [
    {
      id: 'job-failed-1',
      productId: 'premium-ringer-tee',
      shop: 'demo-store.myshopify.com',
      message: 'The photo was too dark to see the garment clearly.',
      createdAt: '2026-09-16T09:00:00.000Z',
    },
  ],
};

describe('TryOnOverviewView', () => {
  it('renders totals, shops, and failures in English', () => {
    render(<TryOnOverviewView overview={overview} locale="en" />);

    /* "64" appears twice by design: the generations-7d total and this
       single demo shop's own jobsLast7d. */
    expect(screen.getAllByText('64')).toHaveLength(2);
    expect(screen.getByText(/up 25% on last week/)).toBeInTheDocument();
    expect(screen.getByText('demo-store.myshopify.com')).toBeInTheDocument();
    expect(screen.getByText('premium-ringer-tee')).toBeInTheDocument();
    expect(screen.getByText(/too dark to see the garment/)).toBeInTheDocument();
  });

  it('renders the same data in Arabic copy', () => {
    render(<TryOnOverviewView overview={overview} locale="ar" />);

    expect(screen.getAllByText('64')).toHaveLength(2);
    expect(screen.getByText(/ارتفاع 25% عن الأسبوع الماضي/)).toBeInTheDocument();
    expect(screen.getByText('demo-store.myshopify.com')).toBeInTheDocument();
    expect(screen.getByText('أحدث الإخفاقات')).toBeInTheDocument();
  });

  it('shows the empty-shops copy when no shop has activity', () => {
    render(
      <TryOnOverviewView
        overview={{ ...overview, byShop: [] }}
        locale="en"
      />,
    );

    expect(
      screen.getByText('No merchant shops yet. Install the app on a store and it appears here.'),
    ).toBeInTheDocument();
  });
});
