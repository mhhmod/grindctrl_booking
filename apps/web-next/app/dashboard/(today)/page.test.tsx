import React from 'react';
import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardOverviewPage from './page';
import { getRequestLocale } from '@/lib/auth/locale';
import { storeFlags } from '@/lib/flags/store-flags';
import { getTodayFacts } from '@/lib/dashboard/today-data';
import { getTodaySetupFacts } from '@/lib/dashboard/today-setup-data';
import { getActiveStore, getActiveStoreRole } from '@/lib/dashboard/active-store-server';
import { createPreviewLink, setLaunchState } from '@/app/dashboard/try-on/launch-actions';
import { renderWithMantine } from '@/components/mantine/test-utils';

vi.mock('@/lib/auth/locale', () => ({ getRequestLocale: vi.fn() }));
vi.mock('@/lib/dashboard/active-store-server', () => ({
  getActiveStore: vi.fn(async () => ({ shopDomain: 'alpha.myshopify.com', siteId: null })),
  getActiveStoreTimeZone: vi.fn(async () => 'Africa/Cairo'),
  getActiveStoreRole: vi.fn(async () => 'owner'),
}));
vi.mock('@/lib/flags/store-flags', () => ({ storeFlags: vi.fn(async () => []) }));
vi.mock('@/lib/dashboard/today-data', () => ({ getTodayFacts: vi.fn() }));
vi.mock('@/lib/dashboard/today-setup-data', () => ({ getTodaySetupFacts: vi.fn(async () => null) }));
vi.mock('@/app/dashboard/try-on/launch-actions', () => ({ setLaunchState: vi.fn(), createPreviewLink: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/app/dashboard/connect-shop/actions', () => ({ generateShopLinkCode: vi.fn() }));

const FACTS = {
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
};

beforeEach(() => {
  vi.mocked(getRequestLocale).mockResolvedValue('en');
  vi.mocked(storeFlags).mockClear().mockResolvedValue([]);
  vi.mocked(getTodayFacts).mockReset().mockResolvedValue(FACTS);
});

describe('DashboardOverviewPage, v16 Today', () => {
  it('draws the v16 Today for any store, with no flag to switch it on', async () => {
    renderWithMantine(await DashboardOverviewPage());
    expect(getTodayFacts).toHaveBeenCalledWith(
      expect.objectContaining({ activeStore: { shopDomain: 'alpha.myshopify.com', siteId: null }, role: 'owner', timeZone: 'Africa/Cairo' }),
    );
    expect(screen.getByRole('heading', { name: 'Needs you' })).toBeInTheDocument();
    expect(screen.getByText('1 shopper wants a person')).toBeInTheDocument();
  });

  it('draws it for a Store Chat site on another website too, keyed on the site’s flags', async () => {
    vi.mocked(getActiveStore).mockResolvedValueOnce({ shopDomain: null, siteId: 'site_1' });
    renderWithMantine(await DashboardOverviewPage());
    expect(storeFlags).toHaveBeenCalledWith({ widgetSiteId: 'site_1' });
    expect(screen.getByRole('heading', { name: 'Needs you' })).toBeInTheDocument();
  });

  it('draws it for a paired WooCommerce store, with the store passed on so its tenant is read', async () => {
    const woo = { shopDomain: null, siteId: 'site_1', tenantKey: 'site:11111111-1111-4111-8111-111111111111', platform: 'woocommerce' as const };
    vi.mocked(getActiveStore).mockResolvedValueOnce(woo);
    renderWithMantine(await DashboardOverviewPage());
    expect(storeFlags).toHaveBeenCalledWith({ widgetSiteId: 'site_1' });
    expect(getTodayFacts).toHaveBeenCalledWith(expect.objectContaining({ activeStore: woo, timeZone: 'Africa/Cairo' }));
    expect(screen.getByRole('heading', { name: 'Needs you' })).toBeInTheDocument();
  });

  it.each([
    ['en', 'Connect your first store', 'Set up Store Chat on your website'],
    ['ar', 'اربط متجرك الأول', 'فعّل دردشة المتجر على موقعك'],
  ] as const)('tells a new account with no store how to connect one, in %s, without reading any facts', async (locale, title, chat) => {
    vi.mocked(getRequestLocale).mockResolvedValue(locale);
    vi.mocked(getActiveStore).mockResolvedValueOnce({ shopDomain: null, siteId: null });
    renderWithMantine(await DashboardOverviewPage());
    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: chat })).toHaveAttribute('href', '/dashboard/store-chat');
    expect(getTodayFacts).not.toHaveBeenCalled();
    expect(storeFlags).not.toHaveBeenCalled();
  });
});

describe('DashboardOverviewPage, v16 Today while setting up', () => {
  const SETUP = {
    store: 'Maison Noor',
    shop: 'alpha.myshopify.com',
    chatSeenAt: '2026-10-02T10:58:00Z',
    storeLook: false,
    testLook: false,
    holdoutAvailable: true,
  };

  it('draws the setup checklist for the owner of a store not live yet, with the launch actions', async () => {
    vi.mocked(getRequestLocale).mockResolvedValue('en');
    vi.mocked(storeFlags).mockResolvedValue(['v16_dashboard', 'n5_preview_mode', 'n6_holdout']);
    vi.mocked(getTodaySetupFacts).mockResolvedValueOnce(SETUP);
    vi.mocked(getTodayFacts).mockClear();
    renderWithMantine(await DashboardOverviewPage());
    expect(getTodaySetupFacts).toHaveBeenCalledWith({
      activeStore: { shopDomain: 'alpha.myshopify.com', siteId: null },
      holdoutAvailable: true,
    });
    expect(screen.getByRole('heading', { level: 2, name: 'Get Maison Noor live' })).toBeInTheDocument();
    expect(screen.getByText('3 steps left, about 6 minutes')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '50/50 test' })).toBeInTheDocument();
    expect(getTodayFacts).not.toHaveBeenCalled();
    expect(vi.mocked(setLaunchState)).not.toHaveBeenCalled();
    expect(vi.mocked(createPreviewLink)).not.toHaveBeenCalled();
  });

  it('keeps Today for a live store, without n5_preview_mode, and for a member', async () => {
    vi.mocked(getRequestLocale).mockResolvedValue('en');
    vi.mocked(getTodayFacts).mockResolvedValue({ now: Date.parse('2026-10-02T11:00:00Z'), timeZone: 'Africa/Cairo', canBilling: true, tryOn: null, chat: null });

    vi.mocked(storeFlags).mockResolvedValue(['v16_dashboard', 'n5_preview_mode']);
    vi.mocked(getTodaySetupFacts).mockResolvedValueOnce(null);
    renderWithMantine(await DashboardOverviewPage());
    expect(screen.queryByRole('heading', { name: /live$/ })).not.toBeInTheDocument();

    vi.mocked(getTodaySetupFacts).mockClear();
    vi.mocked(storeFlags).mockResolvedValue(['v16_dashboard']);
    renderWithMantine(await DashboardOverviewPage());
    expect(getTodaySetupFacts).not.toHaveBeenCalled();

    vi.mocked(storeFlags).mockResolvedValue(['v16_dashboard', 'n5_preview_mode']);
    vi.mocked(getActiveStoreRole).mockResolvedValueOnce('member');
    renderWithMantine(await DashboardOverviewPage());
    expect(getTodaySetupFacts).not.toHaveBeenCalled();
    expect(getTodayFacts).toHaveBeenCalledTimes(3);
  });
});
