import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));

import { readCreditBalance, sumLedgerBalance } from './entitlement';

/* Phase zero item 4: looks left must not depend on reading every ledger row
   in one request, which a PostgREST row cap cuts short. */

const FUTURE = '2099-01-01T00:00:00.000Z';
const PAST = '2000-01-01T00:00:00.000Z';

function grant(id: string, amount: number, extra: Record<string, unknown> = {}) {
  return { id, entry_type: 'grant' as const, amount, source_grant_id: null, plan_id: 'plan', credit_pack_id: null, expires_at: FUTURE, ...extra };
}
function child(n: number, grantId: string, amount: number, type: 'debit' | 'refund' = 'debit') {
  return Array.from({ length: n }, (_, i) => ({
    id: `${type}-${grantId}-${i}`, entry_type: type, amount, source_grant_id: grantId,
    plan_id: null, credit_pack_id: null, expires_at: null,
  }));
}

/* 2,591 rows (the SQL test adds the free plan's own grant): a live plan grant (2,300 - 2,100 + 150 = 350), an expired one,
   a top-up (80 - 30 = 50) and an over-drawn grant clamped at zero, the same
   scenario the SQL test runs against a real database. */
const LEDGER = [
  grant('g1', 2300),
  grant('g2', 300, { expires_at: PAST }),
  grant('g3', 80, { plan_id: null, credit_pack_id: 'pack' }),
  grant('g4', 5),
  ...child(2100, 'g1', -1),
  ...child(150, 'g1', 1, 'refund'),
  ...child(300, 'g2', -1),
  ...child(30, 'g3', -1),
  ...child(7, 'g4', -1),
];

function pagedClient(rows: typeof LEDGER, rpcError: { code: string; message: string } | null) {
  const ranges: Array<[number, number]> = [];
  const client = {
    rpc: vi.fn(async () => (rpcError ? { data: null, error: rpcError } : { data: [{ plan_remaining: '350', top_up_remaining: 50 }], error: null })),
    from: vi.fn(() => {
      const query = {
        select: () => query,
        eq: () => query,
        order: () => query,
        range: async (from: number, to: number) => {
          ranges.push([from, to]);
          return { data: rows.slice(from, to + 1), error: null };
        },
      };
      return query;
    }),
  };
  return { client, ranges };
}

describe('sumLedgerBalance', () => {
  it('sums live grants with their children, ignores expired grants and never goes below zero', () => {
    expect(LEDGER).toHaveLength(2591);
    expect(sumLedgerBalance(LEDGER)).toEqual({ planCreditsRemaining: 350, topUpCreditsRemaining: 50 });
  });
});

describe('readCreditBalance', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('reads the SQL aggregate when the function exists', async () => {
    const { client } = pagedClient(LEDGER, null);
    const balance = await readCreditBalance(client as never, 'sub-1');
    expect(balance).toEqual({ planCreditsRemaining: 350, topUpCreditsRemaining: 50 });
    expect(client.rpc).toHaveBeenCalledWith('tryon_credit_balance', { p_subscription_id: 'sub-1' });
    expect(client.from).not.toHaveBeenCalled();
  });

  it.each(['PGRST202', '42883'])(
    'falls back to a paged read past the row cap until the SQL is applied (%s)',
    async (code) => {
      const { client, ranges } = pagedClient(LEDGER, { code, message: 'function not found' });
      const balance = await readCreditBalance(client as never, 'sub-1');
      expect(balance).toEqual({ planCreditsRemaining: 350, topUpCreditsRemaining: 50 });
      expect(ranges).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
    },
  );

  it('does not hide other database errors behind the fallback', async () => {
    const { client } = pagedClient(LEDGER, { code: '57014', message: 'canceling statement due to statement timeout' });
    await expect(readCreditBalance(client as never, 'sub-1')).rejects.toThrow('statement timeout');
    expect(client.from).not.toHaveBeenCalled();
  });
});
