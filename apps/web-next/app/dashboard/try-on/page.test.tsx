import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

/* The page reads through Clerk + Supabase and the panel navigates on shop
   change; stub those edges so the test covers what the owner actually sees. */
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/lib/shopify/shops', () => ({
  requireManagedTryOnShop: vi.fn(async (shop: unknown) => String(shop ?? 'default')),
  listManagedTryOnShops: vi.fn(async () => [
    {
      domain: 'grindctrl.myshopify.com',
      status: 'installed' as const,
      installedAt: '2026-07-01T00:00:00.000Z',
      uninstalledAt: null,
      lastSeenAt: '2026-07-16T00:00:00.000Z',
      jobCount: 3,
      lastJobAt: '2026-07-16T00:00:00.000Z',
    },
  ]),
}));

vi.mock('./plan-actions', () => ({
  listPlansCatalog: vi.fn(async () => ({
    plans: [
      {
        id: 'p1',
        planKey: 'launch-v1',
        name: 'Launch',
        description: null,
        priceMinor: 1500,
        currency: 'USD',
        rendersIncluded: 300,
        modelKey: 'lite',
        periodUnit: 'month' as const,
        periodCount: 1,
        graceDays: 3,
        isFree: false,
        active: true,
        sortOrder: 20,
      },
    ],
    packs: [
      {
        id: 'k1',
        packKey: 'pack-lite-v1',
        name: 'Boost 80',
        priceMinor: 500,
        currency: 'USD',
        renders: 80,
        modelKey: 'lite',
        validityDays: 365,
        active: true,
        sortOrder: 10,
      },
    ],
  })),
  getShopPlanState: vi.fn(async () => ({
    shop: 'grindctrl.myshopify.com',
    subscriptionId: 's1',
    planId: 'p1',
    planKey: 'launch-v1',
    planName: 'Launch',
    status: 'active' as const,
    isFree: false,
    rendersIncluded: 300,
    planCreditsRemaining: 280,
    topUpCreditsRemaining: 0,
    totalCreditsRemaining: 280,
    currentPeriodStart: '2026-07-01T00:00:00.000Z',
    currentPeriodEnd: '2026-08-01T00:00:00.000Z',
    graceEndsAt: '2026-08-04T00:00:00.000Z',
    daysRemaining: 13,
    bannerState: 'none' as const,
    available: true,
    pendingPlanKey: null,
    pendingPlanEffectiveAt: null,
    notes: null,
  })),
}));

vi.mock('@/lib/try-on/persistence', () => ({
  listRecentTryOnJobs: vi.fn(async () => []),
}));

import DashboardTryOnPage from '@/app/dashboard/try-on/page';

async function renderPage(shop?: string) {
  render(await DashboardTryOnPage({ searchParams: Promise.resolve({ shop }) }));
}

describe('DashboardTryOnPage', () => {
  it('shows the installed shops and the shared settings controls', async () => {
    await renderPage();

    expect(screen.getByRole('heading', { name: 'Try-On' })).toBeInTheDocument();
    expect(screen.getByText('Installed shops')).toBeInTheDocument();
    // The shop is listed in the table (it also appears as a selector option).
    expect(screen.getByRole('cell', { name: 'grindctrl.myshopify.com' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '3' })).toBeInTheDocument();

    // The same controls the Shopify admin renders, from the shared component.
    expect(screen.getByLabelText('Button label')).toHaveValue('Try it on with AI');
    expect(screen.getByLabelText('Catalog pill label')).toBeInTheDocument();
    expect(screen.getByLabelText('Button icon size')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save settings' })).toBeInTheDocument();
  });

  it('defaults to the global row and offers each installed shop', async () => {
    await renderPage();

    expect(screen.getByLabelText('Editing')).toHaveValue('default');
    expect(
      screen.getByRole('option', { name: /Global defaults/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'grindctrl.myshopify.com' }),
    ).toBeInTheDocument();
  });

  it('selects a known shop from the query string', async () => {
    await renderPage('grindctrl.myshopify.com');

    expect(screen.getByLabelText('Editing')).toHaveValue('grindctrl.myshopify.com');
  });

  // A forged or unknown shop must never become the edit target.
  it('falls back to the global row for an unknown shop', async () => {
    await renderPage('attacker.myshopify.com');

    expect(screen.getByLabelText('Editing')).toHaveValue('default');
  });
});
