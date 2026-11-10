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

vi.mock('@/lib/messenger/provisioning', () => ({ listMessengerSitesReadOnly: vi.fn(async () => []) }));
const woo = vi.hoisted(() => ({ active: new Set<string>(), homeUrl: 'https://shop.example.com' }));
vi.mock('@/lib/woo/connection', () => ({
  listActiveWooSiteIds: vi.fn(async () => woo.active),
  getActiveWooSiteContext: vi.fn(async () => ({ homeUrl: woo.homeUrl, timezone: 'Africa/Cairo' })),
}));
const paste = vi.hoisted(() => ({ active: new Set<string>() }));
vi.mock('@/lib/paste/store', () => ({ listActivePasteSiteIds: vi.fn(async () => paste.active) }));
vi.mock('@/lib/paste/status', () => ({ readPasteCodeOutdated: vi.fn(async () => false) }));
vi.mock('@/app/dashboard/connect-shop/actions', () => ({ generateShopLinkCode: vi.fn() }));

/* The v16 Try-On: its facts are covered in
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
/* Set up reads strictly: a failed read must not show the defaults a save
   would write. */
vi.mock('@/lib/try-on/settings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/try-on/settings')>();
  return { ...actual, getTryOnSettingsForEdit: vi.fn(async () => actual.DEFAULT_SETTINGS) };
});

import DashboardTryOnPage from '@/app/dashboard/try-on/page';
import DashboardTryOnSetupPage from '@/app/dashboard/try-on/setup/page';
import { listManagedTryOnShops } from '@/lib/shopify/shops';
import { listMessengerSitesReadOnly } from '@/lib/messenger/provisioning';
import { getTryOnDashboardCopy } from '@/lib/try-on/dashboard-copy';
import { shopifyAdminAppUrl } from '@/lib/shopify/app-identity';
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
  woo.active = new Set();
  session.auth.mockReset().mockResolvedValue({ userId: 'user_merchant' });
  vi.mocked(listManagedTryOnShops).mockResolvedValue([ownedShop('grindctrl.myshopify.com')]);
  vi.mocked(listMessengerSitesReadOnly).mockResolvedValue([]);
  vi.mocked(getTryOnSettingsForEdit).mockClear();
  vi.stubEnv('TRYON_PLATFORM_OPERATOR_CLERK_IDS', '');
});
afterEach(() => vi.unstubAllEnvs());

async function renderPage(shop?: string, query: { period?: string } = {}) {
  render(await DashboardTryOnPage({ searchParams: Promise.resolve({ shop, ...query }) }));
}

const ownedShop = (domain: string, role: 'owner' | 'admin' | 'member' = 'owner') => ({
  domain, status: 'installed' as const, installedAt: '2026-01-01T00:00:00.000Z', uninstalledAt: null,
  lastSeenAt: '2026-01-01T00:00:00.000Z', jobCount: 0, lastJobAt: null, role,
});
const SITE_ID = '11111111-1111-4111-8111-111111111111';

describe('DashboardTryOnPage, the store it opens on', () => {
  const NOW = Date.parse('2026-10-22T12:00:00Z');
  const heading = (name: string) => screen.getByRole('heading', { name });

  beforeEach(() => {
    vi.mocked(storeFlags).mockResolvedValue([]);
    vi.mocked(getTryOnResultsFacts).mockReset().mockResolvedValue({ now: NOW, period: 30, live: true, jobs: [], products: {} });
  });

  it('opens on the store chosen last, and links the merchant’s own shops, never a forged selection', async () => {
    vi.mocked(listManagedTryOnShops).mockResolvedValue([ownedShop('grindctrl.myshopify.com'), ownedShop('second.myshopify.com')]);
    storeCookie = 'shop:second.myshopify.com';
    await renderPage();
    expect(getTryOnResultsFacts).toHaveBeenLastCalledWith({ shop: 'second.myshopify.com', period: 30 });

    storeHeader = 'shop:grindctrl.myshopify.com';
    await renderPage();
    expect(getTryOnResultsFacts).toHaveBeenLastCalledWith({ shop: 'grindctrl.myshopify.com', period: 30 });

    storeHeader = undefined;
    storeCookie = 'shop:attacker.myshopify.com';
    await renderPage('attacker.myshopify.com');
    expect(getTryOnResultsFacts).toHaveBeenLastCalledWith({ shop: 'grindctrl.myshopify.com', period: 30 });
  });

  it.each([
    ['en', 'Connect your store to turn on Try-On'],
    ['ar', 'اربط متجرك لتشغيل التجربة الافتراضية'],
  ] as const)('tells an account with no store to connect a Shopify store, in %s, and never reads shop data', async (locale, title) => {
    cookieLocale = locale;
    vi.mocked(listManagedTryOnShops).mockResolvedValue([]);
    await renderPage();
    expect(heading(title)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: getTryOnDashboardCopy(locale).connectStore })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: getTryOnResultsCopy(locale).tabsLabel })).not.toBeInTheDocument();
    expect(getTryOnResultsFacts).not.toHaveBeenCalled();
  });

  it('tells a Store Chat site on another website the same, and offers the Shopify store it already has', async () => {
    vi.mocked(listManagedTryOnShops).mockResolvedValue([ownedShop('second.myshopify.com')]);
    vi.mocked(listMessengerSitesReadOnly).mockResolvedValue([{ id: SITE_ID, name: 'Kids', domain: 'kids.example', role: 'owner' }] as never);
    storeCookie = `site:${SITE_ID}`;
    await renderPage();
    expect(heading('Connect your store to turn on Try-On')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Switch to second' })).toHaveAttribute('href', '/dashboard/try-on?shop=second.myshopify.com');
    expect(screen.getByRole('button', { name: getTryOnDashboardCopy('en').connectAnotherStore })).toBeInTheDocument();
    expect(getTryOnResultsFacts).not.toHaveBeenCalled();
    vi.mocked(listMessengerSitesReadOnly).mockResolvedValue([]);
  });

  it('draws the same state for Set up', async () => {
    vi.mocked(listManagedTryOnShops).mockResolvedValue([]);
    render(await DashboardTryOnSetupPage({ searchParams: Promise.resolve({}) }));
    expect(heading('Connect your store to turn on Try-On')).toBeInTheDocument();
    expect(getTryOnSettingsForEdit).not.toHaveBeenCalled();
  });

  it('survives a failed shop list as no shops, since the layout shows the retry', async () => {
    vi.mocked(listManagedTryOnShops).mockRejectedValue(new Error('db down'));
    await renderPage();
    expect(heading('Connect your store to turn on Try-On')).toBeInTheDocument();
  });
});

describe('DashboardTryOnPage for a paired WooCommerce store', () => {
  const NOW = Date.parse('2026-10-22T12:00:00Z');
  const KEY = `site:${SITE_ID}`;

  beforeEach(() => {
    vi.mocked(listManagedTryOnShops).mockResolvedValue([]);
    vi.mocked(listMessengerSitesReadOnly).mockResolvedValue([{ id: SITE_ID, name: 'Kids', domain: 'kids.example', role: 'owner' }] as never);
    woo.active = new Set([SITE_ID]);
    storeCookie = `site:${SITE_ID}`;
    vi.mocked(storeFlags).mockResolvedValue([]);
    vi.mocked(getTryOnResultsFacts).mockReset().mockResolvedValue({ now: NOW, period: 30, live: true, jobs: [], products: {} });
  });

  it('reads Results under the site tenant instead of asking to connect a store', async () => {
    await renderPage();
    expect(getTryOnResultsFacts).toHaveBeenLastCalledWith({ shop: KEY, period: 30 });
    expect(screen.queryByRole('heading', { name: 'Connect your store to turn on Try-On' })).not.toBeInTheDocument();
  });

  it('draws Set up with the WordPress editors, never the Shopify theme editor or app', async () => {
    render(await DashboardTryOnSetupPage({ searchParams: Promise.resolve({}) }));
    const studio = getTryOnStudioCopy('en');
    expect(getTryOnSettingsForEdit).toHaveBeenCalledWith(KEY);
    expect(screen.getByRole('link', { name: studio.moveInSiteEditor })).toHaveAttribute('href', 'https://shop.example.com/wp-admin/site-editor.php');
    expect(screen.getByRole('link', { name: studio.moveInCustomizer })).toHaveAttribute('href', 'https://shop.example.com/wp-admin/customize.php');
    expect(screen.queryByRole('link', { name: studio.moveInThemeEditor })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: getTryOnDashboardCopy('en').openShopifyApp })).not.toBeInTheDocument();
  });

  it('never offers the Shopify app to a store installed by pasting the code', async () => {
    woo.active = new Set();
    paste.active = new Set([SITE_ID]);
    try {
      render(await DashboardTryOnSetupPage({ searchParams: Promise.resolve({}) }));
    } finally {
      paste.active = new Set();
    }
    expect(getTryOnSettingsForEdit).toHaveBeenCalledWith(KEY);
    expect(screen.queryByRole('link', { name: getTryOnDashboardCopy('en').openShopifyApp })).not.toBeInTheDocument();
  });

  it('keeps Set up for owners and admins: a member goes back to Results', async () => {
    vi.mocked(listMessengerSitesReadOnly).mockResolvedValue([{ id: SITE_ID, name: 'Kids', domain: 'kids.example', role: 'member' }] as never);
    await expect(DashboardTryOnSetupPage({ searchParams: Promise.resolve({}) })).rejects.toThrow('redirect:/dashboard/try-on');
  });

  it('asks to connect a store when the site has no active connection', async () => {
    woo.active = new Set();
    await renderPage();
    expect(screen.getByRole('heading', { name: 'Connect your store to turn on Try-On' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Connect a WooCommerce store' })).toHaveAttribute('href', '/dashboard/store-chat/setup#install');
    expect(getTryOnResultsFacts).not.toHaveBeenCalled();
  });
});

describe('DashboardTryOnPage, Results and Set up', () => {
  const NOW = Date.parse('2026-10-22T12:00:00Z');
  const results = getTryOnResultsCopy('en');

  beforeEach(() => {
    vi.mocked(listManagedTryOnShops).mockResolvedValue([ownedShop('grindctrl.myshopify.com')]);
    vi.mocked(storeFlags).mockResolvedValue([]);
    vi.mocked(getTryOnSettingsForEdit).mockClear();
    vi.mocked(getTryOnResultsFacts).mockReset().mockResolvedValue({
      now: NOW,
      period: 30,
      live: true,
      jobs: [{ product_id: 'layla-abaya', status: 'completed', duration_ms: 14_000, message: null, created_at: '2026-10-21T12:00:00Z' }],
      products: {},
    });
  });

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
    // The Shopify app and connecting a store stay under Set up.
    const c = getTryOnDashboardCopy('en');
    expect(screen.getByRole('link', { name: c.openShopifyApp })).toHaveAttribute(
      'href',
      shopifyAdminAppUrl('grindctrl.myshopify.com'),
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
    vi.mocked(listManagedTryOnShops).mockResolvedValue([ownedShop('grindctrl.myshopify.com', 'member')]);
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

  it('offers Try it yourself and Go live under Set up while n5_preview_mode is on, and not otherwise', async () => {
    render(await DashboardTryOnSetupPage({ searchParams: Promise.resolve({}) }));
    expect(screen.queryByTestId('launch-card')).not.toBeInTheDocument();
    cleanup();

    vi.mocked(storeFlags).mockResolvedValue(['n5_preview_mode']);
    render(await DashboardTryOnSetupPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByTestId('launch-card')).toBeInTheDocument();
  });
});
