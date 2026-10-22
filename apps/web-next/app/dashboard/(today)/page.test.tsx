import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DashboardOverviewPage from './page';
import { getRequestLocale } from '@/lib/auth/locale';
import { computeOverview, getTryOnOverview } from '@/lib/dashboard/overview-data';
import { getOverviewCopy } from '@/lib/dashboard/overview-copy';
import { storeFlags } from '@/lib/flags/store-flags';
import { getTodayFacts } from '@/lib/dashboard/today-data';
import { renderWithMantine } from '@/components/mantine/test-utils';

vi.mock('@/lib/auth/locale', () => ({ getRequestLocale: vi.fn() }));
vi.mock('@/lib/dashboard/overview-data', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/dashboard/overview-data')>(),
  getTryOnOverview: vi.fn(),
}));
vi.mock('@/lib/dashboard/active-store-server', () => ({
  getActiveStore: vi.fn(async () => ({ shopDomain: 'alpha.myshopify.com', siteId: null })),
  getActiveStoreTimeZone: vi.fn(async () => 'Africa/Cairo'),
  getActiveStoreRole: vi.fn(async () => 'owner'),
}));
vi.mock('@/lib/flags/store-flags', () => ({ storeFlags: vi.fn(async () => []) }));
vi.mock('@/lib/dashboard/today-data', () => ({ getTodayFacts: vi.fn() }));

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

describe('DashboardOverviewPage days', () => {
  it("counts days on the active store's calendar (item 32)", async () => {
    vi.mocked(getRequestLocale).mockResolvedValue('en');
    vi.mocked(getTryOnOverview).mockResolvedValue(fixture([0]));
    render(await DashboardOverviewPage());
    expect(getTryOnOverview).toHaveBeenCalledWith({ timeZone: 'Africa/Cairo' });
  });
});

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

describe('DashboardOverviewPage, v16 Today', () => {
  it('draws the v16 Today for a store whose v16_dashboard flag is on, and today’s page otherwise', async () => {
    vi.mocked(getTryOnOverview).mockClear();
    vi.mocked(getRequestLocale).mockResolvedValue('en');
    vi.mocked(storeFlags).mockResolvedValue(['v16_dashboard']);
    vi.mocked(getTodayFacts).mockResolvedValue({
      now: Date.parse('2026-10-02T11:00:00Z'),
      timeZone: 'Africa/Cairo',
      canBilling: true,
      tryOn: null,
      chat: {
        lastSeenAt: '2026-10-02T10:58:00Z',
        waiting: [{ since: '2026-10-02T10:48:00Z', alertSent: true, cart: null }],
        chatsToday: 3,
        handedOffToday: 1,
        solved7: 6,
        handedOff7: 2,
        handoffs7: 2,
        alertProblems7: 0,
        teamReplyMinutes: null,
        emailsTeam: true,
      },
    });
    renderWithMantine(await DashboardOverviewPage());
    expect(getTodayFacts).toHaveBeenCalledWith(
      expect.objectContaining({ activeStore: { shopDomain: 'alpha.myshopify.com', siteId: null }, role: 'owner', timeZone: 'Africa/Cairo' }),
    );
    expect(screen.getByRole('heading', { name: 'Needs you' })).toBeInTheDocument();
    expect(screen.getByText('1 shopper wants a person')).toBeInTheDocument();
    expect(getTryOnOverview).not.toHaveBeenCalled();

    vi.mocked(storeFlags).mockResolvedValue([]);
    vi.mocked(getTryOnOverview).mockResolvedValue(fixture([0]));
    render(await DashboardOverviewPage());
    expect(getTryOnOverview).toHaveBeenCalled();
  });
});
