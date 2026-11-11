// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ paste: vi.fn(), woo: vi.fn(), facts: vi.fn(), zone: vi.fn(), shop: null as unknown, error: null as unknown }));
vi.mock('@/lib/paste/store', () => ({ listActivePasteSiteIds: mocks.paste }));
vi.mock('@/lib/woo/connection', () => ({ listActiveWooSiteIds: mocks.woo }));
vi.mock('@/lib/dashboard/your-store-data', () => ({ getYourStoreFacts: mocks.facts }));
vi.mock('@/lib/dashboard/active-store-server', () => ({ getActiveStoreTimeZone: mocks.zone }));
vi.mock('@/lib/messenger/db', () => ({ getMessengerServiceClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: mocks.shop, error: mocks.error }) }) }) }) }) }));
import { readAlertStoreFacts } from './alerts-data';
const site = { id: '11111111-1111-4111-8111-111111111111', name: 'Lulu', domain: 'lulu.myshopify.com', workspace_id: 'ws', settings_json: {} };
beforeEach(() => { vi.clearAllMocks(); mocks.paste.mockResolvedValue(new Set()); mocks.woo.mockResolvedValue(new Set()); mocks.shop = null; mocks.error = null; mocks.zone.mockResolvedValue('UTC'); mocks.facts.mockResolvedValue(null); });
describe('background check facts use the dashboard data model without request identity', () => {
  it.each(['paste', 'woocommerce'] as const)('resolves %s with the same site tenant as the dashboard', async (platform) => {
    (platform === 'paste' ? mocks.paste : mocks.woo).mockResolvedValue(new Set([site.id]));
    await readAlertStoreFacts(site, 100);
    expect(mocks.facts).toHaveBeenCalledWith(expect.objectContaining({ activeStore: expect.objectContaining({ platform, siteId: site.id, tenantKey: `site:${site.id}` }), now: 100, timeZone: 'UTC' }));
  });
  it('supplies a service-read Shopify install status instead of calling the dashboard shop list', async () => {
    mocks.shop = { shop_domain: site.domain, status: 'installed', last_seen_at: '2026-11-11T00:00:00Z' };
    await readAlertStoreFacts(site, 100);
    expect(mocks.facts).toHaveBeenCalledWith(expect.objectContaining({ installedShop: true, activeStore: expect.objectContaining({ platform: 'shopify', shopDomain: site.domain }) }));
  });
  it('propagates a failed connection read instead of fabricating healthy facts', async () => {
    mocks.woo.mockRejectedValue(new Error('offline')); await expect(readAlertStoreFacts(site, 100)).rejects.toThrow('offline'); expect(mocks.facts).not.toHaveBeenCalled();
  });
});
