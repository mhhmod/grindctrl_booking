// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  plan: vi.fn(),
  catalog: vi.fn(),
  rows: [] as unknown[],
  calls: [] as Array<[string, ...unknown[]]>,
  error: null as { code?: string; message: string } | null,
  testColumnMissing: false,
}));

vi.mock('@/app/dashboard/try-on/plan-actions', () => ({ getShopPlanState: mocks.plan, listPlansCatalog: mocks.catalog }));
vi.mock('@/lib/messenger/db', () => {
  class Query {
    private filters: Array<[string, unknown]> = [];
    constructor(readonly table: string) {}
    select(columns: string) { mocks.calls.push(['select', this.table, columns]); return this; }
    eq(column: string, value: unknown) { this.filters.push([column, value]); mocks.calls.push(['eq', column, value]); return this; }
    gte(column: string, value: unknown) { mocks.calls.push(['gte', column, value]); return this; }
    limit(count: number) { mocks.calls.push(['limit', count]); return this; }
    then(resolve: (value: unknown) => unknown) {
      const testFilter = this.filters.some(([column]) => column === 'is_test');
      if (mocks.testColumnMissing && testFilter) {
        return Promise.resolve({ data: null, error: { code: '42703', message: 'column tryon_jobs.is_test does not exist' } }).then(resolve);
      }
      return Promise.resolve(mocks.error ? { data: null, error: mocks.error } : { data: mocks.rows, error: null }).then(resolve);
    }
  }
  return { getMessengerServiceClient: () => ({ from: (table: string) => new Query(table) }) as unknown as SupabaseClient };
});

import { getPlanFacts } from './plan-data';

const DAY = 86_400_000;
const NOW = Date.parse('2026-10-02T12:00:00Z');
const START = '2026-09-18T00:00:00.000Z';
const END = '2026-10-18T00:00:00.000Z';
const SHOP = 'maison.myshopify.com';
const PLANS = [{ planKey: 'growth-v1', name: 'Growth' }];

beforeEach(() => {
  vi.resetAllMocks();
  mocks.calls = [];
  mocks.error = null;
  mocks.testColumnMissing = false;
  mocks.rows = [{ created_at: '2026-10-01T09:00:00Z' }, { created_at: '2026-09-20T09:00:00Z' }, { created_at: 'not a date' }];
  mocks.plan.mockResolvedValue({ planKey: 'growth-v1', currentPeriodStart: START, currentPeriodEnd: END });
  mocks.catalog.mockResolvedValue({ plans: PLANS });
});

describe('getPlanFacts', () => {
  it('reads the plan and the plans through the owner-only actions, and this shop’s looks over three cycles', async () => {
    const facts = await getPlanFacts({ shop: SHOP, timeZone: 'Africa/Cairo', currency: 'EGP', now: NOW });
    expect(mocks.plan).toHaveBeenCalledWith(SHOP);
    expect(mocks.catalog).toHaveBeenCalledWith(SHOP);
    // Two cycles of 30 days before this one, and 4 days more for calendar months.
    const since = new Date(Date.parse(START) - 2 * 30 * DAY - 4 * DAY).toISOString();
    expect(mocks.calls).toEqual([
      ['select', 'tryon_jobs', 'created_at'],
      ['eq', 'shop', SHOP],
      ['eq', 'status', 'completed'],
      ['gte', 'created_at', since],
      ['limit', 20_000],
      ['eq', 'is_test', false],
    ]);
    expect(facts).toEqual({
      now: NOW,
      timeZone: 'Africa/Cairo',
      plan: { planKey: 'growth-v1', currentPeriodStart: START, currentPeriodEnd: END },
      plans: PLANS,
      currency: 'EGP',
      looks: [Date.parse('2026-10-01T09:00:00Z'), Date.parse('2026-09-20T09:00:00Z')],
    });
  });

  it('reads 30-day cycles back from today when the plan has no cycle', async () => {
    mocks.plan.mockResolvedValue({ planKey: null, currentPeriodStart: null, currentPeriodEnd: null });
    await getPlanFacts({ shop: SHOP, timeZone: 'UTC', currency: 'USD', now: NOW });
    expect(mocks.calls).toContainEqual(['gte', 'created_at', new Date(NOW - 3 * 30 * DAY - 4 * DAY).toISOString()]);
  });

  it('reads again without the test-look filter before the column exists', async () => {
    mocks.testColumnMissing = true;
    const facts = await getPlanFacts({ shop: SHOP, timeZone: 'UTC', currency: 'USD', now: NOW });
    expect(mocks.calls.filter(([kind]) => kind === 'select')).toHaveLength(2);
    expect(facts.looks).toHaveLength(2);
  });

  it('throws when the looks cannot be read, or the plan is refused', async () => {
    mocks.error = { message: 'timeout' };
    await expect(getPlanFacts({ shop: SHOP, timeZone: 'UTC', currency: 'USD', now: NOW })).rejects.toThrow('timeout');
    mocks.error = null;
    mocks.plan.mockRejectedValue(new Error('Forbidden'));
    await expect(getPlanFacts({ shop: SHOP, timeZone: 'UTC', currency: 'USD', now: NOW })).rejects.toThrow('Forbidden');
  });
});
