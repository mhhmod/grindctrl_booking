/* The bug this guards against: requireManagedTryOnShop used to check only
   "does this shop exist and is it installed," never who it belongs to --
   any signed-in caller could pass another tenant's shop_domain and see (and
   mutate, via plan-actions.ts) that tenant's data. These tests assert the
   owner_clerk_user_id filter is actually applied, not just that the
   function returns *a* value. */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuth = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => mockAuth(),
}));

type QueryResult = { data: unknown; count?: number; error: unknown };

function makeBuilder(result: QueryResult) {
  const eqCalls: Array<[string, unknown]> = [];
  const builder: {
    select: () => typeof builder;
    eq: (column: string, value: unknown) => typeof builder;
    order: () => typeof builder;
    limit: () => Promise<QueryResult>;
    maybeSingle: () => Promise<QueryResult>;
    then: <T>(
      onFulfilled: (value: QueryResult) => T,
      onRejected?: (reason: unknown) => T,
    ) => Promise<T>;
    eqCalls: Array<[string, unknown]>;
  } = {
    select: () => builder,
    eq: (column, value) => {
      eqCalls.push([column, value]);
      return builder;
    },
    order: () => builder,
    limit: () => Promise.resolve(result),
    maybeSingle: () => Promise.resolve(result),
    then: (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected),
    eqCalls,
  };
  return builder;
}

const fromMock = vi.fn();
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: (table: string) => fromMock(table) }),
}));

vi.mock('@/lib/try-on/settings', () => ({
  getTryOnSettings: vi.fn(),
}));

import { listManagedTryOnShops, requireManagedTryOnShop } from './shops';

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  mockAuth.mockResolvedValue({ userId: 'user_caller' });
});

describe('requireManagedTryOnShop', () => {
  it('rejects when nobody is signed in', async () => {
    mockAuth.mockResolvedValue({ userId: null });

    await expect(requireManagedTryOnShop('grindctrl.myshopify.com')).rejects.toThrow('Unauthorized');
  });

  it('returns the shared demo row without touching the database', async () => {
    await expect(requireManagedTryOnShop('default')).resolves.toBe('default');
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('scopes the lookup to the caller by filtering on owner_clerk_user_id', async () => {
    const builder = makeBuilder({ data: { shop_domain: 'grindctrl.myshopify.com' }, error: null });
    fromMock.mockReturnValue(builder);

    await requireManagedTryOnShop('grindctrl.myshopify.com');

    expect(builder.eqCalls).toContainEqual(['owner_clerk_user_id', 'user_caller']);
  });

  it("rejects a shop that exists but belongs to a different tenant", async () => {
    // The row is real and installed, but the owner filter above excludes it
    // from the result set -- Supabase returns no row, same as "not found."
    const builder = makeBuilder({ data: null, error: null });
    fromMock.mockReturnValue(builder);

    await expect(requireManagedTryOnShop('someone-elses-shop.myshopify.com')).rejects.toThrow(
      'Unknown Shopify shop',
    );
  });
});

describe('listManagedTryOnShops', () => {
  it("only lists shops owned by the caller", async () => {
    const shopsBuilder = makeBuilder({
      data: [
        {
          shop_domain: 'grindctrl.myshopify.com',
          status: 'installed',
          installed_at: '2026-07-01T00:00:00.000Z',
          uninstalled_at: null,
          last_seen_at: '2026-07-16T00:00:00.000Z',
        },
      ],
      error: null,
    });
    const jobsBuilder = makeBuilder({ data: [], count: 0, error: null });
    fromMock.mockImplementation((table: string) => (table === 'tryon_shops' ? shopsBuilder : jobsBuilder));

    const result = await listManagedTryOnShops();

    expect(shopsBuilder.eqCalls).toContainEqual(['owner_clerk_user_id', 'user_caller']);
    expect(result).toEqual([
      expect.objectContaining({ domain: 'grindctrl.myshopify.com', jobCount: 0 }),
    ]);
  });
});
