import React from 'react';
import { cleanup, screen, within } from '@testing-library/react';
import { renderWithMantine as render } from '@/components/mantine/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const session = vi.hoisted(() => ({ auth: vi.fn() }));
vi.mock('@clerk/nextjs/server', () => ({ auth: session.auth }));

/* The page reads through Clerk + Supabase and the panel navigates on shop
   change; stub those edges so the test covers what the owner actually sees. */
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/dashboard/try-on',
  redirect: vi.fn((href: string) => {
    throw new Error(`redirect:${href}`);
  }),
}));

/* The page resolves the operator's language from the locale cookie, and
   cookies() has no request scope when the component is rendered directly. */
let cookieLocale: string | undefined;
/* getRequestLocale falls back to Accept-Language when no cookie is set, so the
   mock has to supply headers as well as cookies. */
let acceptLanguage: string | undefined;
/* The dashboard's active store (phase zero item 33): the one chosen last
   (cookie) and a link's choice the proxy passes on (header). */
let storeCookie: string | undefined;
let storeHeader: string | undefined;
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === 'gc-locale' && cookieLocale
        ? { name, value: cookieLocale }
        : name === 'gc-store' && storeCookie
          ? { name, value: storeCookie }
          : undefined,
  }),
  headers: async () => ({
    get: (name: string) =>
      name.toLowerCase() === 'accept-language'
        ? (acceptLanguage ?? null)
        : name.toLowerCase() === 'x-gc-store'
          ? (storeHeader ?? null)
          : null,
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
      role: 'owner' as const,
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

/* The v16 Try-On (behind v16_dashboard): its facts are covered in
   lib/dashboard/tryon-insights-data.test.ts; here only the page's choice. */
vi.mock('@/lib/flags/store-flags', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/flags/store-flags')>()),
  storeFlags: vi.fn(async () => []),
}));
vi.mock('@/lib/dashboard/tryon-insights-data', () => ({ getTryOnResultsFacts: vi.fn() }));
vi.mock('@/lib/try-on/entitlement', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/try-on/entitlement')>()),
  getShopEntitlement: vi.fn(async () => ({ available: true })),
}));
/* The v16 Set up reads strictly (a failed read must not show the defaults
   a save would write); today's page keeps the forgiving reader. */
vi.mock('@/lib/try-on/settings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/try-on/settings')>();
  return { ...actual, getTryOnSettingsForEdit: vi.fn(async () => actual.DEFAULT_SETTINGS) };
});

import DashboardTryOnPage from '@/app/dashboard/try-on/page';
import DashboardTryOnSetupPage from '@/app/dashboard/try-on/setup/page';
import { listManagedTryOnShops } from '@/lib/shopify/shops';
import { getShopPlanState, listPlansCatalog } from './plan-actions';
import { listRecentTryOnJobs } from '@/lib/try-on/persistence';
import { getTryOnDashboardCopy } from '@/lib/try-on/dashboard-copy';
import { SHOPIFY_APP_CLIENT_ID } from '@/lib/shopify/app-identity';
import { storeFlags } from '@/lib/flags/store-flags';
import { getTryOnResultsFacts } from '@/lib/dashboard/tryon-insights-data';
import { getTryOnResultsCopy } from '@/lib/dashboard/tryon-insights-copy';
import { getTryOnStudioCopy } from '@/lib/dashboard/tryon-studio-copy';
import { getTryOnSettingsForEdit } from '@/lib/try-on/settings';

beforeEach(() => {
  cookieLocale = undefined;
  acceptLanguage = undefined;
  storeCookie = undefined;
  storeHeader = undefined;
  session.auth.mockReset().mockResolvedValue({ userId: 'user_merchant' });
  vi.stubEnv('TRYON_PLATFORM_OPERATOR_CLERK_IDS', '');
});
afterEach(() => vi.unstubAllEnvs());

async function renderPage(shop?: string, query: { period?: string } = {}) {
  render(await DashboardTryOnPage({ searchParams: Promise.resolve({ shop, ...query }) }));
}

describe('DashboardTryOnPage', () => {
  it.each((['en', 'ar'] as const).flatMap((locale) =>
    (['merchant', 'no-config', 'operator'] as const).map((role) => ({ locale, role })),
  ))('derives $role plan-control visibility on the server in $locale', async ({ locale, role }) => {
    cookieLocale = locale;
    session.auth.mockResolvedValue({ userId: role === 'merchant' ? 'user_merchant' : 'user_operator' });
    vi.stubEnv('TRYON_PLATFORM_OPERATOR_CLERK_IDS', role === 'no-config' ? '' : 'user_operator');
    await renderPage('grindctrl.myshopify.com');
    const c = getTryOnDashboardCopy(locale);
    const card = screen.getByText(c.planAndCredits).closest('[data-slot="card"]') as HTMLElement;
    expect(within(card).getByText(c.planRendersLeft(280, 300))).toBeInTheDocument();
    expect(within(card).getByText(c.planStatusActive)).toBeInTheDocument();
    if (role === 'operator') {
      expect(within(card).getByLabelText(c.paymentReference)).toBeInTheDocument();
      expect(within(card).getByRole('button', { name: c.activateOrUpgrade })).toBeInTheDocument();
      expect(within(card).getByText(c.planAndCreditsOperatorBody)).toBeInTheDocument();
    } else {
      expect(within(card).queryByLabelText(c.paymentReference)).not.toBeInTheDocument();
      expect(within(card).queryByRole('button')).not.toBeInTheDocument();
      expect(within(card).getByText(c.managedServiceBody)).toBeInTheDocument();
      expect(within(card).getByText(c.planAndCreditsBody)).toBeInTheDocument();
    }
  });

  const ownedShop = (domain: string) => ({
    domain, status: 'installed' as const, installedAt: '2026-01-01T00:00:00.000Z', uninstalledAt: null,
    lastSeenAt: '2026-01-01T00:00:00.000Z', jobCount: 0, lastJobAt: null, role: 'owner' as const,
  });

  it('opens the selected owned store using the configured public app ID, not the GrindCTRL store', async () => {
    vi.mocked(listManagedTryOnShops).mockResolvedValueOnce([
      ownedShop('alpha.myshopify.com'), ownedShop('beta.myshopify.com'),
    ]);
    await renderPage('BETA.MYSHOPIFY.COM');
    expect(screen.getByRole('link', { name: getTryOnDashboardCopy('en').openShopifyApp }))
      .toHaveAttribute('href', 'https://admin.shopify.com/store/beta/apps/' + SHOPIFY_APP_CLIENT_ID);
    expect(document.body.innerHTML).not.toContain('/store/grindctrl/apps/grindctrl-tryon');
  });

  it('uses a sole owned store when the global view has no selected shop', async () => {
    vi.mocked(listManagedTryOnShops).mockResolvedValueOnce([ownedShop('alpha.myshopify.com')]);
    await renderPage();
    expect(screen.getByRole('link', { name: getTryOnDashboardCopy('en').openShopifyApp }))
      .toHaveAttribute('href', 'https://admin.shopify.com/store/alpha/apps/' + SHOPIFY_APP_CLIENT_ID);
  });

  it.each(['en', 'ar'] as const)('links the merchant\'s own shop in %s, never a forged selection', async (locale) => {
    cookieLocale = locale;
    vi.mocked(listManagedTryOnShops).mockResolvedValueOnce([
      ownedShop('alpha.myshopify.com'), ownedShop('beta.myshopify.com'),
    ]);
    await renderPage('attacker.myshopify.com');
    const c = getTryOnDashboardCopy(locale);
    expect(screen.getByRole('link', { name: c.openShopifyApp }))
      .toHaveAttribute('href', 'https://admin.shopify.com/store/alpha/apps/' + SHOPIFY_APP_CLIENT_ID);
    expect(document.body.innerHTML).not.toContain('/store/attacker/');
  });

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

  // The shared defaults row cannot be saved from here, so opening on it made
  // a merchant's first save fail and hid their plan.
  it("opens on the merchant's own shop and never offers the global row", async () => {
    await renderPage();

    expect(screen.getByLabelText('Editing')).toHaveValue('grindctrl.myshopify.com');
    expect(
      screen.getByRole('option', { name: 'grindctrl.myshopify.com' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Global defaults/ })).not.toBeInTheDocument();
  });

  it('selects a known shop from the query string', async () => {
    await renderPage('grindctrl.myshopify.com');

    expect(screen.getByLabelText('Editing')).toHaveValue('grindctrl.myshopify.com');
  });

  // A forged or unknown shop must never become the edit target.
  it("shows the merchant's own plan without asking them to pick a shop", async () => {
    vi.mocked(getShopPlanState).mockClear();
    await renderPage();

    expect(getShopPlanState).toHaveBeenCalledWith('grindctrl.myshopify.com');
    expect(listPlansCatalog).toHaveBeenCalledWith('grindctrl.myshopify.com');
    const c = getTryOnDashboardCopy('en');
    const card = screen.getByText(c.planAndCredits).closest('[data-slot="card"]') as HTMLElement;
    expect(within(card).getByText(c.planRendersLeft(280, 300))).toBeInTheDocument();
  });

  /* Item 12: billing is the owner's alone, and setting the shop up is for
     the owner and admins. The actions refuse the same roles on the server. */
  it.each(['admin', 'member'] as const)('shows a team %s no plan, and reads none', async (role) => {
    vi.mocked(listManagedTryOnShops).mockResolvedValueOnce([{ ...ownedShop('grindctrl.myshopify.com'), role }]);
    vi.mocked(listPlansCatalog).mockClear();
    vi.mocked(getShopPlanState).mockClear();
    await renderPage();

    const c = getTryOnDashboardCopy('en');
    expect(screen.queryByText(c.planAndCredits)).not.toBeInTheDocument();
    expect(listPlansCatalog).not.toHaveBeenCalled();
    expect(getShopPlanState).not.toHaveBeenCalled();
    // An admin sets the shop up; a member does not.
    expect(screen.queryByLabelText('Editing') !== null).toBe(role === 'admin');
  });

  it('opens on an installed shop before an uninstalled one', async () => {
    vi.mocked(listManagedTryOnShops).mockResolvedValueOnce([
      {
        domain: 'old-store.myshopify.com',
        status: 'uninstalled' as const,
        installedAt: '2026-06-01T00:00:00.000Z',
        uninstalledAt: '2026-06-20T00:00:00.000Z',
        lastSeenAt: '2026-06-20T00:00:00.000Z',
        jobCount: 0,
        lastJobAt: null,
        role: 'owner' as const,
      },
      {
        domain: 'grindctrl.myshopify.com',
        status: 'installed' as const,
        installedAt: '2026-07-01T00:00:00.000Z',
        uninstalledAt: null,
        lastSeenAt: '2026-07-16T00:00:00.000Z',
        jobCount: 3,
        lastJobAt: '2026-07-16T00:00:00.000Z',
        role: 'owner' as const,
      },
    ]);
    await renderPage();

    expect(screen.getByLabelText('Editing')).toHaveValue('grindctrl.myshopify.com');
  });

  describe('the active store', () => {
    function twoShops() {
      vi.mocked(listManagedTryOnShops).mockResolvedValueOnce([
        {
          domain: 'grindctrl.myshopify.com',
          status: 'installed' as const,
          installedAt: '2026-07-01T00:00:00.000Z',
          uninstalledAt: null,
          lastSeenAt: '2026-07-16T00:00:00.000Z',
          jobCount: 3,
          lastJobAt: '2026-07-16T00:00:00.000Z',
          role: 'owner' as const,
        },
        {
          domain: 'second.myshopify.com',
          status: 'installed' as const,
          installedAt: '2026-07-02T00:00:00.000Z',
          uninstalledAt: null,
          lastSeenAt: '2026-07-10T00:00:00.000Z',
          jobCount: 0,
          lastJobAt: null,
          role: 'owner' as const,
        },
      ]);
    }

    it('opens on the store chosen last, and its own plan', async () => {
      twoShops();
      storeCookie = 'shop:second.myshopify.com';
      vi.mocked(getShopPlanState).mockClear();
      await renderPage();

      expect(screen.getByLabelText('Editing')).toHaveValue('second.myshopify.com');
      expect(getShopPlanState).toHaveBeenCalledWith('second.myshopify.com');
    });

    it('lets a link switch store over the one chosen last', async () => {
      twoShops();
      storeCookie = 'shop:second.myshopify.com';
      storeHeader = 'shop:grindctrl.myshopify.com';
      await renderPage();

      expect(screen.getByLabelText('Editing')).toHaveValue('grindctrl.myshopify.com');
    });

    it('falls back to the most recently active shop from a forged remembered store', async () => {
      twoShops();
      storeCookie = 'shop:attacker.myshopify.com';
      await renderPage();

      expect(screen.getByLabelText('Editing')).toHaveValue('grindctrl.myshopify.com');
      expect(screen.queryByRole('option', { name: 'attacker.myshopify.com' })).not.toBeInTheDocument();
    });
  });

  it("falls back to the merchant's own shop for an unknown shop", async () => {
    await renderPage('attacker.myshopify.com');

    expect(screen.getByLabelText('Editing')).toHaveValue('grindctrl.myshopify.com');
    expect(screen.queryByRole('option', { name: 'attacker.myshopify.com' })).not.toBeInTheDocument();
  });

  it.each(['en', 'ar'] as const)('does not render provider spend or per-job costs in %s', async (locale) => {
    cookieLocale = locale;
    vi.mocked(listRecentTryOnJobs).mockResolvedValueOnce([null, 0, 0.02].map((cost, index) => ({
      id: `job-${index}`, product_id: `product-${index}`, shop: 'grindctrl.myshopify.com',
      status: 'completed', provider: 'test', cost_usd: cost, duration_ms: 1000, message: null,
      created_at: '2026-07-18T08:00:00Z',
    })));
    await renderPage();
    const copy = getTryOnDashboardCopy(locale);

    expect(screen.queryByText(copy.providerSpend)).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: copy.columnCost })).not.toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: copy.costUnreported })).not.toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: '$0.0000' })).not.toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: '$0.0200' })).not.toBeInTheDocument();
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

describe('DashboardTryOnPage, v16', () => {
  const NOW = Date.parse('2026-10-22T12:00:00Z');
  const results = getTryOnResultsCopy('en');

  beforeEach(() => {
    vi.mocked(storeFlags).mockResolvedValue(['v16_dashboard']);
    vi.mocked(getTryOnResultsFacts).mockReset().mockResolvedValue({
      now: NOW,
      period: 30,
      live: true,
      jobs: [{ product_id: 'layla-abaya', status: 'completed', duration_ms: 14_000, message: null, created_at: '2026-10-21T12:00:00Z' }],
      products: {},
    });
  });
  afterEach(() => vi.mocked(storeFlags).mockResolvedValue([]));

  it('opens on Results from the active shop’s own looks, for the period in the link', async () => {
    await renderPage(undefined, { period: '7' });
    expect(getTryOnResultsFacts).toHaveBeenCalledWith({ shop: 'grindctrl.myshopify.com', period: 7 });
    const tabs = screen.getByRole('navigation', { name: results.tabsLabel });
    expect(within(tabs).getByRole('link', { name: results.results })).toHaveAttribute('aria-current', 'page');
    expect(within(tabs).getByRole('link', { name: results.setUp })).toHaveAttribute('href', '/dashboard/try-on/setup');
    expect(screen.getByText(results.looksMade)).toBeInTheDocument();
    expect(screen.getAllByText('Layla abaya')).toHaveLength(2); // by product and recent looks
    expect(screen.queryByLabelText('Editing')).not.toBeInTheDocument();
  });

  it('draws TryOnStudio as Set up for an owner, under the same tabs and badge', async () => {
    render(await DashboardTryOnSetupPage({ searchParams: Promise.resolve({}) }));
    expect(getTryOnResultsFacts).not.toHaveBeenCalled();
    const tabs = screen.getByRole('navigation', { name: results.tabsLabel });
    expect(within(tabs).getByRole('link', { name: results.setUp })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText(results.liveOnStore)).toBeInTheDocument();
    const studio = getTryOnStudioCopy('en');
    expect(screen.getByText(studio.subtitle)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: studio.button })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: studio.moveInThemeEditor })).toHaveAttribute(
      'href',
      'https://admin.shopify.com/store/grindctrl/themes/current/editor?template=product',
    );
    // Today's page (the shop picker, the tables) is not under v16; the Shopify app and connecting a store stay.
    expect(screen.queryByLabelText('Editing')).not.toBeInTheDocument();
    const c = getTryOnDashboardCopy('en');
    expect(screen.getByRole('link', { name: c.openShopifyApp })).toHaveAttribute(
      'href',
      `https://admin.shopify.com/store/grindctrl/apps/${SHOPIFY_APP_CLIENT_ID}`,
    );
    expect(screen.getByRole('button', { name: c.connectAnotherStore })).toBeInTheDocument();
  });

  it('offers nothing to save when the settings cannot be read', async () => {
    vi.mocked(getTryOnSettingsForEdit).mockRejectedValueOnce(new Error('timeout'));
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(await DashboardTryOnSetupPage({ searchParams: Promise.resolve({}) }));
    const studio = getTryOnStudioCopy('en');
    expect(screen.getByRole('status')).toHaveTextContent(studio.couldNotLoad);
    expect(screen.queryByRole('heading', { name: studio.button })).not.toBeInTheDocument();
    expect(error).toHaveBeenCalledWith('[try-on set up] settings failed:', 'timeout');
    error.mockRestore();
  });

  it('sends a member to Results, which has no Set up tab', async () => {
    const member = { domain: 'grindctrl.myshopify.com', status: 'installed' as const, installedAt: '2026-01-01T00:00:00.000Z', uninstalledAt: null, lastSeenAt: '2026-01-01T00:00:00.000Z', jobCount: 0, lastJobAt: null, role: 'member' as const };
    vi.mocked(listManagedTryOnShops).mockResolvedValueOnce([member]).mockResolvedValueOnce([member]);
    await expect(DashboardTryOnSetupPage({ searchParams: Promise.resolve({}) })).rejects.toThrow('redirect:/dashboard/try-on');
    await renderPage();
    const tabs = screen.getByRole('navigation', { name: results.tabsLabel });
    expect(within(tabs).queryByRole('link', { name: results.setUp })).not.toBeInTheDocument();
  });

  it('says so when the looks cannot be read', async () => {
    vi.mocked(getTryOnResultsFacts).mockRejectedValue(new Error('down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await renderPage();
    expect(screen.getByRole('status')).toHaveTextContent(results.couldNotLoad);
  });

  it('draws today’s page with no tabs when the flag is off, on either route', async () => {
    vi.mocked(storeFlags).mockResolvedValue([]);
    await renderPage();
    expect(getTryOnResultsFacts).not.toHaveBeenCalled();
    expect(screen.queryByRole('navigation', { name: results.tabsLabel })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Editing')).toBeInTheDocument();
    cleanup();

    render(await DashboardTryOnSetupPage({ searchParams: Promise.resolve({}) }));
    expect(screen.queryByRole('navigation', { name: results.tabsLabel })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Editing')).toBeInTheDocument();
  });
});
