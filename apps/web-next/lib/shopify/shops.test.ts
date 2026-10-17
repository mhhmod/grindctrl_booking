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
  const inCalls: Array<[string, unknown]> = [];
  const builder: {
    select: () => typeof builder;
    eq: (column: string, value: unknown) => typeof builder;
    in: (column: string, values: unknown) => typeof builder;
    order: () => typeof builder;
    limit: () => Promise<QueryResult>;
    maybeSingle: () => Promise<QueryResult>;
    then: <T>(
      onFulfilled: (value: QueryResult) => T,
      onRejected?: (reason: unknown) => T,
    ) => Promise<T>;
    eqCalls: Array<[string, unknown]>;
    inCalls: Array<[string, unknown]>;
  } = {
    select: () => builder,
    eq: (column, value) => {
      eqCalls.push([column, value]);
      return builder;
    },
    in: (column, values) => {
      inCalls.push([column, values]);
      return builder;
    },
    order: () => builder,
    limit: () => Promise.resolve(result),
    maybeSingle: () => Promise.resolve(result),
    then: (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected),
    eqCalls,
    inCalls,
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

const listTeamMemberships = vi.fn();
vi.mock('@/lib/rbac/store-role', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/rbac/store-role')>()),
  listTeamMemberships: (...args: unknown[]) => listTeamMemberships(...args),
}));

import { listManagedTryOnShops, requireManagedTryOnShop, requireTryOnShopAccess } from './shops';
import { RoleNotAllowedError } from '@/lib/rbac/dashboard-policy';

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  mockAuth.mockResolvedValue({ userId: 'user_caller' });
  listTeamMemberships.mockResolvedValue([]);
});

describe('requireManagedTryOnShop', () => {
  it('rejects when nobody is signed in', async () => {
    mockAuth.mockResolvedValue({ userId: null });

    await expect(requireManagedTryOnShop('grindctrl.myshopify.com')).rejects.toThrow('Unauthorized');
  });

  /* The global 'default' row is internal configuration: lib/try-on/settings.ts
     merges it UNDER every shop's own row, so whoever writes it changes the
     inherited baseline for every other merchant on the platform. Being signed
     in is not authority over other tenants, so callers must opt in explicitly
     and only read paths ever do. */
  it('refuses the global default row for a caller that did not opt in', async () => {
    await expect(requireManagedTryOnShop('default')).rejects.toThrow('Unknown Shopify shop');
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('returns the global default row only for an explicit opt-in read', async () => {
    await expect(
      requireManagedTryOnShop('default', { allowGlobalDefault: true }),
    ).resolves.toBe('default');
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('still requires a signed-in caller even for an opt-in default read', async () => {
    mockAuth.mockResolvedValue({ userId: null });

    await expect(
      requireManagedTryOnShop('default', { allowGlobalDefault: true }),
    ).rejects.toThrow('Unauthorized');
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

/* Item 12: a store's team works on it too. The owner's own lookup above is
   unchanged; only when it finds nothing does the check look at the shops of
   the accounts whose team the caller is on, and only those. */
describe('requireManagedTryOnShop for a team', () => {
  const team = [{ workspaceId: 'ws_owner', ownerClerkUserId: 'user_owner', role: 'member' as const }];

  function teamLookup(row: unknown) {
    const ownerLookup = makeBuilder({ data: null, error: null });
    const teamBuilder = makeBuilder({ data: row, error: null });
    fromMock.mockReturnValueOnce(ownerLookup).mockReturnValueOnce(teamBuilder);
    return teamBuilder;
  }

  it("accepts a member of the shop owner's team, scoped to that team's owners", async () => {
    listTeamMemberships.mockResolvedValue(team);
    const builder = teamLookup({ shop_domain: 'maison.myshopify.com', owner_clerk_user_id: 'user_owner' });

    await expect(requireTryOnShopAccess('maison.myshopify.com')).resolves.toEqual({
      domain: 'maison.myshopify.com',
      role: 'member',
    });
    expect(builder.inCalls).toEqual([['owner_clerk_user_id', ['user_owner']]]);
    expect(builder.eqCalls).toContainEqual(['status', 'installed']);
  });

  it('refuses a member what their role may not do', async () => {
    listTeamMemberships.mockResolvedValue(team);
    teamLookup({ shop_domain: 'maison.myshopify.com', owner_clerk_user_id: 'user_owner' });

    await expect(requireManagedTryOnShop('maison.myshopify.com', { capability: 'settings' })).rejects.toBeInstanceOf(
      RoleNotAllowedError,
    );
  });

  it('refuses the owner nothing', async () => {
    fromMock.mockReturnValue(makeBuilder({ data: { shop_domain: 'maison.myshopify.com' }, error: null }));

    await expect(requireManagedTryOnShop('maison.myshopify.com', { capability: 'billing' })).resolves.toBe(
      'maison.myshopify.com',
    );
    expect(listTeamMemberships).not.toHaveBeenCalled();
  });

  it('refuses a shop no team of the caller owns, as an unknown shop', async () => {
    listTeamMemberships.mockResolvedValue(team);
    teamLookup(null);

    await expect(requireManagedTryOnShop('elsewhere.myshopify.com')).rejects.toThrow('Unknown Shopify shop');
  });

  it('never looks further for a caller on no team', async () => {
    fromMock.mockReturnValue(makeBuilder({ data: null, error: null }));

    await expect(requireManagedTryOnShop('maison.myshopify.com')).rejects.toThrow('Unknown Shopify shop');
    expect(fromMock).toHaveBeenCalledTimes(1);
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
    expect(shopsBuilder.inCalls).toEqual([]);
    expect(result).toEqual([
      expect.objectContaining({ domain: 'grindctrl.myshopify.com', jobCount: 0, role: 'owner' }),
    ]);
  });

  it("lists the shops of the caller's teams after their own, with their role", async () => {
    listTeamMemberships.mockResolvedValue([
      { workspaceId: 'ws_owner', ownerClerkUserId: 'user_owner', role: 'admin' },
    ]);
    const row = (domain: string, owner: string) => ({
      shop_domain: domain,
      owner_clerk_user_id: owner,
      status: 'installed',
      installed_at: '2026-07-01T00:00:00.000Z',
      uninstalled_at: null,
      last_seen_at: '2026-07-16T00:00:00.000Z',
    });
    const own = makeBuilder({ data: [row('mine.myshopify.com', 'user_caller')], error: null });
    const team = makeBuilder({ data: [row('maison.myshopify.com', 'user_owner')], error: null });
    const jobs = makeBuilder({ data: [], count: 0, error: null });
    let shopQueries = 0;
    fromMock.mockImplementation((table: string) =>
      table === 'tryon_shops' ? (shopQueries++ === 0 ? own : team) : jobs,
    );

    const result = await listManagedTryOnShops();

    expect(team.inCalls).toEqual([['owner_clerk_user_id', ['user_owner']]]);
    expect(result.map((shop) => [shop.domain, shop.role])).toEqual([
      ['mine.myshopify.com', 'owner'],
      ['maison.myshopify.com', 'admin'],
    ]);
  });
});
