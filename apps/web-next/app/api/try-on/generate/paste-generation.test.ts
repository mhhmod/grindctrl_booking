// @vitest-environment node
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ rate: vi.fn(), active: vi.fn(), generate: vi.fn(), site: vi.fn(), connection: vi.fn(), fetch: vi.fn<typeof fetch>(),
  allowance: vi.fn(), tryOnHosts: vi.fn() }));
// The real allowance rule over an in-memory stand-in for its Redis set.
vi.mock('@/lib/paste/look-allowance', async (original) => ({ ...await original<object>(), claimPasteLook: m.allowance }));
vi.mock('@/lib/ratelimit', () => ({ publicApiRatelimit: { limit: m.rate }, clientIp: () => '203.0.113.5' }));
vi.mock('@/lib/shopify/tokens', () => ({ isActiveTenant: m.active }));
vi.mock('@/lib/paste/store', async (original) => {
  const actual = await original<typeof import('@/lib/paste/store')>();
  return { getPasteConnection: m.connection, pasteTrust: actual.pasteTrust, isPasteTrusted: actual.isPasteTrusted, pasteTryOnHosts: m.tryOnHosts };
});
const PROVEN = { shop_proven_at: '2026-11-08T00:00:00.000Z', app_installed: false };
vi.mock('@/lib/messenger/public-api', async (original) => ({ ...await original<object>(), loadPublicSite: m.site }));
vi.mock('@/lib/messenger/db', () => ({ getMessengerServiceClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { embed_key: 'gc_public_key_42' }, error: null }) }) }) }) }) }));
vi.mock('@/lib/try-on/service', async (original) => ({ ...await original<object>(), generateTryOn: m.generate, getTryOnMode: () => 'mock' }));
import { POST } from './route';
import { POST as attemptPost } from '../attempt/route';
import { pasteCapabilitySecret } from '@/lib/paste/signing';
import { signStorefrontContext, signTryOnSession, signTryOnAttempt, type StorefrontPlatform } from '@/lib/try-on/storefront-context';
import { pasteTurnstileBinding } from '@/lib/paste/turnstile';
import { PASTE_LOOKS_PER_SHOPPER_SESSION, type LookCounter } from '@/lib/paste/look-allowance';
const { claimPasteLook } = await vi.importActual<typeof import('@/lib/paste/look-allowance')>('@/lib/paste/look-allowance');
const SITE = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const NONCE = 'abcdefghijklmnopqrstuvwx';
const garment = 'https://merchant.example/tee.png';
const PASS_SECRET = '1x0000000000000000000000000000000AA';
const FAIL_SECRET = '2x0000000000000000000000000000000AA';
function capabilities(platform: StorefrontPlatform = 'paste-website', test = false, keySite = SITE, origin = 'https://merchant.example',
  attemptNonce = NONCE, contextNonce = NONCE) {
  const secret = pasteCapabilitySecret(keySite)!;
  const context = signStorefrontContext(secret, { shop: `site:${SITE}`, platform, productId: 'tee-42', variantId: '77', productGid: 'paste:tee-42', variantGid: 'paste:77',
    canonicalGarmentUrl: garment, origin, nonce: contextNonce, test });
  const session = signTryOnSession(secret, { purpose: 'storefront', context: context.claims });
  const attempt = signTryOnAttempt(secret, { session: session.claims, attemptNonce });
  return { session, attempt };
}
/** Looks counted per shopper session, as the Redis set would. */
function memoryCounter(): LookCounter {
  const sets = new Map<string, Set<string>>();
  return async (key, member, limit) => {
    const set = sets.get(key) ?? new Set<string>();
    sets.set(key, set);
    if (set.has(member)) return 1;
    if (set.size >= limit) return 0;
    set.add(member);
    return 1;
  };
}
function req(body: Record<string, unknown>, path = 'generate') {
  return new NextRequest(`https://grindctrl.cloud/api/try-on/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}
async function generate(platform: StorefrontPlatform = 'paste-website', test = false, overrides: Record<string, unknown> = {}, keySite = SITE,
  origin = 'https://merchant.example', attemptNonce = NONCE, contextNonce = NONCE) {
  const { session, attempt } = capabilities(platform, test, keySite, origin, attemptNonce, contextNonce);
  m.fetch.mockImplementation(async (_url, init) => Response.json({ success: new URLSearchParams(init?.body as URLSearchParams).get('secret') === PASS_SECRET,
    hostname: 'grindctrl.cloud', action: 'paste_tryon', cdata: pasteTurnstileBinding(attempt.claims) }));
  return POST(req({ sessionId: session.token, attemptId: attempt.token, productId: 'tee-42', variantId: '77', storefrontNonce: NONCE,
    garmentUrl: garment, useMockPhoto: true, turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX', ...overrides }));
}
beforeEach(() => {
  vi.resetAllMocks(); vi.stubGlobal('fetch', m.fetch);
  vi.stubEnv('GRINDCTRL_CAPABILITY_SECRET', 'test-only-independent-core-secret-with-32-bytes-or-more');
  vi.stubEnv('TURNSTILE_SECRET_KEY', PASS_SECRET); vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', '1x00000000000000000000AA');
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://grindctrl.cloud');
  m.rate.mockResolvedValue({ success: true, reset: Date.now() + 1000 }); m.active.mockResolvedValue(true);
  m.connection.mockResolvedValue({ widget_site_id: SITE, platform: 'website', status: 'active' });
  m.site.mockResolvedValue({ id: SITE, status: 'active', domain: null, security: {}, patterns: [
    { pattern: 'merchant.example', verification_status: 'trusted', verification_method: 'paste_trusted', environment: 'production' },
  ] });
  m.generate.mockResolvedValue({ jobId: 'job-1', status: 'completed', productId: 'tee-42' });
  // Like pasteTryOnHosts: the proven shop host plus the verified domains.
  m.tryOnHosts.mockImplementation(async (c: { shop_domain?: string | null }) =>
    [...(c.shop_domain ? [c.shop_domain] : []), 'merchant.example', 'www.merchant.example']);
  const counter = memoryCounter();
  m.allowance.mockImplementation((authorization) => claimPasteLook(authorization, counter));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe('paste generation boundary, before reservation/provider work', () => {
  it('verifies Turnstile on the paid look, preserving the site tenant and canonical garment', async () => {
    expect((await generate()).status).toBe(200);
    expect(m.fetch).toHaveBeenCalledTimes(1);
    expect(m.generate).toHaveBeenCalledWith(expect.objectContaining({ shop: `site:${SITE}`, platform: 'paste-website' }), 'mock', undefined, garment, undefined, expect.any(Object));
    const fields = m.fetch.mock.calls[0][1]?.body as URLSearchParams;
    expect(fields.get('idempotency_key')).toMatch(/^[a-f0-9-]{36}$/);
  });
  it('denies the always-fail test key before reserving a credit', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', FAIL_SECRET);
    const response = await generate(); expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'turnstile_failed' }); expect(m.generate).not.toHaveBeenCalled();
  });
  it('fails closed with an explicit missing-secret error', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', '');
    const response = await generate(); expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: 'turnstile_not_configured' });
    expect(m.generate).not.toHaveBeenCalled(); expect(m.fetch).not.toHaveBeenCalled();
  });
  it('requires a fresh token for paid looks even for an explicit mock-photo request', async () => {
    expect((await generate('paste-website', false, { turnstileToken: undefined, test: true })).status).toBe(403);
    expect(m.generate).not.toHaveBeenCalled();
  });
  it('exempts signed owner test looks from Turnstile and the shopper allowance, on both paste flavours', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', '');
    expect((await generate('paste-website', true, { turnstileToken: undefined })).status).toBe(200);
    m.connection.mockResolvedValue({ widget_site_id: SITE, platform: 'shopify', status: 'active', ...PROVEN });
    expect((await generate('paste-shopify', true, { turnstileToken: undefined })).status).toBe(200);
    expect(m.fetch).not.toHaveBeenCalled(); expect(m.generate).toHaveBeenCalledTimes(2);
  });
  it('requires Turnstile for a paid pasted Shopify look, before any credit is reserved', async () => {
    m.connection.mockResolvedValue({ widget_site_id: SITE, platform: 'shopify', status: 'active', ...PROVEN });
    const missing = await generate('paste-shopify', false, { turnstileToken: undefined });
    expect(missing.status).toBe(403);
    expect(await missing.json()).toMatchObject({ code: 'turnstile_required' });
    vi.stubEnv('TURNSTILE_SECRET_KEY', FAIL_SECRET);
    expect((await generate('paste-shopify')).status).toBe(403);
    vi.stubEnv('TURNSTILE_SECRET_KEY', '');
    expect((await generate('paste-shopify')).status).toBe(503);
    expect(m.generate).not.toHaveBeenCalled();
    vi.stubEnv('TURNSTILE_SECRET_KEY', PASS_SECRET);
    expect((await generate('paste-shopify')).status).toBe(200);
    expect(m.generate).toHaveBeenCalledWith(expect.objectContaining({ platform: 'paste-shopify' }), 'mock', undefined, garment, undefined, expect.any(Object));
  });
  it.each(['paste-website', 'paste-shopify'] as const)('caps paid %s looks per server-issued shopper session, counting a retried attempt once', async (platform) => {
    if (platform === 'paste-shopify') m.connection.mockResolvedValue({ widget_site_id: SITE, platform: 'shopify', status: 'active', ...PROVEN });
    const nonce = (n: number) => `attempt-nonce-${String(n).padStart(10, '0')}`;
    for (let look = 1; look <= PASTE_LOOKS_PER_SHOPPER_SESSION; look++) {
      expect((await generate(platform, false, {}, SITE, 'https://merchant.example', nonce(look))).status).toBe(200);
    }
    // The same attempt retried is not a new look.
    expect((await generate(platform, false, {}, SITE, 'https://merchant.example', nonce(1))).status).toBe(200);
    const over = await generate(platform, false, {}, SITE, 'https://merchant.example', nonce(99));
    expect(over.status).toBe(429);
    // The embed's existing localized "Try-On unavailable" state, nothing broken.
    expect(await over.json()).toMatchObject({ ok: false, code: 'TRYON_UNAVAILABLE' });
    expect(over.headers.get('retry-after')).toBe('3600');
    expect(m.generate).toHaveBeenCalledTimes(PASTE_LOOKS_PER_SHOPPER_SESSION + 1);
    // Another context mint is another server-issued session.
    const other = 'another-context-nonce-000';
    expect((await generate(platform, false, { storefrontNonce: other }, SITE, 'https://merchant.example', nonce(99), other)).status).toBe(200);
  });
  it('refuses a look from a domain our server has not verified (removed and re-added mid-session), before any challenge or credit', async () => {
    m.tryOnHosts.mockResolvedValue([]);
    const response = await generate();
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ ok: false, error: 'origin_not_allowed' });
    expect(m.fetch).not.toHaveBeenCalled(); expect(m.allowance).not.toHaveBeenCalled(); expect(m.generate).not.toHaveBeenCalled();
  });
  it('denies the look when the allowance store is down, after a passed challenge and before any credit', async () => {
    m.allowance.mockImplementation((authorization) => claimPasteLook(authorization, async () => { throw new Error('redis down'); }));
    const response = await generate();
    expect(response.status).toBe(503);
    expect(m.fetch).toHaveBeenCalledTimes(1);
    expect(m.generate).not.toHaveBeenCalled();
  });
  it('refuses a Shopify paste look while the shop is unproven or held by the Shopify app', async () => {
    for (const connection of [{ widget_site_id: SITE, platform: 'shopify', status: 'pending', shop_proven_at: null, app_installed: false },
      { widget_site_id: SITE, platform: 'shopify', status: 'active', ...PROVEN, app_installed: true }]) {
      m.connection.mockResolvedValue(connection);
      expect((await generate('paste-shopify')).status).not.toBe(200);
    }
    expect(m.generate).not.toHaveBeenCalled();
  });
  it('rechecks a .myshopify.com-only store against its connection shop, not a domain row', async () => {
    m.connection.mockResolvedValue({ widget_site_id: SITE, platform: 'shopify', status: 'active', shop_domain: 'merchant.myshopify.com', ...PROVEN });
    m.site.mockResolvedValue({ id: SITE, status: 'active', domain: null, security: {}, patterns: [], pasteShopDomain: 'merchant.myshopify.com' });
    expect((await generate('paste-shopify', false, {}, SITE, 'https://merchant.myshopify.com')).status).toBe(200);
    m.site.mockResolvedValue({ id: SITE, status: 'active', domain: null, security: {}, patterns: [], pasteShopDomain: null });
    expect((await generate('paste-shopify', false, {}, SITE, 'https://merchant.myshopify.com')).status).toBe(403);
    expect(m.generate).toHaveBeenCalledTimes(1);
  });
  it('revokes a domain during an otherwise valid ten-minute session', async () => {
    m.site.mockResolvedValue({ status: 'active', domain: 'merchant.example', security: {}, patterns: [
      { pattern: 'merchant.example', verification_method: 'paste_removed', verification_status: 'disabled', environment: 'production' },
    ] });
    expect((await generate()).status).toBe(403); expect(m.generate).not.toHaveBeenCalled(); expect(m.fetch).not.toHaveBeenCalled();
  });
  it('rejects cross-tenant keys and disconnected connections before any look', async () => {
    expect((await generate('paste-website', false, {}, OTHER)).status).toBe(401);
    m.connection.mockResolvedValue({ widget_site_id: SITE, platform: 'website', status: 'disconnected' });
    expect((await generate()).status).toBe(401); expect(m.generate).not.toHaveBeenCalled();
  });
  it('denies unavailable Redis before verification or generation', async () => {
    m.rate.mockRejectedValue(new Error('Redis failed'));
    expect((await generate()).status).toBe(503); expect(m.generate).not.toHaveBeenCalled(); expect(m.fetch).not.toHaveBeenCalled();
  });
  it('returns the own-iframe Turnstile config and exact attempt cData for the future UI', async () => {
    const { session, attempt } = capabilities();
    const response = await attemptPost(req({ sessionId: session.token, productId: 'tee-42', storefrontNonce: NONCE, attemptNonce: NONCE }, 'attempt'));
    expect(response.status).toBe(200);
    expect((await response.json()).data.turnstile).toEqual({ siteKey: '1x00000000000000000000AA', action: 'paste_tryon', cData: pasteTurnstileBinding(attempt.claims) });
    // The runtime key wins over the build-time public one.
    vi.stubEnv('TURNSTILE_SITE_KEY', '0x4RUNTIME0000000000000');
    const runtime = await attemptPost(req({ sessionId: session.token, productId: 'tee-42', storefrontNonce: NONCE, attemptNonce: NONCE }, 'attempt'));
    expect((await runtime.json()).data.turnstile.siteKey).toBe('0x4RUNTIME0000000000000');
    // A pasted Shopify attempt carries the same binding; a test look none.
    m.connection.mockResolvedValue({ widget_site_id: SITE, platform: 'shopify', status: 'active', ...PROVEN });
    const shopify = capabilities('paste-shopify');
    const shopifyAttempt = await attemptPost(req({ sessionId: shopify.session.token, productId: 'tee-42', storefrontNonce: NONCE, attemptNonce: NONCE }, 'attempt'));
    expect((await shopifyAttempt.json()).data.turnstile).toMatchObject({ action: 'paste_tryon', cData: pasteTurnstileBinding(shopify.attempt.claims) });
    const test = capabilities('paste-shopify', true);
    const testAttempt = await attemptPost(req({ sessionId: test.session.token, productId: 'tee-42', storefrontNonce: NONCE, attemptNonce: NONCE }, 'attempt'));
    expect((await testAttempt.json()).data.turnstile).toBeUndefined();
    expect(m.fetch).not.toHaveBeenCalled();
  });
});
