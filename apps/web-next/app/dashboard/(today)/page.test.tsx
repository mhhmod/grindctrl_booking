import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DashboardOverviewPage from './page';
import { getRequestLocale } from '@/lib/auth/locale';
import { computeOverview, getTryOnOverview } from '@/lib/dashboard/overview-data';
import { getOverviewCopy } from '@/lib/dashboard/overview-copy';

vi.mock('@/lib/auth/locale', () => ({ getRequestLocale: vi.fn() }));
vi.mock('@/lib/dashboard/overview-data', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/dashboard/overview-data')>(),
  getTryOnOverview: vi.fn(),
}));

function fixture(costs: Array<number | null>, previousCost: number | null = 0) {
  return computeOverview([
    ...costs.map((cost, index) => ({
      id: `job-${index}`, product_id: 'product', shop: 'alpha.myshopify.com', status: 'completed',
      cost_usd: cost, duration_ms: 1000, message: null, created_at: '2026-09-05T08:00:00Z',
    })),
    { id: 'previous', product_id: 'product', shop: 'alpha.myshopify.com', status: 'completed',
      cost_usd: previousCost, duration_ms: 1000, message: null, created_at: '2026-08-25T08:00:00Z' },
  ], [{ shop_domain: 'alpha.myshopify.com', status: 'installed' }], new Date('2026-09-05T12:00:00Z'));
}

describe('DashboardOverviewPage provider cost privacy', () => {
  it.each(['en', 'ar'] as const)('does not render provider spend in %s', async (locale) => {
    vi.mocked(getRequestLocale).mockResolvedValue(locale);
    vi.mocked(getTryOnOverview).mockResolvedValue(fixture([null, 0.25, 0]));
    render(await DashboardOverviewPage());
    const copy = getOverviewCopy(locale);

    expect(screen.queryByText(copy.providerSpend7d)).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: copy.columnSpend7d })).not.toBeInTheDocument();
    expect(
      within(screen.getByRole('img', { name: copy.dailyChartAriaLabel })).queryByText(
        new RegExp(copy.knownSpend),
      ),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('$0.25')).not.toBeInTheDocument();
  });
});
