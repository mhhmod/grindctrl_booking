import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { activatePlan, applyTopUp, renewPlan, scheduleDowngrade, type OwnerPlanActionResult } from '@/app/dashboard/try-on/plan-actions';
import type { CreditPackCatalogItem, PlanCatalogItem, ShopEntitlement } from '@/lib/try-on/entitlement';
import { getTryOnDashboardCopy } from '@/lib/try-on/dashboard-copy';
import { ShopPlanControl } from './shop-plan-control';
import { BOOKING_URL } from '@/lib/booking';

vi.mock('@/app/dashboard/try-on/plan-actions', () => ({
  activatePlan: vi.fn(), applyTopUp: vi.fn(), renewPlan: vi.fn(), scheduleDowngrade: vi.fn(),
}));

const state: ShopEntitlement = {
  shop: 'alpha.myshopify.com', subscriptionId: 'sub', planId: 'p1', planKey: 'launch',
  planName: 'Launch', status: 'grace', isFree: false, rendersIncluded: 300,
  planCreditsRemaining: 280, topUpCreditsRemaining: 0, totalCreditsRemaining: 280,
  currentPeriodStart: '2026-08-01T00:00:00Z', currentPeriodEnd: '2026-09-01T00:00:00Z',
  graceEndsAt: '2026-09-04T00:00:00Z', daysRemaining: 2, bannerState: 'grace',
  available: true, pendingPlanKey: null, pendingPlanEffectiveAt: null, notes: null,
};
const launch: PlanCatalogItem = {
  id: 'p1', planKey: 'launch', name: 'Launch', description: null, priceMinor: 1500,
  currency: 'USD', rendersIncluded: 300, modelKey: 'lite', periodUnit: 'month',
  periodCount: 1, graceDays: 3, isFree: false, active: true, sortOrder: 20,
};
const plans = [launch, { ...launch, id: 'p2', planKey: 'starter', name: 'Starter', rendersIncluded: 100 }];
const packs: CreditPackCatalogItem[] = [{
  id: 'pack', packKey: 'boost', name: 'Boost', priceMinor: 500, currency: 'USD', renders: 80,
  modelKey: 'lite', validityDays: 365, active: true, sortOrder: 10,
}];

function mount(locale: 'en' | 'ar' = 'en') {
  return render(<ShopPlanControl shop={state.shop} state={state} plans={plans} packs={packs} locale={locale} canManagePlan />);
}

function success(replayed = false): OwnerPlanActionResult {
  return { ok: true, actionKey: 'confirmed', replayed, ledgerEntryIds: [], state };
}

beforeEach(() => vi.resetAllMocks());

describe('ShopPlanControl managed-service presentation', () => {
  it.each((['en', 'ar'] as const).flatMap((locale) =>
    [undefined, false].map((canManagePlan) => ({ locale, canManagePlan })),
  ))('keeps plan information read-only in $locale when permission is $canManagePlan', ({ locale, canManagePlan }) => {
    const c = getTryOnDashboardCopy(locale);
    render(<ShopPlanControl shop={state.shop} state={{ ...state, topUpCreditsRemaining: 20, totalCreditsRemaining: 300 }}
      plans={plans} packs={packs} locale={locale} canManagePlan={canManagePlan} />);
    expect(screen.getByText('Launch')).toBeInTheDocument();
    expect(screen.getByText(c.planStatusGrace)).toBeInTheDocument();
    expect(screen.getByText(c.planRendersLeft(280, 300))).toBeInTheDocument();
    expect(screen.getByText(c.plusFromTopUps(20))).toBeInTheDocument();
    expect(screen.getByText(c.managedBannerGrace(2))).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent(c.managedServiceBody);
    expect(screen.getByRole('link', { name: c.bookServiceCall })).toHaveAttribute('href', BOOKING_URL);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByText(c.bannerGrace(2))).not.toBeInTheDocument();
    expect(activatePlan).not.toHaveBeenCalled();
    expect(renewPlan).not.toHaveBeenCalled();
    expect(applyTopUp).not.toHaveBeenCalled();
    expect(scheduleDowngrade).not.toHaveBeenCalled();
  });

  it.each(['en', 'ar'] as const)('shows manual controls only after explicit operator permission in %s', (locale) => {
    const c = getTryOnDashboardCopy(locale);
    mount(locale);
    expect(screen.getByLabelText(c.paymentReference)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: c.activateOrUpgrade })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: c.renew })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: c.addTopUp })).toBeInTheDocument();
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });
});

describe('ShopPlanControl safe action results', () => {
  const cases = (['en', 'ar'] as const).flatMap((locale) =>
    (['rate_limited', 'unavailable', 'forbidden'] as const).map((code) => ({ locale, code })),
  );

  it.each(cases)('renders $code in $locale without leaking backend text or claiming success', async ({ locale, code }) => {
    vi.mocked(activatePlan).mockResolvedValue({ ok: false, code, retryAfterSeconds: 21, message: 'INTERNAL_OPERATOR_CONFIG' });
    const c = getTryOnDashboardCopy(locale);
    mount(locale);
    fireEvent.change(screen.getByLabelText(c.paymentReference), { target: { value: 'payment-123' } });
    fireEvent.click(screen.getByRole('button', { name: c.activateOrUpgrade }));
    const expected = code === 'rate_limited' ? c.actionRateLimited(21)
      : code === 'unavailable' ? c.actionUnavailable(21) : c.actionForbidden;
    expect(await screen.findByRole('alert')).toHaveTextContent(expected);
    expect(screen.getByLabelText(c.paymentReference)).toHaveValue('payment-123');
    expect(screen.getByRole('button', { name: c.activateOrUpgrade })).toBeEnabled();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('INTERNAL_OPERATOR_CONFIG');
    expect(activatePlan).toHaveBeenCalledTimes(1);
  });

  it.each(['renew', 'top-up', 'downgrade'] as const)('handles a typed %s failure consistently', async (action) => {
    const failure = { ok: false as const, code: 'rate_limited' as const, retryAfterSeconds: 12, message: 'PRIVATE' };
    const c = getTryOnDashboardCopy('en');
    vi.mocked(renewPlan).mockResolvedValue(failure);
    vi.mocked(applyTopUp).mockResolvedValue(failure);
    vi.mocked(scheduleDowngrade).mockResolvedValue(failure);
    mount();
    if (action === 'downgrade') fireEvent.change(screen.getByLabelText(c.planLabel), { target: { value: 'starter' } });
    const label = action === 'renew' ? c.renew : action === 'top-up' ? c.addTopUp : c.scheduleDowngrade;
    fireEvent.click(screen.getByRole('button', { name: label }));
    expect(await screen.findByRole('alert')).toHaveTextContent(c.actionRateLimited(12));
    expect(screen.getByRole('button', { name: label })).toBeEnabled();
  });

  it('reuses the action key after an ambiguous response, then clears it after confirmed replay', async () => {
    vi.mocked(applyTopUp)
      .mockResolvedValueOnce({ ok: false, code: 'unavailable', message: 'PRIVATE' })
      .mockResolvedValueOnce(success(true))
      .mockResolvedValueOnce(success());
    const c = getTryOnDashboardCopy('en');
    mount();
    fireEvent.change(screen.getByLabelText(c.paymentReference), { target: { value: 'payment-123' } });
    fireEvent.click(screen.getByRole('button', { name: c.addTopUp }));
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: c.addTopUp }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(c.actionReplayed));
    const calls = vi.mocked(applyTopUp).mock.calls;
    expect(calls[0][0].actionKey).toBe(calls[1][0].actionKey);
    expect(calls[0][0].note).toBe('payment-123');
    expect(calls[1][0].note).toBe('payment-123');
    expect(screen.getByLabelText(c.paymentReference)).toHaveValue('');

    fireEvent.change(screen.getByLabelText(c.paymentReference), { target: { value: 'payment-123' } });
    fireEvent.click(screen.getByRole('button', { name: c.addTopUp }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(c.actionApplied(c.actionTopUp)));
    expect(calls[2][0].actionKey).not.toBe(calls[1][0].actionKey);
  });

  it('uses generic copy for unexpected rejection and keeps the retry key', async () => {
    vi.mocked(activatePlan).mockRejectedValue(new Error('PRIVATE_SERVICE_ROLE_KEY'));
    const c = getTryOnDashboardCopy('en');
    mount();
    fireEvent.click(screen.getByRole('button', { name: c.activateOrUpgrade }));
    expect(await screen.findByRole('alert')).toHaveTextContent(c.actionFailed);
    fireEvent.click(screen.getByRole('button', { name: c.activateOrUpgrade }));
    await screen.findByRole('alert');
    expect(document.body).not.toHaveTextContent('PRIVATE_SERVICE_ROLE_KEY');
    const calls = vi.mocked(activatePlan).mock.calls;
    expect(calls[0][0].actionKey).toBe(calls[1][0].actionKey);
  });
});
