// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const rows = vi.hoisted(() => ({ data: [] as Array<{ duration_ms: unknown }>, error: null as unknown, filters: [] as Array<[string, unknown]> }));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => {
      const builder = {
        select: () => builder,
        eq: (column: string, value: unknown) => {
          rows.filters.push([column, value]);
          return builder;
        },
        gte: (column: string, value: unknown) => {
          rows.filters.push([column, value]);
          return builder;
        },
        order: () => builder,
        limit: async () => ({ data: rows.data, error: rows.error }),
      };
      return builder;
    },
  }),
}));

import { clearLookTimingCache, getTypicalLookSeconds, MIN_LOOKS, typicalSeconds } from './look-timing';

beforeEach(() => {
  clearLookTimingCache();
  rows.data = [];
  rows.error = null;
  rows.filters = [];
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test';
});

describe('the time a look takes', () => {
  it('is the median of recent looks, to the nearest 5 seconds', () => {
    const ms = [14_000, 16_000, 19_000, 20_000, 21_000, 22_000, 23_000, 40_000, 90_000, 18_000];
    expect(typicalSeconds([...ms, ...ms])).toBe(20);
    expect(typicalSeconds(Array(MIN_LOOKS).fill(2_000))).toBe(5);
  });

  it('says nothing with too few looks to be honest', () => {
    expect(typicalSeconds(Array(MIN_LOOKS - 1).fill(20_000))).toBeNull();
    expect(typicalSeconds([...Array(MIN_LOOKS - 1).fill(20_000), null, -5, 'x'])).toBeNull();
  });

  it("reads only this store's completed shopper looks from the last 7 days", async () => {
    rows.data = Array(MIN_LOOKS).fill({ duration_ms: 31_000 });
    const now = Date.parse('2026-10-20T12:00:00Z');
    expect(await getTypicalLookSeconds('maison.myshopify.com', now)).toBe(30);
    expect(rows.filters).toContainEqual(['created_at', '2026-10-13T12:00:00.000Z']);
    expect(rows.filters).toEqual(
      expect.arrayContaining([
        ['shop', 'maison.myshopify.com'],
        ['status', 'completed'],
        ['is_test', false],
      ]),
    );
  });

  it('fails quietly to no number', async () => {
    rows.error = { message: 'down' };
    expect(await getTypicalLookSeconds('maison.myshopify.com')).toBeNull();
    expect(await getTypicalLookSeconds(null)).toBeNull();
  });
});
