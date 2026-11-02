// @vitest-environment jsdom
import React from 'react';
import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithMantine } from '@/components/mantine/test-utils';
import type { PlanCatalogItem } from '@/lib/try-on/entitlement';
import type { ShopifyAppPricingPresentation } from '@/lib/shopify/app-pricing';
import { ShopifyPlans } from './plans';
import { shopifyPlansCopy } from './plans-copy';
import type { MerchantPlan } from './merchant-plan-card';

const { sessionToken } = vi.hoisted(() => ({ sessionToken: vi.fn() }));
vi.mock('@/lib/shopify/app-bridge-client', () => ({ getShopifySessionToken: sessionToken }));

function catalogPlan(name: string, priceMinor: number, rendersIncluded: number): PlanCatalogItem {
  return {
    id: name, planKey: name.toLowerCase(), name, priceMinor, rendersIncluded,
    description: null, currency: 'USD', isFree: priceMinor === 0, active: true,
    modelKey: 'test', periodUnit: 'month', periodCount: 1, graceDays: 0, sortOrder: priceMinor,
  };
}
const catalog = [catalogPlan('Free', 0, 15), catalogPlan('Launch', 1500, 150), catalogPlan('Growth', 2900, 350), catalogPlan('Pro', 4900, 650)];
const plan: MerchantPlan = {
  planName: 'Growth', status: 'active', rendersIncluded: 350, planCreditsRemaining: 137,
  totalCreditsRemaining: 142, topUpCreditsRemaining: 5, currentPeriodEnd: '2026-11-15T00:00:00Z',
  graceEndsAt: null, daysRemaining: 12, bannerState: 'none',
};
const pricingUrl = 'https://admin.shopify.com/store/real-shop/charges/grindctrl/pricing_plans';
const shop = 'real-shop.myshopify.com';
function pricing(distribution: ShopifyAppPricingPresentation['distribution'], url: string | null = pricingUrl): ShopifyAppPricingPresentation {
  return { distribution, pricingPlansUrl: url, plans: catalog };
}

describe('Shopify Plans', () => {
  beforeEach(() => {
    sessionToken.mockResolvedValue('verified-session-token');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ shop, plan }), { status: 200 })));
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

  it.each(['en', 'ar'] as const)('uses Shopify hosted pricing for public installs in %s', async (locale) => {
    const c = shopifyPlansCopy[locale];
    const { container } = renderWithMantine(<ShopifyPlans locale={locale} appPricing={pricing('public')} onRetry={vi.fn()} />);
    const link = await screen.findByRole('link', { name: c.changePlan });
    expect(link).toHaveAttribute('href', pricingUrl);
    expect(link).toHaveAttribute('target', '_top');
    expect(screen.queryByRole('link', { name: c.askForPlan })).not.toBeInTheDocument();
    expect(screen.getByText(c.looksLeft(142))).toBeVisible();
    expect(screen.getByText(c.includedRemaining(137, 350))).toBeVisible();
    expect(screen.getByText(c.addedLooks(5))).toBeVisible();
    expect(screen.getByRole('progressbar', { name: c.looksUsed })).toHaveAttribute('aria-valuenow', String((213 / 350) * 100));
    expect(container.querySelector('[lang]')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
    expect(screen.getByRole('heading', { name: 'Free' })).toBeVisible();
    expect(fetch).toHaveBeenCalledWith('/api/shopify/admin/settings', { headers: { Authorization: 'Bearer verified-session-token' } });
  });

  it.each(['en', 'ar'] as const)('shows only the current plan when a public app handle is unresolved in %s', async (locale) => {
    const c = shopifyPlansCopy[locale];
    renderWithMantine(<ShopifyPlans locale={locale} appPricing={pricing('public', null)} onRetry={vi.fn()} />);
    expect(await screen.findByText('Growth')).toBeVisible();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: c.comparePlans })).not.toBeInTheDocument();
  });

  it.each([
    ['custom', 'en'], ['custom', 'ar'], ['development', 'en'], ['development', 'ar'],
  ] as const)('offers manual paid plans and Free for %s installs in %s', async (distribution, locale) => {
    const c = shopifyPlansCopy[locale];
    renderWithMantine(<ShopifyPlans locale={locale} appPricing={pricing(distribution)} onRetry={vi.fn()} />);
    const links = await screen.findAllByRole('link', { name: c.askForPlan });
    expect(links).toHaveLength(3);
    expect(screen.getByText(c.freeAvailable)).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Free' })).toBeVisible();
    expect(screen.queryByRole('link', { name: c.changePlan })).not.toBeInTheDocument();
    for (const [index, link] of links.entries()) {
      const selectedPlan = catalog[index + 1];
      const url = new URL(link.getAttribute('href')!);
      expect(url.protocol).toBe('mailto:');
      expect(url.pathname).toBe('grindctrlnow@gmail.com');
      expect(url.searchParams.get('subject')).toBe(c.requestSubject(shop, selectedPlan.name));
      expect(url.searchParams.get('body')).toContain(shop);
      expect(url.searchParams.get('body')).toContain(selectedPlan.name);
    }
  });

  it('renders prices and allowances from the supplied live catalog', async () => {
    const appPricing = { ...pricing('public'), plans: [catalogPlan('Launch', 2199, 222)] };
    renderWithMantine(<ShopifyPlans locale="en" appPricing={appPricing} onRetry={vi.fn()} />);
    const comparison = await screen.findByRole('region', { name: 'Compare plans' });
    expect(within(comparison).getByText('$21.99')).toBeVisible();
    expect(within(comparison).getByText('222 looks, Store Chat included.')).toBeVisible();
  });

  it.each(['en', 'ar'] as const)('fails closed and offers retry when bootstrap metadata is missing in %s', (locale) => {
    const onRetry = vi.fn();
    const c = shopifyPlansCopy[locale];
    renderWithMantine(<ShopifyPlans locale={locale} appPricing={null} onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent(c.unavailable);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: c.retry }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('shows loading while the current entitlement is read', () => {
    vi.mocked(fetch).mockReturnValue(new Promise(() => {}));
    renderWithMantine(<ShopifyPlans locale="en" appPricing={pricing('public')} onRetry={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading plans…');
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('shows an error rather than a default plan when current entitlement cannot be read', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 503 }));
    renderWithMantine(<ShopifyPlans locale="en" appPricing={pricing('public')} onRetry={vi.fn()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load your plans');
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByText('Free')).not.toBeInTheDocument();
  });
});
