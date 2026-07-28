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
    expect(calculatePerRenderPrice(1500, 300)).toBe(0.05);
    expect(calculatePerRenderPrice(5900, 450)).toBeCloseTo(0.131111, 6);
  });

  it('returns the public fallback catalog when Supabase env is missing', async () => {
    const catalog = await listPublicPlanCatalog();

    expect(createClientMock).not.toHaveBeenCalled();
    expect(catalog.plans.map((plan) => plan.planKey)).toEqual([
      'free-v1',
      'launch-v1',
      'dfy-v1',
    ]);
    expect(catalog.packs.map((pack) => pack.packKey)).toEqual([
      'pack-lite-v1',
      'pack-flash-v1',
    ]);
    expect(catalog.plans[1]).toMatchObject({
      priceMinor: 1500,
      rendersIncluded: 300,
    });
  });
});
