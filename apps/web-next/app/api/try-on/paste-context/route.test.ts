// @vitest-environment node
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ network: vi.fn(), visitor: vi.fn(), siteLimit: vi.fn(), site: vi.fn(), connection: vi.fn(),
  hosts: vi.fn(), signal: vi.fn(), signature: vi.fn(), active: vi.fn(), flags: vi.fn(), launch: vi.fn(), storeLaunch: vi.fn(), lookup: vi.fn() }));
vi.mock('@/lib/ratelimit', () => ({ clientIp: () => '203.0.113.5', publicApiRatelimit: { limit: m.network },
  proxyVisitorRatelimit: { limit: m.visitor }, proxyShopMintRatelimit: { limit: m.siteLimit } }));
vi.mock('@/lib/messenger/public-api', async (original) => ({ ...await original<object>(), loadPublicSite: m.site }));
vi.mock('@/lib/paste/store', () => ({ getPasteConnection: m.connection, pasteTrustedHosts: m.hosts, recordPasteSignal: m.signal }));
vi.mock('@/lib/paste/signing', async (original) => ({ ...await original<object>(), verifyLiquidSignature: m.signature }));
vi.mock('@/lib/shopify/tokens', () => ({ isActiveTenant: m.active }));
vi.mock('@/lib/flags/store-flags', () => ({ storeFlags: m.flags }));
vi.mock('@/lib/woo/tryon-site', () => ({ readSiteLaunch: m.launch }));
vi.mock('@/lib/launch/store-launch', () => ({ getStoreLaunch: m.storeLaunch }));
vi.mock('@/lib/woo/tryon-config', () => ({ buildSiteTryOnConfig: async () => ({ enabled: true }), siteConfigLocale: () => 'en' }));
vi.mock('@/lib/woo/garment-url', async (original) => {
  const actual = await original<typeof import('@/lib/woo/garment-url')>();
  return { ...actual, assertSafeGarmentUrl: (url: unknown, hosts: string[]) => actual.assertSafeGarmentUrl(url, hosts, m.lookup) };
});

import { POST, OPTIONS } from './route';
import { resolveMessengerConfig } from '@/lib/messenger/config';
import { verifyStorefrontContext } from '@/lib/try-on/storefront-context';
import { pasteCapabilitySecret } from '@/lib/paste/signing';
import { signPreviewToken } from '@/lib/launch/preview-token';
import { signOriginToken } from '@/lib/messenger/identity';

const SITE = '11111111-1111-4111-8111-111111111111';
const CORE = 'test-only-independent-core-signing-secret-for-paste';
const body = { key: 'gc_public_key_42', productId: '42', variantId: '77', title: 'Tee', imageUrl: 'https://merchant.example/tee.jpg',
  pageUrl: 'https://merchant.example/products/tee', visitorId: 'visitor_abcdefghijklmnop' };
const connection = { widget_site_id: SITE, platform: 'website', shop_domain: null, status: 'active', secret_version: 1 };
const site = { id: SITE, embed_key: body.key, name: 'Merchant', status: 'active', settings_version: 1, workspace_id: 'workspace-a', domain: null,
  config: resolveMessengerConfig({}), security: { allow_localhost: false },
  patterns: [{ pattern: 'merchant.example', verification_status: 'trusted', verification_method: 'paste_trusted', environment: 'production' }] };

async function post(over: Record<string, unknown> = {}, origin = 'https://merchant.example') {
  return POST(new NextRequest('https://grindctrl.cloud/api/try-on/paste-context', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify({ ...body, ...over }),
  }));
}

beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv('GRINDCTRL_CAPABILITY_SECRET', CORE);
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://grindctrl.cloud');
  m.network.mockResolvedValue({ success: true, reset: Date.now() + 1000 });
  m.visitor.mockResolvedValue({ success: true, reset: Date.now() + 1000 });
  m.siteLimit.mockResolvedValue({ success: true, reset: Date.now() + 1000 });
  m.site.mockResolvedValue(site); m.connection.mockResolvedValue(connection); m.hosts.mockResolvedValue(['merchant.example', 'www.merchant.example']);
  m.signal.mockResolvedValue('granted'); m.signature.mockResolvedValue({ ok: true }); m.active.mockResolvedValue(true);
  m.flags.mockResolvedValue([]); m.launch.mockResolvedValue({ launch: { tryOn: 'live', reason: null }, unsubscribed: false });
  m.lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
});
afterEach(() => vi.unstubAllEnvs());

describe('paste context trust boundary', () => {
  it('mints a site tenant capability with the existing 2 minute TTL', async () => {
    const response = await post(); const result = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('access-control-allow-origin')).toBe('https://merchant.example');
    const claims = verifyStorefrontContext(pasteCapabilitySecret(SITE)!, result.context.token)!;
    expect(claims).toMatchObject({ shop: `site:${SITE}`, platform: 'paste-website', productGid: 'paste:42', origin: 'https://merchant.example' });
    expect(claims.exp - claims.iat).toBe(120);
    expect(result.embedUrl).toContain('#storefrontContext=');
    expect(m.signal).toHaveBeenCalledWith(SITE, 'https://merchant.example');
  });
  it.each(['shop', 'tenant', 'siteId'])('refuses caller-selected %s', async (field) => {
    expect((await post({ [field]: 'someone-else' })).status).toBe(400);
    expect(m.signal).not.toHaveBeenCalled();
  });
  it('rejects a different origin, page origin, subdomain, scheme or query-only claim', async () => {
    expect((await post({}, 'https://evil.example')).status).toBe(403);
    expect((await post({ pageUrl: 'https://evil.example/tee' })).status).toBe(403);
    expect((await post({ pageUrl: 'https://sub.merchant.example/tee' }, 'https://sub.merchant.example')).status).toBe(403);
    expect((await post({ pageUrl: 'http://merchant.example/tee' }, 'http://merchant.example')).status).toBe(403);
    expect((await post({ origin: 'https://merchant.example' }, '')).status).toBe(403);
    expect(m.signal).not.toHaveBeenCalled();
  });
  it('accepts a signed storefront origin token from the own-domain iframe', async () => {
    const originToken = signOriginToken(CORE, { key: body.key, origin: 'https://merchant.example' });
    expect((await post({ originToken }, 'https://grindctrl.cloud')).status).toBe(200);
    const wrong = signOriginToken(CORE, { key: 'other_key', origin: 'https://merchant.example' });
    expect((await post({ originToken: wrong }, 'https://grindctrl.cloud')).status).toBe(403);
  });
  it('enforces Shopify Liquid claims and never uses a caller-selected site', async () => {
    m.connection.mockResolvedValue({ ...connection, platform: 'shopify', shop_domain: 'merchant.myshopify.com' });
    expect((await post()).status).toBe(401);
    const signed = { siteId: SITE, shopDomain: 'merchant.myshopify.com', productId: '42', variantId: '77', issuedAt: '2000000000', customerId: '', signature: 'a'.repeat(64) };
    const response = await post({ signed });
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(verifyStorefrontContext(pasteCapabilitySecret(SITE)!, result.context.token)?.platform).toBe('paste-shopify');
    expect(m.signature).toHaveBeenCalledWith(expect.objectContaining({ connection: expect.objectContaining({ widget_site_id: SITE }) }));
    expect((await post({ signed: { ...signed, productId: '99' } })).status).toBe(401);
  });
  it('serves a Shopify store that only uses its .myshopify.com address, signalling that shop host', async () => {
    const shopConnection = { ...connection, platform: 'shopify', shop_domain: 'merchant.myshopify.com' };
    m.connection.mockResolvedValue(shopConnection);
    m.site.mockResolvedValue({ ...site, patterns: [], pasteShopDomain: 'merchant.myshopify.com' });
    m.hosts.mockResolvedValue(['merchant.myshopify.com']);
    const signed = { siteId: SITE, shopDomain: 'merchant.myshopify.com', productId: '42', variantId: '77', issuedAt: '2000000000', customerId: '', signature: 'a'.repeat(64) };
    const response = await post({ signed, pageUrl: 'https://merchant.myshopify.com/products/tee',
      imageUrl: 'https://cdn.shopify.com/s/files/tee.jpg' }, 'https://merchant.myshopify.com');
    expect(response.status).toBe(200);
    expect(m.hosts).toHaveBeenCalledWith(shopConnection);
    expect(m.signal).toHaveBeenCalledWith(SITE, 'https://merchant.myshopify.com');
    expect(verifyStorefrontContext(pasteCapabilitySecret(SITE)!, (await response.json()).context.token)?.origin).toBe('https://merchant.myshopify.com');
    m.signal.mockClear();
    expect((await post({ signed, pageUrl: 'https://other.myshopify.com/products/tee' }, 'https://other.myshopify.com')).status).toBe(403);
    expect(m.signal).not.toHaveBeenCalled();
  });
  it.each([['bad_signature', 401], ['stale_signature', 401], ['replayed', 409], ['unavailable', 503]])('returns %s before signaling/granting', async (code, status) => {
    m.connection.mockResolvedValue({ ...connection, platform: 'shopify' });
    m.signature.mockResolvedValue({ ok: false, code });
    const response = await post({ signed: { siteId: SITE, shopDomain: 'merchant.myshopify.com', productId: '42', variantId: '77', issuedAt: '2000000000', customerId: '', signature: 'a'.repeat(64) } });
    expect(response.status).toBe(status); expect(m.signal).not.toHaveBeenCalled();
  });
  it.each([['redis', null], ['timeout', { success: true, reason: 'timeout', reset: Date.now() + 1000 }], ['malformed', { success: true }]])('denies when rate enforcement fails: %s', async (_name, result) => {
    if (result === null) m.siteLimit.mockRejectedValue(new Error('Redis failed'));
    else m.siteLimit.mockResolvedValue(result);
    expect((await post()).status).toBe(503); expect(m.signal).not.toHaveBeenCalled();
  });
  it('denies rate-limited traffic before any site access', async () => {
    m.network.mockResolvedValue({ success: false, reset: Date.now() + 2000 });
    expect((await post()).status).toBe(429); expect(m.site).not.toHaveBeenCalled();
  });
  it('enforces launch preview and signed test-look exemption', async () => {
    m.flags.mockResolvedValue(['n5_preview_mode']); m.storeLaunch.mockResolvedValue({ state: 'preview', salt: 'salt' });
    expect((await post()).status).toBe(409);
    m.launch.mockResolvedValue({ launch: { tryOn: 'hidden', reason: 'out_of_looks' }, unsubscribed: false });
    const preview = signPreviewToken(CORE, `site:${SITE}`).token;
    const result = await (await post({ preview })).json();
    expect(verifyStorefrontContext(pasteCapabilitySecret(SITE)!, result.context.token)?.test).toBe(true);
    expect(result.turnstile).toBeNull();
  });
  it('does not exempt an unsigned test=true request', async () => {
    const result = await (await post({ test: true })).json();
    expect(verifyStorefrontContext(pasteCapabilitySecret(SITE)!, result.context.token)?.test).toBeUndefined();
    expect(result.turnstile).toHaveProperty('action', 'paste_tryon');
  });
  it('rejects unsafe/private garments before the free grant', async () => {
    expect((await post({ imageUrl: 'https://attacker.example/tee.jpg' })).status).toBe(422);
    m.lookup.mockResolvedValue([{ address: '127.0.0.1', family: 4 }]);
    expect((await post()).status).toBe(422); expect(m.signal).not.toHaveBeenCalled();
  });
  it('denies another free plan for a claimed apex and unavailable launch/connection state', async () => {
    m.launch.mockResolvedValue({ launch: { tryOn: 'hidden', reason: 'plan_inactive' }, unsubscribed: true });
    m.signal.mockResolvedValue('apex_taken');
    expect((await post()).status).toBe(409);
    m.connection.mockResolvedValue(null); expect((await post()).status).toBe(403);
  });
  it('provides POST preflight without doing any work', () => {
    expect(OPTIONS(new NextRequest('https://grindctrl.cloud/api/try-on/paste-context', { headers: { origin: 'https://merchant.example' } })).status).toBe(204);
    expect(m.site).not.toHaveBeenCalled();
  });
});
