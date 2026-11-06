// @vitest-environment node
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ plans: vi.fn(), pricing: vi.fn() }));
vi.mock('@/lib/try-on/plan-reconcile', () => ({
  reconcileTryOnPlanStates: mocks.plans, reconcileShopifyPricingBatch: mocks.pricing,
  TRYON_PLAN_RECONCILE_BATCH_LIMIT: 100, SHOPIFY_PRICING_RECONCILE_BATCH_LIMIT: 5,
}));
import { POST } from './route';

const secret = 'r'.repeat(40);
const plans = { subscriptions: 4, rolledOver: 1, grace: 1, expired: 1, cancelled: 1, expiredGrants: 5, staleJobs: 2, failed: 0 };
const pricing = { scanned: 2, reconciled: 2, failed: 0 };
const call = (authorization?: string) => POST(new NextRequest('http://localhost/api/internal/try-on/plan-reconcile', {
  method: 'POST', headers: authorization ? { authorization } : {},
}));

beforeEach(() => {
  vi.stubEnv('TRYON_CLEANUP_SECRET', secret);
  mocks.plans.mockReset().mockResolvedValue(plans);
  mocks.pricing.mockReset().mockResolvedValue(pricing);
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe('internal plan reconciliation route', () => {
  it('requires the existing strong bearer secret before starting either job', async () => {
    for (const header of [undefined, 'Bearer wrong', `Basic ${secret}`, `Bearer ${secret} extra`]) {
      const response = await call(header);
      expect(response.status).toBe(401);
      expect(response.headers.get('cache-control')).toBe('no-store');
    }
    for (const value of ['', 'short']) {
      vi.stubEnv('TRYON_CLEANUP_SECRET', value);
      expect((await call(`Bearer ${value || secret}`)).status).toBe(401);
    }
    expect(mocks.plans).not.toHaveBeenCalled();
    expect(mocks.pricing).not.toHaveBeenCalled();
  });

  it('runs bounded jobs and returns a no-store count-only summary', async () => {
    const response = await call(`Bearer ${secret}`);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(mocks.plans).toHaveBeenCalledWith(100);
    expect(mocks.pricing).toHaveBeenCalledWith(5);
    expect(await response.json()).toEqual({ ok: true, data: { plans, pricing, failedOperations: 0 } });
  });

  it('tolerates an unapplied plan migration while still repairing Shopify pricing', async () => {
    mocks.plans.mockResolvedValue({ ...plans, notReady: true });
    const response = await call(`Bearer ${secret}`);
    expect(response.status).toBe(200);
    expect(mocks.pricing).toHaveBeenCalledTimes(1);
    expect(await response.json()).toMatchObject({ ok: true, data: { plans: { notReady: true }, pricing } });
  });

  it.each(['plans', 'pricing'] as const)('runs the other job even if %s throws, without leaking details', async (name) => {
    mocks[name].mockRejectedValue(new Error('private@example.com/token'));
    const response = await call(`Bearer ${secret}`);
    expect(response.status).toBe(500);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(mocks.plans).toHaveBeenCalledTimes(1);
    expect(mocks.pricing).toHaveBeenCalledTimes(1);
    expect(await response.text()).not.toContain('private@example.com');
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('private@example.com');
  });

  it('counts one failed shop without failing the whole run or discarding successful work', async () => {
    mocks.pricing.mockResolvedValue({ scanned: 2, reconciled: 1, failed: 1 });
    const response = await call(`Bearer ${secret}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, data: { plans, pricing: { reconciled: 1, failed: 1 }, failedOperations: 1 } });
  });
});
