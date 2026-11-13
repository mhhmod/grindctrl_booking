import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/* The v16 Plan page: who may open it and what it renders. The reads, the
   model and the component have their own tests (plan-data, plan-model,
   v16-plan). */
const mocks = vi.hoisted(() => ({
  redirect: vi.fn((href: string) => {
    throw new Error(`redirect:${href}`);
  }),
  user: vi.fn(),
  active: vi.fn(),
  role: vi.fn(),
  timeZone: vi.fn(),
  shops: vi.fn(),
  pending: vi.fn(),
  locale: vi.fn(),
  facts: vi.fn(),
  ensurePlan: vi.fn(),
  currencyCookie: undefined as string | undefined,
}));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => (name === 'gc-currency' && mocks.currencyCookie ? { value: mocks.currencyCookie } : undefined) }),
}));
vi.mock('@/lib/auth/dashboard', () => ({ requireDashboardUser: mocks.user }));
vi.mock('@/lib/auth/locale', () => ({ getRequestLocale: mocks.locale }));
vi.mock('@/lib/dashboard/active-store-server', () => ({
  getActiveStore: mocks.active,
  getActiveStoreRole: mocks.role,
  getActiveStoreTimeZone: mocks.timeZone,
  listDashboardShops: mocks.shops,
  getPendingPasteShop: mocks.pending,
  ensureActiveStorePlan: mocks.ensurePlan,
}));
vi.mock('@/components/dashboard/v16/states', () => ({
  V16FinishConfirming: ({ shop }: { shop: string }) => <div data-testid="finish-confirming">{shop}</div>,
  V16NeedsStore: ({ feature, shops }: { feature: string; shops: Array<{ domain: string }> }) => (
    <div data-testid="needs-shopify">
      {feature}:{shops.map((shop) => shop.domain).join(',')}
    </div>
  ),
}));
vi.mock('@/lib/dashboard/plan-data', () => ({ getPlanFacts: mocks.facts }));
vi.mock('@/components/dashboard/v16/plan/v16-plan', () => ({
  V16Plan: ({ view, locale }: { view: { headline: { left: string }; noPlan: { kind: string; body: string } | null }; locale: string }) => (
    <div data-testid="v16-plan">
      {locale}:{view.headline.left}
      {view.noPlan && <span data-testid="no-plan">{view.noPlan.kind}:{view.noPlan.body}</span>}
    </div>
  ),
  V16PlanError: ({ locale }: { locale: string }) => <div data-testid="v16-plan-error">{locale}</div>,
}));

import DashboardPlanPage from './page';

const SHOP = 'maison.myshopify.com';
const NOW = Date.parse('2026-10-02T12:00:00Z');

beforeEach(() => {
  vi.clearAllMocks();
  mocks.currencyCookie = undefined;
  mocks.user.mockResolvedValue('user_123');
  mocks.active.mockResolvedValue({ shopDomain: SHOP, siteId: 'site_1' });
  mocks.role.mockResolvedValue('owner');
  mocks.timeZone.mockResolvedValue('Africa/Cairo');
  mocks.shops.mockResolvedValue([]);
  mocks.pending.mockResolvedValue(null);
  mocks.locale.mockResolvedValue('en');
  mocks.ensurePlan.mockResolvedValue(null);
  mocks.facts.mockResolvedValue({
    now: NOW,
    timeZone: 'Africa/Cairo',
    plan: {
      planKey: 'growth-v1',
      planName: 'Growth',
      status: 'active',
      isFree: false,
      rendersIncluded: 350,
      topUpCreditsRemaining: 0,
      totalCreditsRemaining: 150,
      currentPeriodStart: '2026-09-18T00:00:00Z',
      currentPeriodEnd: '2026-10-18T00:00:00Z',
      available: true,
    },
    plans: [],
    looks: [],
  });
});

describe('DashboardPlanPage', () => {
  it('shows the owner the plan of the active store, in the store’s time zone', async () => {
    render(await DashboardPlanPage());
    expect(mocks.user).toHaveBeenCalledWith('/dashboard/plan');
    expect(mocks.facts).toHaveBeenCalledWith({ shop: SHOP, siteId: 'site_1', timeZone: 'Africa/Cairo', currency: 'USD' });
    expect(screen.getByTestId('v16-plan')).toHaveTextContent('en:150 left');
    expect(screen.queryByTestId('no-plan')).not.toBeInTheDocument();
  });

  /* The owner's pasted-code Shopify store: proven, no plan, nothing to do. */
  describe('a store with no plan', () => {
    const SITE = '11111111-1111-4111-8111-111111111111';
    const none = { planKey: null, planName: null, status: 'none', isFree: false, rendersIncluded: 0, topUpCreditsRemaining: 0,
      totalCreditsRemaining: 0, currentPeriodStart: null, currentPeriodEnd: null, available: false };
    const noPlanFacts = { now: NOW, timeZone: 'Africa/Cairo', plan: none, plans: [], looks: [] };
    const paste = { shopDomain: null, siteId: SITE, tenantKey: `site:${SITE}`, platform: 'paste' };

    it('claims the free plan before reading the plan, so the first open already shows it', async () => {
      mocks.active.mockResolvedValue(paste);
      render(await DashboardPlanPage());
      expect(mocks.ensurePlan).toHaveBeenCalledExactlyOnceWith(paste);
      expect(mocks.ensurePlan.mock.invocationCallOrder[0]).toBeLessThan(mocks.facts.mock.invocationCallOrder[0]);
      expect(screen.getByTestId('v16-plan')).toHaveTextContent('en:150 left');
    });

    it('sends a pasted-code or WooCommerce store to its connection, the one thing that starts the Free plan', async () => {
      mocks.active.mockResolvedValue(paste);
      mocks.facts.mockResolvedValue(noPlanFacts);
      render(await DashboardPlanPage());
      expect(screen.getByTestId('v16-plan')).toHaveTextContent('en:No looks yet');
      expect(screen.getByTestId('no-plan')).toHaveTextContent('connect:Your Free plan starts by itself once we confirm our code on your store.');
    });

    it('says so when the address already used its free plan on another account, and offers the call', async () => {
      mocks.active.mockResolvedValue(paste);
      mocks.ensurePlan.mockResolvedValue('apex_taken');
      mocks.facts.mockResolvedValue(noPlanFacts);
      render(await DashboardPlanPage());
      expect(screen.getByTestId('no-plan')).toHaveTextContent('call:This store already used its free looks on another GRINDCTRL account');
    });

    it('offers the call to a Shopify app store, which has nothing to connect', async () => {
      mocks.facts.mockResolvedValue(noPlanFacts);
      render(await DashboardPlanPage());
      expect(screen.getByTestId('no-plan')).toHaveTextContent('call:This store has no plan yet.');
    });
  });

  it('lists plans in the currency chosen on the pricing page, ignoring anything else', async () => {
    mocks.currencyCookie = 'EGP';
    render(await DashboardPlanPage());
    expect(mocks.facts).toHaveBeenLastCalledWith(expect.objectContaining({ currency: 'EGP' }));
    mocks.currencyCookie = 'GBP';
    render(await DashboardPlanPage());
    expect(mocks.facts).toHaveBeenLastCalledWith(expect.objectContaining({ currency: 'USD' }));
  });

  it('tells a Store Chat site on another website to connect a Shopify store, and offers the one it has', async () => {
    mocks.active.mockResolvedValue({ shopDomain: null, siteId: 'site_1' });
    mocks.shops.mockResolvedValue([{ domain: 'second.myshopify.com', status: 'installed', lastSeenAt: '2026-10-01T00:00:00Z' }]);
    render(await DashboardPlanPage());
    expect(screen.getByTestId('needs-shopify')).toHaveTextContent('plan:second.myshopify.com');
    expect(mocks.facts).not.toHaveBeenCalled();
  });

  it('points pasted code still being confirmed at the one step left, not at connecting a store', async () => {
    mocks.active.mockResolvedValue({ shopDomain: null, siteId: 'site_1' });
    mocks.pending.mockResolvedValue('maison.myshopify.com');
    render(await DashboardPlanPage());
    expect(screen.getByTestId('finish-confirming')).toHaveTextContent('maison.myshopify.com');
    expect(screen.queryByTestId('needs-shopify')).not.toBeInTheDocument();
    expect(mocks.facts).not.toHaveBeenCalled();
  });

  it('shows a paired WooCommerce store its plan under the site tenant, in its own time zone', async () => {
    const key = 'site:11111111-1111-4111-8111-111111111111';
    const store = { shopDomain: null, siteId: '11111111-1111-4111-8111-111111111111', tenantKey: key, platform: 'woocommerce' };
    mocks.active.mockResolvedValue(store);
    render(await DashboardPlanPage());
    expect(screen.getByTestId('v16-plan')).toBeInTheDocument();
    expect(screen.queryByTestId('needs-shopify')).not.toBeInTheDocument();
    expect(mocks.facts).toHaveBeenLastCalledWith(expect.objectContaining({ shop: key, timeZone: 'Africa/Cairo' }));
    expect(mocks.timeZone).toHaveBeenCalledWith(store);
  });

  it('tells a new account with no store the same, and survives a failed shop list', async () => {
    mocks.active.mockResolvedValue({ shopDomain: null, siteId: null });
    mocks.shops.mockRejectedValue(new Error('db down'));
    render(await DashboardPlanPage());
    expect(screen.getByTestId('needs-shopify')).toHaveTextContent('plan:');
    expect(mocks.facts).not.toHaveBeenCalled();
  });

  it('still sends a member of a store with no shop to Today', async () => {
    mocks.active.mockResolvedValue({ shopDomain: null, siteId: 'site_1' });
    mocks.role.mockResolvedValue('member');
    await expect(DashboardPlanPage()).rejects.toThrow('redirect:/dashboard');
  });

  it.each(['admin', 'member'] as const)('sends an %s to Today on the server, without reading the plan', async (role) => {
    mocks.role.mockResolvedValue(role);
    await expect(DashboardPlanPage()).rejects.toThrow('redirect:/dashboard');
    expect(mocks.facts).not.toHaveBeenCalled();
  });

  it('says the plan could not load when the read fails', async () => {
    mocks.locale.mockResolvedValue('ar');
    mocks.facts.mockRejectedValue(new Error('timeout'));
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(await DashboardPlanPage());
    expect(screen.getByTestId('v16-plan-error')).toHaveTextContent('ar');
    expect(error).toHaveBeenCalledWith('[plan] failed:', 'timeout');
    error.mockRestore();
  });
});
