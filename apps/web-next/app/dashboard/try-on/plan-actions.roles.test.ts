// @vitest-environment node
/* Item 12: billing is the owner's alone. An admin or a member of the shop's
   team calls every billing action through the real shop check, and every
   one is refused before any plan, catalogue or ledger work. The callers are
   configured as platform operators too, so the refusal is their role's. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RoleNotAllowedError } from '@/lib/rbac/dashboard-policy';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  listTeamMemberships: vi.fn(),
  getShopEntitlement: vi.fn(),
  listEntitlementCatalog: vi.fn(),
  reconcileShopSubscription: vi.fn(),
  runOwnerEntitlementMutation: vi.fn(),
}));

vi.mock('@clerk/nextjs/server', () => ({ auth: mocks.auth }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/request-rate-limit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/request-rate-limit')>()),
  requireMerchantRateLimit: vi.fn(),
}));
vi.mock('@/lib/try-on/settings', () => ({ getTryOnSettings: vi.fn() }));
vi.mock('@/lib/try-on/entitlement', () => ({
  getShopEntitlement: mocks.getShopEntitlement,
  listEntitlementCatalog: mocks.listEntitlementCatalog,
  reconcileShopSubscription: mocks.reconcileShopSubscription,
  runOwnerEntitlementMutation: mocks.runOwnerEntitlementMutation,
}));
vi.mock('@/lib/rbac/store-role', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/rbac/store-role')>()),
  listTeamMemberships: mocks.listTeamMemberships,
}));

const SHOP = { shop_domain: 'maison.myshopify.com', owner_clerk_user_id: 'user_owner' };

/* tryon_shops as the shop check queries it: by domain and installed, then
   either the caller as owner or the owners of the caller's teams. */
function shopsTable() {
  const eq: Record<string, unknown> = {};
  let owners: string[] | null = null;
  const builder = {
    select: () => builder,
    eq: (column: string, value: unknown) => {
      eq[column] = value;
      return builder;
    },
    in: (column: string, values: string[]) => {
      if (column === 'owner_clerk_user_id') owners = values;
      return builder;
    },
    maybeSingle: async () => {
      const visible =
        eq.shop_domain === SHOP.shop_domain &&
        eq.status === 'installed' &&
        (eq.owner_clerk_user_id === SHOP.owner_clerk_user_id || Boolean(owners?.includes(SHOP.owner_clerk_user_id)));
      return { data: visible ? SHOP : null, error: null };
    },
  };
  return builder;
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: () => shopsTable() }),
}));

import { activatePlan, applyTopUp, getShopPlanState, listPlansCatalog, renewPlan, scheduleDowngrade } from './plan-actions';

const shop = SHOP.shop_domain;
const billingActions = [
  ['activatePlan', () => activatePlan({ shop, planKey: 'growth-v1', note: 'paid', actionKey: 'a' })],
  ['renewPlan', () => renewPlan({ shop, note: 'renewed', actionKey: 'b' })],
  ['applyTopUp', () => applyTopUp({ shop, packKey: 'pack-80', note: 'top-up', actionKey: 'c' })],
  ['scheduleDowngrade', () => scheduleDowngrade({ shop, planKey: 'free-v1', actionKey: 'd' })],
] as const;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key');
  vi.stubEnv('TRYON_PLATFORM_OPERATOR_CLERK_IDS', 'user_owner,user_admin,user_member');
  mocks.getShopEntitlement.mockResolvedValue({ shop, status: 'active' });
  mocks.listEntitlementCatalog.mockResolvedValue({ plans: [], packs: [] });
  mocks.runOwnerEntitlementMutation.mockResolvedValue({ actionKey: 'a', replayed: false, ledgerEntryIds: [] });
});

afterEach(() => vi.unstubAllEnvs());

describe.each(['admin', 'member'] as const)('a team %s', (role) => {
  beforeEach(() => {
    mocks.auth.mockResolvedValue({ userId: `user_${role}` });
    mocks.listTeamMemberships.mockResolvedValue([
      { workspaceId: 'ws_owner', ownerClerkUserId: 'user_owner', role },
    ]);
  });

  it.each(billingActions)('is refused %s', async (_name, call) => {
    await expect(call()).resolves.toMatchObject({ ok: false, code: 'forbidden' });
    expect(mocks.runOwnerEntitlementMutation).not.toHaveBeenCalled();
    expect(mocks.getShopEntitlement).not.toHaveBeenCalled();
  });

  it('is refused the plan state and the plan catalogue', async () => {
    await expect(getShopPlanState(shop)).rejects.toBeInstanceOf(RoleNotAllowedError);
    await expect(listPlansCatalog(shop)).rejects.toBeInstanceOf(RoleNotAllowedError);
    expect(mocks.reconcileShopSubscription).not.toHaveBeenCalled();
    expect(mocks.getShopEntitlement).not.toHaveBeenCalled();
    expect(mocks.listEntitlementCatalog).not.toHaveBeenCalled();
  });
});

describe("the shop's owner", () => {
  beforeEach(() => {
    mocks.auth.mockResolvedValue({ userId: 'user_owner' });
    mocks.listTeamMemberships.mockResolvedValue([]);
  });

  it.each(billingActions)('may %s', async (_name, call) => {
    await expect(call()).resolves.toMatchObject({ ok: true });
    expect(mocks.runOwnerEntitlementMutation).toHaveBeenCalledOnce();
  });

  it('reads the plan state and the catalogue', async () => {
    await expect(getShopPlanState(shop)).resolves.toMatchObject({ shop });
    await expect(listPlansCatalog(shop)).resolves.toEqual({ plans: [], packs: [] });
  });
});

it('refuses someone on no team of the shop, as an unknown shop', async () => {
  mocks.auth.mockResolvedValue({ userId: 'user_admin' });
  mocks.listTeamMemberships.mockResolvedValue([
    { workspaceId: 'ws_other', ownerClerkUserId: 'user_someone_else', role: 'admin' },
  ]);
  await expect(renewPlan({ shop, note: '', actionKey: 'e' })).resolves.toMatchObject({ ok: false, code: 'forbidden' });
  await expect(getShopPlanState(shop)).rejects.toThrow('Unknown Shopify shop');
  expect(mocks.runOwnerEntitlementMutation).not.toHaveBeenCalled();
});
