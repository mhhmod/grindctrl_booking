// @vitest-environment node
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ network: vi.fn(), visitor: vi.fn(), siteLimit: vi.fn(), site: vi.fn(), connection: vi.fn(),
  hosts: vi.fn(), proofHosts: vi.fn(), prove: vi.fn(), signal: vi.fn(), signature: vi.fn(), active: vi.fn(), flags: vi.fn(),
  launch: vi.fn(), storeLaunch: vi.fn(), lookup: vi.fn(), codeVersion: vi.fn() }));
vi.mock('@/lib/ratelimit', () => ({ clientIp: () => '203.0.113.5', publicApiRatelimit: { limit: m.network },
  proxyVisitorRatelimit: { limit: m.visitor }, proxyShopMintRatelimit: { limit: m.siteLimit } }));
vi.mock('@/lib/messenger/public-api', async (original) => ({ ...await original<object>(), loadPublicSite: m.site }));
vi.mock('@/lib/paste/store', async (original) => ({ pasteTrust: (await original<typeof import('@/lib/paste/store')>()).pasteTrust,
  getPasteConnection: m.connection, pasteTrustedHosts: m.hosts, pasteProofHosts: m.proofHosts, recordPasteSignal: m.signal,
  recordPasteCodeVersion: m.codeVersion }));
// The storefront proof (fetch + render factor) is unit-tested in lib/paste.
vi.mock('@/lib/paste/shop-proof', () => ({ checkPasteShop: m.prove }));
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
import { PasteError } from '@/lib/paste/types';

const SITE = '11111111-1111-4111-8111-111111111111';
const CORE = 'test-only-independent-core-signing-secret-for-paste';
const body = { key: 'gc_public_key_42', productId: '42', variantId: '77', title: 'Tee', imageUrl: 'https://merchant.example/tee.jpg',
  pageUrl: 'https://merchant.example/products/tee', visitorId: 'visitor_abcdefghijklmnop' };
const connection = { widget_site_id: SITE, platform: 'website', shop_domain: null, status: 'active', secret_version: 1,
  shop_proven_at: null, app_installed: false };
const shopify = { ...connection, platform: 'shopify', shop_domain: 'merchant.myshopify.com', shop_proven_at: '2026-11-08T00:00:00.000Z' };
const signed = { siteId: SITE, shopDomain: 'merchant.myshopify.com', productId: '42', variantId: '77', issuedAt: '2000000000', customerId: '', signature: 'a'.repeat(64) };
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
    expect(m.signal).toHaveBeenCalledWith(SITE, 'https://merchant.example', { signed: false });
    expect(m.prove).not.toHaveBeenCalled();
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
    m.connection.mockResolvedValue(shopify);
    expect((await post()).status).toBe(401);
    const response = await post({ signed });
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(verifyStorefrontContext(pasteCapabilitySecret(SITE)!, result.context.token)?.platform).toBe('paste-shopify');
    expect(m.signature).toHaveBeenCalledWith(expect.objectContaining({ connection: expect.objectContaining({ widget_site_id: SITE }) }));
    expect((await post({ signed: { ...signed, productId: '99' } })).status).toBe(401);
    expect(m.prove).not.toHaveBeenCalled();
  });
  it('serves a Shopify store that only uses its .myshopify.com address, signalling that shop host', async () => {
    const shopConnection = shopify;
    m.connection.mockResolvedValue(shopConnection);
    m.site.mockResolvedValue({ ...site, patterns: [], pasteShopDomain: 'merchant.myshopify.com' });
    m.hosts.mockResolvedValue(['merchant.myshopify.com']);
    const response = await post({ signed, pageUrl: 'https://merchant.myshopify.com/products/tee',
      imageUrl: 'https://cdn.shopify.com/s/files/tee.jpg' }, 'https://merchant.myshopify.com');
    expect(response.status).toBe(200);
    expect(m.hosts).toHaveBeenCalledWith(shopConnection);
    expect(m.signal).toHaveBeenCalledWith(SITE, 'https://merchant.myshopify.com', { signed: true });
    expect(verifyStorefrontContext(pasteCapabilitySecret(SITE)!, (await response.json()).context.token)?.origin).toBe('https://merchant.myshopify.com');
    m.signal.mockClear();
    expect((await post({ signed, pageUrl: 'https://other.myshopify.com/products/tee' }, 'https://other.myshopify.com')).status).toBe(403);
    expect(m.signal).not.toHaveBeenCalled();
  });
  it.each([['bad_signature', 401], ['stale_signature', 401], ['replayed', 409], ['unavailable', 503]])('returns %s before signaling/granting', async (code, status) => {
    m.connection.mockResolvedValue(shopify);
    m.signature.mockResolvedValue({ ok: false, code });
    const response = await post({ signed, codeVersion: 2 });
    expect(response.status).toBe(status); expect(m.signal).not.toHaveBeenCalled();
    // An unverified render never records which code the store runs.
    expect(m.codeVersion).not.toHaveBeenCalled();
  });
  it('records the snippet version only after a Shopify render verified', async () => {
    m.connection.mockResolvedValue(shopify);
    expect((await post({ signed, codeVersion: 1 })).status).toBe(200);
    expect(m.codeVersion).toHaveBeenCalledExactlyOnceWith(SITE, 1);
    expect(m.signature.mock.invocationCallOrder[0]).toBeLessThan(m.codeVersion.mock.invocationCallOrder[0]);
    // A loader older than the version field sends nothing: nothing is recorded.
    m.codeVersion.mockClear();
    expect((await post({ signed })).status).toBe(200);
    expect(m.codeVersion).not.toHaveBeenCalled();
    // Website code has no version, and a malformed one is refused.
    m.connection.mockResolvedValue(connection);
    expect((await post({ codeVersion: 2 })).status).toBe(200);
    expect(m.codeVersion).not.toHaveBeenCalled();
    for (const codeVersion of [0, 100, 1.5, '2']) expect((await post({ signed, codeVersion })).status).toBe(400);
  });
  it('mints a product card context: the card\'s own signed product, on the listing page', async () => {
    m.connection.mockResolvedValue(shopify);
    const card = { ...signed, productId: '501', variantId: '601' };
    const response = await post({ signed: card, productId: '501', variantId: '601', title: 'Linen abaya',
      pageUrl: 'https://merchant.example/collections/abayas?page=2', imageUrl: 'https://cdn.shopify.com/s/files/abaya.jpg', codeVersion: 2 });
    expect(response.status).toBe(200);
    const claims = verifyStorefrontContext(pasteCapabilitySecret(SITE)!, (await response.json()).context.token)!;
    expect(claims).toMatchObject({ productId: '501', variantId: '601', platform: 'paste-shopify' });
    expect(m.signature).toHaveBeenCalledWith(expect.objectContaining({ claims: card }));
    // A card's signature cannot start a look for another product.
    expect((await post({ signed: card, productId: '42', variantId: '601' })).status).toBe(401);
  });
});

describe('pending Shopify shop proof', () => {
  const pending = { ...shopify, status: 'pending', shop_proven_at: null };
  const shopPost = () => post({ signed, pageUrl: 'https://merchant.myshopify.com/products/tee',
    imageUrl: 'https://cdn.shopify.com/s/files/tee.jpg' }, 'https://merchant.myshopify.com');
  beforeEach(() => {
    m.connection.mockResolvedValue(pending);
    // Not trusted yet: loadPublicSite withholds the shop host.
    m.site.mockResolvedValue({ ...site, patterns: [], pasteShopDomain: null });
    m.proofHosts.mockResolvedValue(['merchant.myshopify.com']);
    m.prove.mockResolvedValue({ shopProof: 'proven', outcome: 'proven' });
  });
  it('runs the storefront proof from a verified render, then mints and earns the plan as a signed render', async () => {
    const response = await shopPost();
    expect(response.status).toBe(200);
    expect(m.signature).toHaveBeenCalledWith(expect.objectContaining({ connection: pending }));
    expect(m.prove).toHaveBeenCalledExactlyOnceWith(pending, { kind: 'render' });
    expect(m.prove.mock.invocationCallOrder[0]).toBeLessThan(m.active.mock.invocationCallOrder[0]);
    expect(m.hosts).not.toHaveBeenCalled();
    expect(m.signal).toHaveBeenCalledWith(SITE, 'https://merchant.myshopify.com', { signed: true });
    expect(verifyStorefrontContext(pasteCapabilitySecret(SITE)!, (await response.json()).context.token)?.platform).toBe('paste-shopify');
  });
  it('never proves from an unverified render, a foreign host or a missing signature', async () => {
    m.signature.mockResolvedValue({ ok: false, code: 'bad_signature' });
    expect((await shopPost()).status).toBe(401);
    m.signature.mockResolvedValue({ ok: true });
    expect((await post({ signed, pageUrl: 'https://other.myshopify.com/products/tee' }, 'https://other.myshopify.com')).status).toBe(403);
    expect((await post({ pageUrl: 'https://merchant.myshopify.com/products/tee', imageUrl: 'https://cdn.shopify.com/s/files/tee.jpg' },
      'https://merchant.myshopify.com')).status).toBe(401);
    expect(m.prove).not.toHaveBeenCalled(); expect(m.signal).not.toHaveBeenCalled();
  });
  it.each(['not_found', 'wrong_site', 'outdated_code', 'password_required', 'awaiting_visit', 'unreachable', 'rate_limited'])(
    'never mints, signals or grants from a verified render while the storefront proof is %s', async (outcome) => {
      // A forged render naming someone else's shop verifies against the
      // forger's own secret, but our fetch of that shop finds no such code.
      m.prove.mockResolvedValue({ shopProof: 'pending', outcome });
      const response = await shopPost();
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ error: 'shop_proof_pending' });
      expect(m.signal).not.toHaveBeenCalled(); expect(m.active).not.toHaveBeenCalled();
    });
  it('stops when the Shopify app holds the shop, the claim was displaced meanwhile or the check is unavailable', async () => {
    m.prove.mockRejectedValue(new PasteError('connection_conflict'));
    expect(await (await shopPost()).json()).toEqual({ error: 'shopify_app_installed' });
    m.prove.mockRejectedValue(new PasteError('not_found'));
    expect((await shopPost()).status).toBe(403);
    m.prove.mockRejectedValue(new PasteError('unavailable'));
    expect((await shopPost()).status).toBe(503);
    expect(m.signal).not.toHaveBeenCalled(); expect(m.active).not.toHaveBeenCalled();
  });
  it('refuses a connection the Shopify app already holds before checking any signature', async () => {
    m.connection.mockResolvedValue({ ...shopify, app_installed: true });
    const response = await shopPost();
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'shopify_app_installed' });
    expect(m.signature).not.toHaveBeenCalled(); expect(m.prove).not.toHaveBeenCalled();
  });
});

describe('paste context limits and launch', () => {
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
  it('mints nothing while the button is switched off, the owner\'s preview link included', async () => {
    m.launch.mockResolvedValue({ launch: { tryOn: 'hidden', reason: 'paused' }, unsubscribed: false });
    const response = await post();
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'paused' });
    m.flags.mockResolvedValue(['n5_preview_mode']); m.storeLaunch.mockResolvedValue({ state: 'preview', salt: 'salt' });
    expect(await (await post({ preview: signPreviewToken(CORE, `site:${SITE}`).token })).json()).toEqual({ error: 'paused' });
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
