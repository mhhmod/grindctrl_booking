import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

/* The page reads through Clerk + Supabase and the panel navigates on shop
   change; stub those edges so the test covers what the owner actually sees. */
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

/* The page resolves the operator's language from the locale cookie, and
   cookies() has no request scope when the component is rendered directly. */
let cookieLocale: string | undefined;
/* getRequestLocale falls back to Accept-Language when no cookie is set, so the
   mock has to supply headers as well as cookies. */
let acceptLanguage: string | undefined;
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === 'gc-locale' && cookieLocale ? { name, value: cookieLocale } : undefined,
  }),
  headers: async () => ({
    get: (name: string) =>
      name.toLowerCase() === 'accept-language' ? (acceptLanguage ?? null) : null,
  }),
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
import { listManagedTryOnShops } from '@/lib/shopify/shops';
import { getShopPlanState, listPlansCatalog } from './plan-actions';

async function renderPage(shop?: string) {
  render(await DashboardTryOnPage({ searchParams: Promise.resolve({ shop }) }));
}

describe('DashboardTryOnPage', () => {
  it('shows the installed shops and the shared settings controls', async () => {
    await renderPage();

    // The shell owns the page title now; assert on a section heading instead.
    expect(screen.getByText('Merchant shops')).toBeInTheDocument();
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

describe('DashboardTryOnPage with no shop connected', () => {
  // The regression this guards: a caller who owns nothing must never see
  // another tenant's shop data or the shared demo config's edit controls.
  it('shows an honest empty state and never touches shop-scoped config', async () => {
    vi.mocked(listManagedTryOnShops).mockResolvedValueOnce([]);
    // Earlier tests in this file already called these; clear so "not
    // called" below reflects this render, not accumulated history.
    vi.mocked(listPlansCatalog).mockClear();
    vi.mocked(getShopPlanState).mockClear();

    await renderPage();

    expect(screen.getByText('No shop is linked to your account yet. Once one is connected, it will appear here.')).toBeInTheDocument();
    expect(screen.queryByText('Plan and credits')).not.toBeInTheDocument();
    expect(screen.queryByText('Appearance and journey')).not.toBeInTheDocument();
    expect(screen.queryByText('Shopify app')).not.toBeInTheDocument();
    expect(listPlansCatalog).not.toHaveBeenCalled();
    expect(getShopPlanState).not.toHaveBeenCalled();
  });
});
