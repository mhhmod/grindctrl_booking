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

describe('DashboardOverviewPage provider cost evidence', () => {
  it.each(['en', 'ar'] as const)('labels partial totals and missing costs in %s', async (locale) => {
    vi.mocked(getRequestLocale).mockResolvedValue(locale);
    vi.mocked(getTryOnOverview).mockResolvedValue(fixture([null, 0.25, 0]));
    render(await DashboardOverviewPage());
    const copy = getOverviewCopy(locale);
    const spendCard = screen.getByText(copy.providerSpend7d).closest('[data-slot="card"]');
    expect(within(spendCard as HTMLElement).getByText('$0.25')).toBeInTheDocument();
    expect(within(spendCard as HTMLElement).getByText(copy.missingProviderCosts(1))).toBeInTheDocument();
    expect(within(spendCard as HTMLElement).getByText(copy.spendComparisonUnavailable)).toBeInTheDocument();
    const row = screen.getByRole('cell', { name: 'alpha.myshopify.com' }).closest('tr');
    expect(within(row as HTMLElement).getByText(copy.missingProviderCosts(1))).toBeInTheDocument();
  });

  it('preserves all-unknown spend in the card, shop row and daily chart', async () => {
    vi.mocked(getRequestLocale).mockResolvedValue('en');
    vi.mocked(getTryOnOverview).mockResolvedValue(fixture([null]));
    render(await DashboardOverviewPage());
    const copy = getOverviewCopy('en');
    const card = screen.getByText(copy.providerSpend7d).closest('[data-slot="card"]');
    expect(within(card as HTMLElement).getByText(copy.costUnreported)).toBeInTheDocument();
    expect(within(card as HTMLElement).queryByText('$0.00')).not.toBeInTheDocument();
    expect(screen.getByRole('cell', { name: /Unreported.*Generations with unreported cost: 1/ })).toBeInTheDocument();
    expect(within(screen.getByRole('img', { name: copy.dailyChartAriaLabel })).getByText(/Known spend: Unreported/)).toBeInTheDocument();
  });

  it('suppresses an otherwise misleading spend trend when only the previous week is incomplete', async () => {
    vi.mocked(getRequestLocale).mockResolvedValue('en');
    vi.mocked(getTryOnOverview).mockResolvedValue(fixture([0.5], null));
    render(await DashboardOverviewPage());
    const copy = getOverviewCopy('en');
    const card = screen.getByText(copy.providerSpend7d).closest('[data-slot="card"]');
    expect(within(card as HTMLElement).getByText(copy.spendComparisonUnavailable)).toBeInTheDocument();
    expect(within(card as HTMLElement).getByText(copy.missingPreviousProviderCosts(1))).toBeInTheDocument();
    expect(within(card as HTMLElement).queryByText(copy.trendNewThisWeek)).not.toBeInTheDocument();
  });
});
