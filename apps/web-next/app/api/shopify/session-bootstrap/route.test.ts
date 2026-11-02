// @vitest-environment node
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({
  verify: vi.fn(), acquire: vi.fn(), requestToken: vi.fn(), sync: vi.fn(), syncOrigin: vi.fn(), limit: vi.fn(),
  reconcilePricing: vi.fn(), pricingPresentation: vi.fn(),
}));
vi.mock('@/lib/shopify/admin', () => ({ syncShopifyAppOrigin: m.syncOrigin }));
vi.mock('@/lib/shopify/app-pricing', () => ({
  reconcileShopifyAppPricing: m.reconcilePricing, getShopifyAppPricingPresentation: m.pricingPresentation,
}));
vi.mock('@/lib/shopify/session-token', () => ({ verifySessionTokenResolved: m.verify }));
vi.mock('@/lib/shopify/tokens', async () => {
  const actual = await vi.importActual<typeof import('@/lib/shopify/tokens')>('@/lib/shopify/tokens');
  return { ...actual, acquireShopToken: m.acquire, requestShopifyToken: m.requestToken };
});
vi.mock('@/lib/messenger/shop-domain-sync', () => ({ syncShopStorefrontDomains: m.sync }));
vi.mock('@/lib/ratelimit', () => ({ publicApiRatelimit: { limit: m.limit }, clientIp: () => 'test-ip' }));
import { GET } from './route';
import { ShopifyCredentialError } from '@/lib/shopify/tokens';
function req(auth = 'Bearer id-token') { return new NextRequest('https://grindctrl.cloud/api/shopify/session-bootstrap', { headers: { authorization: auth } }); }
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv('SHOPIFY_APPS', JSON.stringify([{ clientId: 'app-a', secret: 'a' }, { clientId: 'app-b', secret: 'b' }]));
  vi.stubEnv('SHOPIFY_API_KEY', ''); vi.stubEnv('SHOPIFY_API_SECRET', '');
  m.verify.mockReturnValue({ shop: 'demo.myshopify.com', app: { clientId: 'app-b', secret: 'b' } });
  m.limit.mockResolvedValue({ success: true, reset: Date.now() + 1000 });
  m.acquire.mockResolvedValue({ accessToken: 'stored-b', appClientId: 'app-b' });
  m.reconcilePricing.mockResolvedValue(undefined);
  m.pricingPresentation.mockResolvedValue({ distribution: 'development', pricingPlansUrl: null, plans: [] });
});
afterEach(() => vi.unstubAllEnvs());
describe('installation-aware token bootstrap', () => {
  it('binds acquisition and expiring exchange to the verified second app', async () => {
    expect((await GET(req())).status).toBe(200);
    const args = m.acquire.mock.calls[0][0];
    expect(args).toMatchObject({ shopDomain: 'demo.myshopify.com', appClientId: 'app-b' });
    await args.exchange();
    expect(m.requestToken).toHaveBeenCalledWith('demo.myshopify.com', expect.objectContaining({
      client_id: 'app-b', client_secret: 'b', subject_token: 'id-token', expiring: 1,
    }));
    expect(m.sync).toHaveBeenCalledWith('demo.myshopify.com', 'stored-b');
    expect(m.syncOrigin).toHaveBeenCalledWith('demo.myshopify.com', 'stored-b');
    expect(m.reconcilePricing).not.toHaveBeenCalled();
    expect(m.pricingPresentation).toHaveBeenCalledWith({ shopDomain: 'demo.myshopify.com', appClientId: 'app-b' });
  });
  it('allows explicit eligible custom non-expiring mode without changing public defaults', async () => {
    m.verify.mockReturnValue({ shop: 'demo.myshopify.com', app: { clientId: 'app-b', secret: 'b', tokenMode: 'non-expiring' } });
    await GET(req()); await m.acquire.mock.calls[0][0].exchange();
    expect(m.requestToken.mock.calls[0][1].expiring).toBe(0);
  });
  it('rejects invalid identity before acquisition or domain sync', async () => {
    m.verify.mockReturnValue(null);
    expect((await GET(req())).status).toBe(401);
    expect(m.acquire).not.toHaveBeenCalled(); expect(m.sync).not.toHaveBeenCalled();
    expect(m.syncOrigin).not.toHaveBeenCalled();
    expect(m.reconcilePricing).not.toHaveBeenCalled();
    expect(m.pricingPresentation).not.toHaveBeenCalled();
  });

  it('reconciles public pricing after token acquisition and returns installation-specific plan metadata', async () => {
    m.verify.mockReturnValue({ shop: 'demo.myshopify.com', app: { clientId: 'app-b', secret: 'b', distribution: 'public' } });
    const appPricing = { distribution: 'public', pricingPlansUrl: 'https://admin.shopify.com/store/demo/charges/grindctrl/pricing_plans', plans: [] };
    m.pricingPresentation.mockResolvedValue(appPricing);
    const response = await GET(req());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, provisioned: 'ready', appClientId: 'app-b', appPricing });
    expect(m.reconcilePricing).toHaveBeenCalledExactlyOnceWith({
      shopDomain: 'demo.myshopify.com', appClientId: 'app-b', source: 'bootstrap',
    });
    expect(m.acquire.mock.invocationCallOrder[0]).toBeLessThan(m.reconcilePricing.mock.invocationCallOrder[0]);
    expect(m.reconcilePricing.mock.invocationCallOrder[0]).toBeLessThan(m.pricingPresentation.mock.invocationCallOrder[0]);
  });

  it('keeps custom pricing on the manual path', async () => {
    m.verify.mockReturnValue({ shop: 'demo.myshopify.com', app: { clientId: 'app-b', secret: 'b', distribution: 'custom' } });
    m.pricingPresentation.mockResolvedValue({ distribution: 'custom', pricingPlansUrl: null, plans: [] });
    const response = await GET(req());
    expect(response.status).toBe(200);
    expect((await response.json()).appPricing.distribution).toBe('custom');
    expect(m.reconcilePricing).not.toHaveBeenCalled();
  });

  it('still loads the app when public pricing cannot be reconciled, without leaking the error', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    m.verify.mockReturnValue({ shop: 'demo.myshopify.com', app: { clientId: 'app-b', secret: 'b', distribution: 'public' } });
    m.reconcilePricing.mockRejectedValue(new Error('provider token secret'));
    const response = await GET(req());
    expect(response.status).toBe(200);
    expect(await response.text()).not.toContain('provider token secret');
    expect(m.pricingPresentation).toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith('[shopify-pricing] bootstrap reconciliation deferred', 'unknown');
    log.mockRestore();
  });
  it('returns no pricing when the presentation cannot be read', async () => {
    m.verify.mockReturnValue({ shop: 'demo.myshopify.com', app: { clientId: 'app-b', secret: 'b', distribution: 'public' } });
    m.pricingPresentation.mockRejectedValue(new Error('shopify_pricing_storage_unavailable'));
    const response = await GET(req());
    expect(response.status).toBe(200);
    expect((await response.json()).appPricing).toBeNull();
  });
  it('does not acquire when the shared limiter is unavailable', async () => {
    m.limit.mockResolvedValue(null);
    expect((await GET(req())).status).toBe(503);
    expect(m.acquire).not.toHaveBeenCalled();
    expect(m.syncOrigin).not.toHaveBeenCalled();
  });
  it.each(['busy','storage_unavailable','exchange_failed'] as const)('reports %s without exposing secrets', async code => {
    m.acquire.mockRejectedValue(new ShopifyCredentialError(code));
    const response = await GET(req());
    expect(response.status).toBe(code === 'busy' ? 409 : 503);
    expect(m.sync).not.toHaveBeenCalled();
    expect(m.syncOrigin).not.toHaveBeenCalled();
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
});
