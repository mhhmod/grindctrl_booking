// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), apps: vi.fn(), reconcile: vi.fn(), stamp: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ rpc: mocks.rpc, from: mocks.from }) }));
vi.mock('@/lib/shopify/app-registry', () => ({ getConfiguredShopifyApps: mocks.apps }));
vi.mock('@/lib/shopify/app-pricing', () => ({ reconcileShopifyAppPricing: mocks.reconcile }));

import { reconcileShopifyPricingBatch, reconcileTryOnPlanStates } from './plan-reconcile';

const counts = { subscriptions: 4, rolledOver: 1, grace: 1, expired: 1, cancelled: 1, expiredGrants: 5, staleJobs: 2 };
const installs = [
  { id: 'installation-one', shop_domain: 'oldest.myshopify.com', app_client_id: 'public-app' },
  { id: 'installation-two', shop_domain: 'next.myshopify.com', app_client_id: 'public-app' },
];

function queryResult(data: unknown = installs, error: unknown = null, oldestAttempt: unknown = null) {
  const result = Promise.resolve({ data, error });
  const stamp = { select: vi.fn(), eq: vi.fn(), or: vi.fn(), then: (resolve: (value: unknown) => unknown) => Promise.resolve(mocks.stamp()).then(resolve) };
  for (const method of ['select', 'eq', 'or'] as const) stamp[method].mockReturnValue(stamp);
  const query = { select: vi.fn(), eq: vi.fn(), in: vi.fn(), or: vi.fn(), order: vi.fn(), limit: vi.fn(), update: vi.fn().mockReturnValue(stamp), then: result.then.bind(result) };
  for (const method of ['select', 'eq', 'in', 'or', 'order', 'limit'] as const) query[method].mockReturnValue(query);
  const cohortResult = Promise.resolve({ data: [{ pricing_reconcile_attempted_at: oldestAttempt }], error });
  const cohort = { select: vi.fn(), eq: vi.fn(), in: vi.fn(), order: vi.fn(), limit: vi.fn(), then: cohortResult.then.bind(cohortResult) };
  for (const method of ['select', 'eq', 'in', 'order', 'limit'] as const) cohort[method].mockReturnValue(cohort);
  mocks.from.mockReset().mockReturnValue(query).mockReturnValueOnce(cohort);
  return query;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-only');
  mocks.rpc.mockResolvedValue({ data: counts, error: null });
  mocks.apps.mockReturnValue([{ clientId: 'public-app', distribution: 'public' }, { clientId: 'custom-app', distribution: 'custom' }]);
  mocks.reconcile.mockResolvedValue(undefined);
  mocks.stamp.mockReturnValue({ data: [{ id: 'installation-one' }], error: null });
  queryResult();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe('bounded scheduled plan transitions', () => {
  it('uses the transactional RPC and returns only validated counts', async () => {
    expect(await reconcileTryOnPlanStates()).toEqual({ ...counts, failed: 0 });
    expect(mocks.rpc).toHaveBeenCalledWith('reconcile_tryon_plans', { p_limit: 100 });
  });

  it.each([[1000, 100], [-2, 1], [2.9, 2], [NaN, 100], [Infinity, 100]])('bounds batch limit %s to %s', async (input, expected) => {
    mocks.rpc.mockResolvedValue({ data: { subscriptions: 0, rolledOver: 0, grace: 0, expired: 0, cancelled: 0, expiredGrants: 0, staleJobs: 0 }, error: null });
    await reconcileTryOnPlanStates(input);
    expect(mocks.rpc).toHaveBeenCalledWith('reconcile_tryon_plans', { p_limit: expected });
  });

  it.each(['PGRST202', '42883', '42P01'])('skips missing migration %s without claiming work', async (code) => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code, message: 'private data' } });
    expect(await reconcileTryOnPlanStates()).toMatchObject({ subscriptions: 0, expiredGrants: 0, failed: 0, notReady: true });
    expect(console.warn).toHaveBeenCalledWith('[try-on-plan-reconcile] skipped', { code: 'plan_reconcile_schema_missing' });
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain('private data');
  });

  it('does not silently skip other database failures', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'sensitive details' } });
    await expect(reconcileTryOnPlanStates()).rejects.toThrow('plan_reconcile_batch_failed');
    expect(console.warn).not.toHaveBeenCalled();
  });

  it.each([null, [], { ...counts, subscriptions: 101 }, { ...counts, expiredGrants: -1 }, { ...counts, grace: 1.5 }, { ...counts, subscriptions: 1 }])('rejects invalid or oversized RPC results', async (data) => {
    mocks.rpc.mockResolvedValue({ data, error: null });
    await expect(reconcileTryOnPlanStates()).rejects.toThrow(/plan_reconcile_(batch_failed|counts_invalid)/);
  });

  it('does not recount transitions when the next idempotent batch has no changes', async () => {
    expect(await reconcileTryOnPlanStates()).toMatchObject(counts);
    const empty = { subscriptions: 0, rolledOver: 0, grace: 0, expired: 0, cancelled: 0, expiredGrants: 0, staleJobs: 0 };
    mocks.rpc.mockResolvedValue({ data: empty, error: null });
    expect(await reconcileTryOnPlanStates()).toEqual({ ...empty, failed: 0 });
  });
});

describe('scheduled Shopify App Pricing repair', () => {
  it('selects only active public installs, oldest successful sync first, with a hard cap', async () => {
    const query = queryResult();
    expect(await reconcileShopifyPricingBatch(999)).toEqual({ scanned: 2, reconciled: 2, skipped: 0, failed: 0 });
    expect(mocks.from).toHaveBeenCalledWith('shopify_installations');
    expect(query.select).toHaveBeenCalledWith('id, shop_domain, app_client_id');
    expect(query.eq).toHaveBeenCalledWith('status', 'active');
    expect(query.in).toHaveBeenCalledWith('app_client_id', ['public-app']);
    expect(query.order.mock.calls).toEqual([['pricing_synced_at', { ascending: true, nullsFirst: true }], ['id', { ascending: true }]]);
    expect(query.limit).toHaveBeenCalledWith(5);
    expect(query.or).toHaveBeenCalledWith('pricing_reconcile_attempted_at.is.null');
    expect(query.update).toHaveBeenCalledTimes(2);
    expect(query.update).toHaveBeenCalledWith({ pricing_reconcile_attempted_at: expect.any(String) });
    expect(query.update.mock.invocationCallOrder[0]).toBeLessThan(mocks.reconcile.mock.invocationCallOrder[0]);
    expect(mocks.reconcile.mock.calls.map(([input]) => input)).toEqual(installs.map((row) => ({
      shopDomain: row.shop_domain, appClientId: row.app_client_id, source: 'bootstrap',
    })));
  });

  it('keeps processing other shops after one failure and logs only its domain and a fixed code', async () => {
    mocks.reconcile.mockRejectedValueOnce(new Error('provider leaked private@example.com/access-token'));
    expect(await reconcileShopifyPricingBatch()).toEqual({ scanned: 2, reconciled: 1, skipped: 0, failed: 1 });
    expect(mocks.reconcile).toHaveBeenCalledTimes(2);
    expect(console.error).toHaveBeenCalledWith('[shopify-pricing-reconcile] failed', {
      shopDomain: installs[0].shop_domain, code: 'shopify_pricing_reconcile_failed',
    });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('private@example.com');
  });

  it('preserves recognized application failure codes without logging the installation or app id', async () => {
    mocks.reconcile.mockRejectedValueOnce(new Error('shopify_pricing_missing_token'));
    await reconcileShopifyPricingBatch();
    expect(console.error).toHaveBeenCalledWith('[shopify-pricing-reconcile] failed', {
      shopDomain: installs[0].shop_domain, code: 'shopify_pricing_missing_token',
    });
  });

  it('does no storage or provider work if no public distribution app is configured', async () => {
    mocks.apps.mockReturnValue([{ clientId: 'custom-app', distribution: 'custom' }, { clientId: 'development' }]);
    expect(await reconcileShopifyPricingBatch()).toEqual({ scanned: 0, reconciled: 0, skipped: 0, failed: 0 });
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.reconcile).not.toHaveBeenCalled();
  });

  it.each([null, Array.from({ length: 6 }, () => installs[0])])('rejects malformed/oversized batches before provider calls', async (data) => {
    queryResult(data);
    await expect(reconcileShopifyPricingBatch()).rejects.toThrow('shopify_pricing_batch_unavailable');
    expect(mocks.reconcile).not.toHaveBeenCalled();
  });

  it('rejects invalid tenants or unexpected app registrations without logging their data', async () => {
    queryResult([{ shop_domain: 'site:00000000-0000-4000-8000-000000000000', app_client_id: 'public-app' },
      { ...installs[0], app_client_id: 'custom-app' }, ...installs]);
    expect(await reconcileShopifyPricingBatch()).toEqual({ scanned: 4, reconciled: 2, skipped: 0, failed: 2 });
    expect(mocks.reconcile).toHaveBeenCalledTimes(2);
    expect(console.error).toHaveBeenCalledWith('[shopify-pricing-reconcile] failed', { code: 'shopify_pricing_installation_invalid' });
  });

  it('reports query failure with a fixed code', async () => {
    queryResult(null, { message: 'private@example.com' });
    await expect(reconcileShopifyPricingBatch()).rejects.toThrow('shopify_pricing_batch_unavailable');
  });

  it('skips an unapplied attempt-timestamp migration and does not call Shopify', async () => {
    queryResult(null, { code: '42703', message: 'column does not exist' });
    expect(await reconcileShopifyPricingBatch()).toEqual({ scanned: 0, reconciled: 0, skipped: 0, failed: 0, notReady: true });
    expect(mocks.reconcile).not.toHaveBeenCalled();
  });

  it('skips installations another worker stamped first', async () => {
    mocks.stamp.mockReturnValue({ data: [], error: null });
    expect(await reconcileShopifyPricingBatch()).toEqual({ scanned: 2, reconciled: 0, skipped: 2, failed: 0 });
    expect(mocks.reconcile).not.toHaveBeenCalled();
  });

  it('does not start provider reads when the attempt stamp cannot be persisted', async () => {
    mocks.stamp.mockReturnValue({ data: null, error: { message: 'private@example.com' } });
    expect(await reconcileShopifyPricingBatch()).toEqual({ scanned: 2, reconciled: 0, skipped: 0, failed: 2 });
    expect(mocks.reconcile).not.toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('private@example.com');
  });

  it('restricts retries to the oldest attempted cohort and preserves the cooldown', async () => {
    const oldest = '2026-11-01T00:00:00.000Z';
    const query = queryResult(installs, null, oldest);
    await reconcileShopifyPricingBatch();
    expect(query.or).toHaveBeenCalledWith(expect.stringMatching(new RegExp(`^and\\(pricing_reconcile_attempted_at\\.lte\\.${oldest},pricing_reconcile_attempted_at\\.lt\\.`)));
  });

  it('reaches every shop beyond six failing hourly batches before retrying an old failure', async () => {
    const rows = Array.from({ length: 40 }, (_, index) => ({
      id: `installation-${String(index).padStart(2, '0')}`, shop_domain: `shop-${index}.myshopify.com`,
      app_client_id: 'public-app', pricing_synced_at: null,
      pricing_reconcile_attempted_at: null as string | null,
    }));
    const selectionFilters: string[] = [];
    mocks.reconcile.mockRejectedValue(new Error('shopify_pricing_missing_token'));
    mocks.from.mockReset().mockImplementation(() => {
      let selected = '';
      let rowId: string | undefined;
      let filter = '';
      let limit = Infinity;
      let update: { pricing_reconcile_attempted_at: string } | undefined;
      const query = {
        select: vi.fn((columns: string) => { selected = columns; return query; }),
        eq: vi.fn((column: string, value: string) => { if (column === 'id') rowId = value; return query; }),
        in: vi.fn(() => query),
        or: vi.fn((value: string) => { filter = value; return query; }),
        order: vi.fn(() => query),
        limit: vi.fn((value: number) => { limit = value; return query; }),
        update: vi.fn((value: { pricing_reconcile_attempted_at: string }) => { update = value; return query; }),
        then: (resolve: (value: unknown) => unknown) => {
          const sorted = [...rows].sort((a, b) => (a.pricing_reconcile_attempted_at ?? '').localeCompare(b.pricing_reconcile_attempted_at ?? '') || a.id.localeCompare(b.id));
          if (selected === 'pricing_reconcile_attempted_at') {
            return Promise.resolve({ data: sorted.slice(0, 1), error: null }).then(resolve);
          }
          const eligible = (row: typeof rows[number]) => {
            if (filter === 'pricing_reconcile_attempted_at.is.null') return row.pricing_reconcile_attempted_at === null;
            const match = /^and\(pricing_reconcile_attempted_at\.lte\.([^,]+),pricing_reconcile_attempted_at\.lt\.([^)]*)\)$/.exec(filter);
            return !!match && row.pricing_reconcile_attempted_at !== null
              && row.pricing_reconcile_attempted_at <= match[1] && row.pricing_reconcile_attempted_at < match[2];
          };
          if (update) {
            const row = rows.find((row) => row.id === rowId && eligible(row));
            if (row) row.pricing_reconcile_attempted_at = update.pricing_reconcile_attempted_at;
            return Promise.resolve({ data: row ? [{ id: row.id }] : [], error: null }).then(resolve);
          }
          selectionFilters.push(filter);
          const data = rows.filter(eligible).sort((a, b) => a.id.localeCompare(b.id)).slice(0, limit);
          return Promise.resolve({ data, error: null }).then(resolve);
        },
      };
      return query;
    });
    vi.useFakeTimers();
    try {
      for (let hour = 0; hour < 8; hour += 1) {
        vi.setSystemTime(new Date(`2026-11-06T${String(hour).padStart(2, '0')}:00:00Z`));
        expect(await reconcileShopifyPricingBatch()).toMatchObject({ scanned: 5, failed: 5 });
      }
      expect(new Set(mocks.reconcile.mock.calls.map(([input]) => input.shopDomain)).size).toBe(40);
      expect(selectionFilters).toEqual(Array(8).fill('pricing_reconcile_attempted_at.is.null'));
      vi.setSystemTime(new Date('2026-11-06T08:00:00Z'));
      expect(await reconcileShopifyPricingBatch()).toMatchObject({ scanned: 5, failed: 5 });
      expect(selectionFilters[8]).toContain('pricing_reconcile_attempted_at.lte.2026-11-06T00:00:00.000Z');
      expect(mocks.reconcile.mock.calls.slice(40).map(([input]) => input.shopDomain)).toEqual(rows.slice(0, 5).map((row) => row.shop_domain));
    } finally {
      vi.useRealTimers();
    }
  });
});
