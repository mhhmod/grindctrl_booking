import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ rpc: rpcMock })),
}));

import {
  addCalendarPeriod,
  calculateUpgradeGrant,
  ensureFreeSubscription,
  getBannerState,
  reserveCredit,
  sortCreditLotsForConsumption,
  TryOnUnavailableError,
} from './entitlement';

describe('try-on entitlement helpers', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    rpcMock.mockReset();
  });

  it('applies reminder and credit thresholds in priority order', () => {
    expect(getBannerState({
      status: 'grace',
      isFree: false,
      rendersIncluded: 300,
      totalCreditsRemaining: 0,
      daysRemaining: 2,
    })).toBe('grace');
    expect(getBannerState({
      status: 'active',
      isFree: false,
      rendersIncluded: 300,
      totalCreditsRemaining: 0,
      daysRemaining: 3,
    })).toBe('urgent');
    expect(getBannerState({
      status: 'active',
      isFree: false,
      rendersIncluded: 300,
      totalCreditsRemaining: 80,
      daysRemaining: 7,
    })).toBe('renewal_due');
    expect(getBannerState({
      status: 'active',
      isFree: true,
      rendersIncluded: 20,
      totalCreditsRemaining: 0,
      daysRemaining: 1,
    })).toBe('exhausted');
    expect(getBannerState({
      status: 'active',
      isFree: true,
      rendersIncluded: 20,
      totalCreditsRemaining: 2,
      daysRemaining: 20,
    })).toBe('critical');
    expect(getBannerState({
      status: 'active',
      isFree: true,
      rendersIncluded: 20,
      totalCreditsRemaining: 5,
      daysRemaining: 20,
    })).toBe('low');
  });

  it('clamps month ends and returns to the original anchor day', () => {
    const anchor = new Date('2024-01-31T10:15:30.000Z');
    expect(addCalendarPeriod(anchor, 'month', 1, 1).toISOString()).toBe(
      '2024-02-29T10:15:30.000Z',
    );
    expect(addCalendarPeriod(anchor, 'month', 1, 2).toISOString()).toBe(
      '2024-03-31T10:15:30.000Z',
    );
    expect(addCalendarPeriod(new Date('2023-01-31T00:00:00.000Z'), 'month').toISOString()).toBe(
      '2023-02-28T00:00:00.000Z',
    );
  });

  it('grants only the positive upgrade delta', () => {
    expect(calculateUpgradeGrant(450, 300)).toBe(150);
    expect(calculateUpgradeGrant(300, 450)).toBe(0);
    expect(calculateUpgradeGrant(300, 300)).toBe(0);
  });

  it('consumes plan lots before top-ups and earliest expiry within each source', () => {
    const lots = sortCreditLotsForConsumption([
      { id: 'top-late', source: 'top_up', expiresAt: '2027-01-01T00:00:00.000Z', remaining: 2 },
      { id: 'plan-late', source: 'plan', expiresAt: '2026-09-01T00:00:00.000Z', remaining: 2 },
      { id: 'empty', source: 'plan', expiresAt: '2026-07-01T00:00:00.000Z', remaining: 0 },
      { id: 'top-early', source: 'top_up', expiresAt: '2026-12-01T00:00:00.000Z', remaining: 2 },
      { id: 'plan-early', source: 'plan', expiresAt: '2026-08-01T00:00:00.000Z', remaining: 2 },
    ]);
    expect(lots.map((lot) => lot.id)).toEqual([
      'plan-early',
      'plan-late',
      'top-early',
      'top-late',
    ]);
  });

  it('returns the same free subscription across repeated setup calls', async () => {
    rpcMock.mockResolvedValue({ data: 'subscription-1', error: null });

    await expect(ensureFreeSubscription('store-one.myshopify.com')).resolves.toBe(
      'subscription-1',
    );
    await expect(ensureFreeSubscription('store-one.myshopify.com')).resolves.toBe(
      'subscription-1',
    );
    expect(rpcMock).toHaveBeenNthCalledWith(1, 'ensure_free_tryon_subscription', {
      p_shop_domain: 'store-one.myshopify.com',
    });
    expect(rpcMock).toHaveBeenNthCalledWith(2, 'ensure_free_tryon_subscription', {
      p_shop_domain: 'store-one.myshopify.com',
    });
  });

  it('maps unavailable reservations to the stable application error', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'TRYON_UNAVAILABLE: no credits remain' },
    });

    await expect(reserveCredit({
      shop: 'store-one.myshopify.com',
      jobId: 'tryon_test',
      requestKey: '11111111-1111-4111-8111-111111111111',
      modelKey: 'google/gemini-test',
      sessionId: 'sess_test',
      productId: 'product_test',
    })).rejects.toBeInstanceOf(TryOnUnavailableError);
  });
});
