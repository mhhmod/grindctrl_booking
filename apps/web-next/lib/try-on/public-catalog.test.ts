import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}));

import { calculatePerRenderPrice } from './pricing';
import { listPublicPlanCatalog } from './public-catalog';

const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

describe('public try-on pricing catalog', () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    createClientMock.mockReset();
  });

  afterEach(() => {
    if (originalSupabaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl;
    }
    if (originalServiceRoleKey === undefined) {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    } else {
      process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceRoleKey;
    }
  });

  it('calculates the paid price per delivered render', () => {
    expect(calculatePerRenderPrice(1500, 150)).toBe(0.1);
    expect(calculatePerRenderPrice(4900, 650)).toBeCloseTo(0.075385, 6);
  });

  it('returns the public fallback catalog when Supabase env is missing', async () => {
    const catalog = await listPublicPlanCatalog();

    expect(createClientMock).not.toHaveBeenCalled();
    expect(catalog.plans.map((plan) => plan.planKey)).toEqual([
      'free-v2',
      'launch-v1',
      'launch-v1-egp',
      'growth-v1',
      'growth-v1-egp',
      'pro-v1',
      'pro-v1-egp',
    ]);
    expect(catalog.packs.map((pack) => pack.packKey)).toEqual([
      'pack-lite-v1',
      'pack-flash-v1',
    ]);
    expect(catalog.plans.map(({ planKey, priceMinor, currency, rendersIncluded, modelKey }) => ({
      planKey,
      priceMinor,
      currency,
      rendersIncluded,
      modelKey,
    }))).toEqual([
      { planKey: 'free-v2', priceMinor: 0, currency: 'USD', rendersIncluded: 15, modelKey: 'muse' },
      { planKey: 'launch-v1', priceMinor: 1500, currency: 'USD', rendersIncluded: 150, modelKey: 'muse' },
      { planKey: 'launch-v1-egp', priceMinor: 75000, currency: 'EGP', rendersIncluded: 150, modelKey: 'muse' },
      { planKey: 'growth-v1', priceMinor: 2900, currency: 'USD', rendersIncluded: 350, modelKey: 'muse' },
      { planKey: 'growth-v1-egp', priceMinor: 145000, currency: 'EGP', rendersIncluded: 350, modelKey: 'muse' },
      { planKey: 'pro-v1', priceMinor: 4900, currency: 'USD', rendersIncluded: 650, modelKey: 'muse' },
      { planKey: 'pro-v1-egp', priceMinor: 245000, currency: 'EGP', rendersIncluded: 650, modelKey: 'muse' },
    ]);
    expect(catalog.packs.every((pack) => pack.modelKey === 'muse')).toBe(true);
  });
});
