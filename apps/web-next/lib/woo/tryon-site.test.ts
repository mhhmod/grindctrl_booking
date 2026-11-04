// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  claims: [] as Array<{ apex_domain: string; widget_site_id: string }>,
  ensure: vi.fn(),
  raceWinner: null as string | null,
}));

vi.mock('@/lib/try-on/entitlement', () => ({
  ensureFreeSubscription: state.ensure,
  getShopEntitlement: vi.fn(),
}));
vi.mock('@/lib/messenger/db', () => ({
  getMessengerServiceClient: () => ({
    from: (table: string) => {
      expect(table).toBe('woo_free_plan_claims');
      return {
        select: () => ({
          in: async (_column: string, apexes: string[]) => ({
            data: state.claims.filter((row) => apexes.includes(row.apex_domain)),
            error: null,
          }),
        }),
        upsert: async (rows: Array<{ apex_domain: string; widget_site_id: string }>) => {
          for (const row of rows) {
            if (!state.claims.some((claim) => claim.apex_domain === row.apex_domain)) {
              state.claims.push(row);
              if (state.raceWinner) state.claims[state.claims.length - 1].widget_site_id = state.raceWinner;
            }
          }
          return { error: null };
        },
      };
    },
  }),
}));

import { apexDomainOf, ensureSiteFreePlan, FreePlanTakenError } from './tryon-site';

const A = '123e4567-e89b-42d3-a456-426614174000';
const B = '223e4567-e89b-42d3-a456-426614174000';

beforeEach(() => {
  state.claims = [];
  state.raceWinner = null;
  state.ensure.mockReset();
  state.ensure.mockResolvedValue('sub-1');
});

describe('apexDomainOf', () => {
  it.each([
    ['shop.example.com', 'example.com'],
    ['example.com', 'example.com'],
    ['www.shop.example.co.uk', 'example.co.uk'],
    ['store.example.com.eg', 'example.com.eg'],
    ['a.b.c.example.org', 'example.org'],
  ])('%s -> %s', (host, apex) => {
    expect(apexDomainOf(host)).toBe(apex);
  });
});

describe('ensureSiteFreePlan', () => {
  it('claims the apex and grants the free plan once', async () => {
    await ensureSiteFreePlan(A, ['shop.example.com']);
    expect(state.claims).toEqual([{ apex_domain: 'example.com', widget_site_id: A }]);
    expect(state.ensure).toHaveBeenCalledWith(`site:${A}`);
  });

  it('is repeatable for the site that holds the claim', async () => {
    await ensureSiteFreePlan(A, ['shop.example.com']);
    await ensureSiteFreePlan(A, ['www.example.com']);
    expect(state.claims).toHaveLength(1);
    expect(state.ensure).toHaveBeenCalledTimes(2);
  });

  it('refuses a second site on the same apex without granting', async () => {
    await ensureSiteFreePlan(A, ['shop.example.com']);
    state.ensure.mockClear();
    await expect(ensureSiteFreePlan(B, ['other.example.com'])).rejects.toBeInstanceOf(FreePlanTakenError);
    expect(state.ensure).not.toHaveBeenCalled();
  });

  it('refuses when a concurrent site wins the claim between check and insert', async () => {
    state.raceWinner = B;
    await expect(ensureSiteFreePlan(A, ['shop.example.com'])).rejects.toBeInstanceOf(FreePlanTakenError);
    expect(state.ensure).not.toHaveBeenCalled();
  });

  it('refuses a site with no verified host', async () => {
    await expect(ensureSiteFreePlan(A, [])).rejects.toBeInstanceOf(FreePlanTakenError);
  });
});
