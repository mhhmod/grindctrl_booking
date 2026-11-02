// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlanCatalogItem } from '@/lib/try-on/entitlement';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(), from: vi.fn(), getShopToken: vi.fn(), adminGraphql: vi.fn(),
  findApp: vi.fn(), listCatalog: vi.fn(), invalidate: vi.fn(),
}));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ rpc: mocks.rpc, from: mocks.from }) }));
vi.mock('./tokens', () => ({ getShopToken: mocks.getShopToken }));
vi.mock('./admin', () => ({ adminGraphql: mocks.adminGraphql }));
vi.mock('./app-registry', () => ({ findShopifyAppByClientId: mocks.findApp }));
vi.mock('./proxy-config-cache', () => ({ invalidateProxyConfig: mocks.invalidate }));
vi.mock('@/lib/try-on/entitlement', () => ({ listEntitlementCatalog: mocks.listCatalog }));

import { getShopifyAppPricingPresentation, mapShopifyPricingSnapshot, reconcileShopifyAppPricing, type ShopifyPricingPlan } from './app-pricing';

const SHOP = 'maison.myshopify.com';
const APP = 'public-app';
const INSTALLATION = '11111111-1111-4111-8111-111111111111';
const END = '2026-12-01T00:00:00.000Z';
const catalog: ShopifyPricingPlan[] = ['free', 'launch', 'growth', 'pro'].map((handle, i) => ({
  plan_key: `${handle}-${i === 0 ? 'v2' : 'v1'}`, currency: 'USD', active: true, is_free: i === 0,
  external_refs: { shopify_app_pricing: { handle } },
}));
const snapshot = (name = 'Launch', status = 'ACTIVE', currentPeriodEnd: string | null = END) => ({
  currentAppInstallation: { activeSubscriptions: [{ name, status, currentPeriodEnd }], app: { handle: 'grindctrl' } },
});
const emptySnapshot = { currentAppInstallation: { activeSubscriptions: [], app: { handle: null } } };

function queryResult(data: unknown) {
  const result = { data, error: null };
  const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(), then: Promise.resolve(result).then.bind(Promise.resolve(result)) };
  query.select.mockReturnValue(query); query.eq.mockReturnValue(query); query.maybeSingle.mockResolvedValue(result);
  return query;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-02T00:00:00Z'));
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-only');
  vi.stubEnv('SHOPIFY_PUBLIC_APP_HANDLE', '');
  mocks.findApp.mockReturnValue({ clientId: APP, secret: 'test-only', distribution: 'public' });
  mocks.getShopToken.mockResolvedValue({ accessToken: 'installation-token', appClientId: APP, installationId: INSTALLATION });
  mocks.from.mockImplementation((table: string) => queryResult(table === 'tryon_plans' ? catalog : { pricing_app_handle: 'grindctrl' }));
  mocks.rpc.mockImplementation(async (_name, args) => ({ data: { status: args.p_operation === 'claim' ? 'acquired' : 'applied' }, error: null }));
  mocks.adminGraphql.mockResolvedValue(snapshot());
  mocks.listCatalog.mockResolvedValue({ plans: catalog.map(plan => ({
    planKey: plan.plan_key, currency: plan.currency, active: true,
  } as PlanCatalogItem)), packs: [] });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe('Shopify App Pricing catalog mapping', () => {
  it.each(['Free', 'Launch', 'Growth', 'Pro'])('maps %s using the USD catalog reference', (name) => {
    expect(mapShopifyPricingSnapshot(snapshot(` ${name} `), catalog).planKey).toBe(`${name.toLowerCase()}-${name === 'Free' ? 'v2' : 'v1'}`);
  });
  it('uses Free for an authoritative empty subscription list', () => {
    expect(mapShopifyPricingSnapshot(emptySnapshot, catalog)).toEqual({ planKey: 'free-v2', currentPeriodEnd: null, appHandle: null });
  });
  it('does not grant paid looks for a non-active subscription', () => {
    expect(mapShopifyPricingSnapshot(snapshot('Pro', 'FROZEN', null), catalog).planKey).toBe('free-v2');
  });
  it('rejects unknown names, missing refs, retired plans and non-USD equivalents', () => {
    expect(() => mapShopifyPricingSnapshot(snapshot('Enterprise'), catalog)).toThrow('unknown_plan');
    for (const override of [{ external_refs: {} }, { active: false }, { currency: 'EGP' }, { plan_key: 'launch-v1-egp' }]) {
      expect(() => mapShopifyPricingSnapshot(snapshot(), catalog.map(plan => ({ ...plan, ...override })))).toThrow('unknown_plan');
    }
  });
  it('rejects malformed data instead of interpreting it as Free', () => {
    for (const input of [null, {}, { currentAppInstallation: {} }, { currentAppInstallation: { activeSubscriptions: [null] } }, snapshot('Launch', 'UNKNOWN')]) {
      expect(() => mapShopifyPricingSnapshot(input, catalog)).toThrow('invalid_snapshot');
    }
  });
  it('rejects ambiguous subscriptions and duplicate mappings', () => {
    const data = snapshot(); data.currentAppInstallation.activeSubscriptions.push(snapshot('Pro').currentAppInstallation.activeSubscriptions[0]);
    expect(() => mapShopifyPricingSnapshot(data, catalog)).toThrow('ambiguous_subscription');
    expect(() => mapShopifyPricingSnapshot(snapshot(), [...catalog, catalog[1]])).toThrow('unknown_plan');
  });
  it.each([null, 'bad', '2026-10-01T00:00:00Z'])('rejects paid plans with invalid/expired period %s', (end) => {
    expect(() => mapShopifyPricingSnapshot(snapshot('Launch', 'ACTIVE', end), catalog)).toThrow('invalid_period');
  });
});

describe('authoritative reconciliation', () => {
  it('claims before reading Shopify with this installation token, then applies the catalog plan', async () => {
    await reconcileShopifyAppPricing({ shopDomain: SHOP, appClientId: APP, source: 'webhook' });
    expect(mocks.getShopToken).toHaveBeenCalledWith(SHOP, APP);
    expect(mocks.rpc.mock.calls[0][1]).toMatchObject({ p_installation: INSTALLATION, p_operation: 'claim', p_payload: { distribution: 'public', force: true } });
    expect(mocks.adminGraphql).toHaveBeenCalledWith(expect.objectContaining({ shopDomain: SHOP, accessToken: 'installation-token' }));
    expect(mocks.rpc.mock.calls[0][1].p_lease).toBe(mocks.rpc.mock.calls[1][1].p_lease);
    expect(mocks.rpc.mock.calls[1][1]).toMatchObject({ p_operation: 'apply', p_payload: { plan_key: 'launch-v1', current_period_end: END, app_handle: 'grindctrl' } });
    expect(mocks.rpc.mock.invocationCallOrder[0]).toBeLessThan(mocks.adminGraphql.mock.invocationCallOrder[0]);
    expect(mocks.invalidate).toHaveBeenCalledWith(SHOP);
  });
  it('rereads authoritative state on replay and delayed webhook delivery', async () => {
    mocks.adminGraphql.mockResolvedValueOnce(snapshot()).mockResolvedValueOnce(snapshot('Growth')).mockResolvedValueOnce(snapshot('Growth'));
    for (let i = 0; i < 3; i++) await reconcileShopifyAppPricing({ shopDomain: SHOP, appClientId: APP, source: 'webhook' });
    expect(mocks.rpc.mock.calls.filter(([, args]) => args.p_operation === 'apply').map(([, args]) => args.p_payload.plan_key))
      .toEqual(['launch-v1', 'growth-v1', 'growth-v1']);
  });
  it.each(['custom', undefined])('ignores distribution %s without token/storage/API access', async (distribution) => {
    mocks.findApp.mockReturnValue({ clientId: APP, distribution });
    await reconcileShopifyAppPricing({ shopDomain: SHOP, appClientId: APP, source: 'webhook' });
    expect(mocks.getShopToken).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled(); expect(mocks.adminGraphql).not.toHaveBeenCalled();
  });
  it.each([null, { accessToken: 'other', installationId: INSTALLATION, appClientId: 'another-app' }])('fails without this installation credential', async (token) => {
    mocks.getShopToken.mockResolvedValue(token);
    await expect(reconcileShopifyAppPricing({ shopDomain: SHOP, appClientId: APP, source: 'webhook' })).rejects.toThrow('missing_token');
    expect(mocks.rpc).not.toHaveBeenCalled(); expect(mocks.adminGraphql).not.toHaveBeenCalled();
  });
  it('uses durable bootstrap throttling without rereading Shopify', async () => {
    mocks.rpc.mockResolvedValue({ data: { status: 'throttled' }, error: null });
    await reconcileShopifyAppPricing({ shopDomain: SHOP, appClientId: APP, source: 'bootstrap' });
    expect(mocks.adminGraphql).not.toHaveBeenCalled();
    expect(mocks.rpc.mock.calls[0][1].p_payload.force).toBe(false);
  });
  it.each(['busy', 'unavailable', 'ignored', 'throttled', 'unknown'])('retries a webhook when claim is %s', async (status) => {
    mocks.rpc.mockResolvedValue({ data: { status }, error: null });
    await expect(reconcileShopifyAppPricing({ shopDomain: SHOP, appClientId: APP, source: 'webhook' })).rejects.toThrow('reconciliation_unavailable');
    expect(mocks.adminGraphql).not.toHaveBeenCalled();
  });
  it('releases on provider failure and never downgrades to Free', async () => {
    mocks.adminGraphql.mockRejectedValue(new Error('provider unavailable'));
    await expect(reconcileShopifyAppPricing({ shopDomain: SHOP, appClientId: APP, source: 'webhook' })).rejects.toThrow('provider unavailable');
    expect(mocks.rpc.mock.calls.map(([, args]) => args.p_operation)).toEqual(['claim', 'release']);
    expect(mocks.invalidate).not.toHaveBeenCalled();
  });
  it('rejects a lost fence rather than reporting success', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { status: 'acquired' }, error: null }).mockResolvedValueOnce({ data: null, error: { message: 'lease expired' } });
    await expect(reconcileShopifyAppPricing({ shopDomain: SHOP, appClientId: APP, source: 'webhook' })).rejects.toThrow('storage_unavailable');
    expect(mocks.invalidate).not.toHaveBeenCalled();
  });
});

describe('embedded pricing metadata', () => {
  it('builds the hosted URL from this installation cached handle, retaining only active USD plans', async () => {
    const query = queryResult({ pricing_app_handle: 'grindctrl-public' }); mocks.from.mockReturnValue(query);
    const data = await getShopifyAppPricingPresentation({ shopDomain: SHOP, appClientId: APP });
    expect(data.pricingPlansUrl).toBe('https://admin.shopify.com/store/maison/charges/grindctrl-public/pricing_plans');
    expect(query.eq).toHaveBeenCalledWith('app_client_id', APP); expect(query.eq).toHaveBeenCalledWith('shop_domain', SHOP);
    expect(data.plans).toHaveLength(4); expect(mocks.adminGraphql).not.toHaveBeenCalled();
  });
  it('prefers the runtime environment override', async () => {
    vi.stubEnv('SHOPIFY_PUBLIC_APP_HANDLE', 'public-override');
    expect((await getShopifyAppPricingPresentation({ shopDomain: SHOP, appClientId: APP })).pricingPlansUrl).toContain('/public-override/');
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it.each([null, '', '../escape', 'https://evil.example'])('omits the hosted action for unresolved/invalid handle %s', async (value) => {
    mocks.from.mockReturnValue(queryResult({ pricing_app_handle: value }));
    expect((await getShopifyAppPricingPresentation({ shopDomain: SHOP, appClientId: APP })).pricingPlansUrl).toBeNull();
  });
  it.each(['custom', undefined])('shows manual metadata for %s without handle lookup', async (distribution) => {
    mocks.findApp.mockReturnValue({ clientId: APP, distribution });
    const data = await getShopifyAppPricingPresentation({ shopDomain: SHOP, appClientId: APP });
    expect(data.distribution).toBe(distribution ?? 'development'); expect(data.pricingPlansUrl).toBeNull();
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
