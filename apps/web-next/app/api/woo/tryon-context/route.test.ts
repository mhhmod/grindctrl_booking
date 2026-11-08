// @vitest-environment node
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const SITE = '123e4567-e89b-42d3-a456-426614174000';
const KEY = 'test-woo-tryon-key-for-route-tests';
const CORE_SECRET = 'test-only-independent-core-signing-key-2026';

const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  visitorLimit: vi.fn(),
  shopLimit: vi.fn(),
  active: vi.fn(),
  hosts: vi.fn(),
  lookup: vi.fn(),
  launch: vi.fn(),
  grant: vi.fn(),
  entitlement: vi.fn(),
  config: vi.fn(),
  flags: vi.fn(),
  storeLaunch: vi.fn(),
}));

vi.mock('@/lib/woo/signed-request', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/woo/signed-request')>()),
  verifyWooSignedRequest: mocks.verify,
}));
vi.mock('@/lib/ratelimit', () => ({
  proxyVisitorRatelimit: { limit: mocks.visitorLimit },
  proxyShopMintRatelimit: { limit: mocks.shopLimit },
}));
vi.mock('@/lib/shopify/tokens', () => ({ isActiveTenant: mocks.active }));
vi.mock('@/lib/shopify/proxy-config-cache', () => ({ invalidateProxyConfig: vi.fn() }));
vi.mock('@/lib/try-on/signing-keys', () => ({
  wooTryOnKeyForSite: async () => ({ app: { clientId: 'grindctrl-woo', secret: KEY }, siteId: SITE }),
}));
vi.mock('@/lib/try-on/entitlement', () => ({ getShopEntitlement: mocks.entitlement }));
vi.mock('@/lib/woo/garment-url', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/woo/garment-url')>();
  return {
    ...real,
    verifiedSiteHosts: mocks.hosts,
    assertSafeGarmentUrl: (url: unknown, hosts: readonly string[]) =>
      real.assertSafeGarmentUrl(url, hosts, mocks.lookup),
  };
});
vi.mock('@/lib/woo/tryon-site', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/woo/tryon-site')>()),
  readSiteLaunch: mocks.launch,
}));
vi.mock('@/lib/woo/free-plan', () => ({ ensureWooFreePlan: mocks.grant }));
vi.mock('@/lib/flags/store-flags', () => ({ storeFlags: mocks.flags }));
vi.mock('@/lib/launch/store-launch', () => ({ getStoreLaunch: mocks.storeLaunch }));
vi.mock('@/lib/woo/tryon-config', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/woo/tryon-config')>()),
  buildSiteTryOnConfig: mocks.config,
}));

import { POST } from './route';
import { verifyStorefrontContext } from '@/lib/try-on/storefront-context';
import { PREVIEW_TOKEN_TTL_SECONDS, signPreviewToken } from '@/lib/launch/preview-token';

const BODY = {
  productId: 42,
  variationId: 77,
  title: 'Linen tee',
  imageUrl: 'https://shop.example.com/wp-content/uploads/tee.jpg',
  pageUrl: 'https://shop.example.com/product/linen-tee/',
  locale: 'ar',
  visitorHash: 'abcdefghijklmnop1234567890',
};

function post(body: unknown = BODY) {
  return POST(new NextRequest('http://localhost/api/woo/tryon-context', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }));
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('GRINDCTRL_CAPABILITY_SECRET', CORE_SECRET);
  mocks.verify.mockResolvedValue({ ok: true, siteId: SITE, secretVersion: 1, connectionStatus: 'active', homeUrl: 'https://shop.example.com' });
  mocks.visitorLimit.mockResolvedValue({ success: true, reset: Date.now() + 1000 });
  mocks.shopLimit.mockResolvedValue({ success: true, reset: Date.now() + 1000 });
  mocks.active.mockResolvedValue(true);
  mocks.hosts.mockResolvedValue(['shop.example.com']);
  mocks.lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
  mocks.launch.mockResolvedValue({ launch: { tryOn: 'live', reason: null }, unsubscribed: false });
  mocks.config.mockResolvedValue({ enabled: true });
  mocks.flags.mockResolvedValue([]);
  mocks.storeLaunch.mockResolvedValue(null);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.unstubAllEnvs());

describe('POST /api/woo/tryon-context', () => {
  it('mints a context and an embed URL that carries it in the fragment', async () => {
    const response = await post();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const url = new URL(body.embedUrl);
    expect(url.pathname).toBe('/embed/try-on');
    expect(url.searchParams.get('product')).toBe('woo-42');
    expect(url.searchParams.get('shop')).toBe(`site:${SITE}`);
    expect(url.searchParams.get('variant')).toBe('77');
    expect(url.searchParams.get('locale')).toBe('ar');
    expect(url.search).not.toContain('storefrontContext');
    const fragment = new URLSearchParams(url.hash.slice(1));
    expect(fragment.get('storefrontContext')).toBe(body.context.token);
    expect(fragment.get('storefrontNonce')).toBe(body.context.nonce);

    const claims = verifyStorefrontContext(KEY, body.context.token, { productId: 'woo-42', variantId: '77' });
    expect(claims).toMatchObject({
      shop: `site:${SITE}`,
      platform: 'woocommerce',
      productGid: 'woo:42',
      variantGid: 'woo:77',
      origin: 'https://shop.example.com',
    });
    expect(mocks.grant).not.toHaveBeenCalled();
    expect(mocks.visitorLimit).toHaveBeenCalledWith(`wtc:${SITE}:${BODY.visitorHash}`);
  });

  it('mints for a simple product with no variation', async () => {
    const response = await post({ ...BODY, variationId: 0 });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.context.variantId).toBeNull();
    expect(verifyStorefrontContext(KEY, body.context.token, { variantId: null })).toMatchObject({
      variantGid: 'woo:42',
    });
  });

  it('signs a merchant preview as a test look even when ordinary looks are exhausted', async () => {
    mocks.flags.mockResolvedValue(['n5_preview_mode']);
    mocks.storeLaunch.mockResolvedValue({ state: 'preview', salt: 'test-preview-salt' });
    mocks.launch.mockResolvedValue({ launch: { tryOn: 'hidden', reason: 'out_of_looks' }, unsubscribed: false });
    const { token } = signPreviewToken(CORE_SECRET, `site:${SITE}`);
    const response = await post({ ...BODY, preview: token });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(verifyStorefrontContext(KEY, body.context.token)).toMatchObject({ shop: `site:${SITE}`, test: true });
    expect(mocks.storeLaunch).toHaveBeenCalledWith(`site:${SITE}`);
    expect(mocks.flags).toHaveBeenCalledWith({ widgetSiteId: SITE });
  });

  it.each([
    ['forged', () => 'forged-preview-token-value'],
    ['Shopify tenant', () => signPreviewToken(CORE_SECRET, 'other.myshopify.com').token],
    ['another site', () => signPreviewToken(CORE_SECRET, 'site:22222222-2222-4222-8222-222222222222').token],
    ['expired', () => signPreviewToken(CORE_SECRET, `site:${SITE}`, Math.floor(Date.now() / 1000) - PREVIEW_TOKEN_TTL_SECONDS - 1).token],
  ])('does not grant test looks to a %s preview token', async (_name, preview) => {
    mocks.flags.mockResolvedValue(['n5_preview_mode']);
    mocks.launch.mockResolvedValue({ launch: { tryOn: 'hidden', reason: 'out_of_looks' }, unsubscribed: false });
    expect((await post({ ...BODY, preview: preview() })).status).toBe(409);
  });

  it('does not trust a browser-selected test flag or a preview token when preview mode is disabled', async () => {
    const { token } = signPreviewToken(CORE_SECRET, `site:${SITE}`);
    const response = await post({ ...BODY, test: true, preview: token });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(verifyStorefrontContext(KEY, body.context.token)?.test).not.toBe(true);
  });

  it('keeps an ordinary visitor out of a store in preview', async () => {
    mocks.flags.mockResolvedValue(['n5_preview_mode']);
    mocks.storeLaunch.mockResolvedValue({ state: 'preview', salt: 'test-preview-salt' });
    const response = await post();
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'preview' });
  });

  it('answers a failed signature without doing any work', async () => {
    mocks.verify.mockResolvedValue({ ok: false, code: 'bad_signature', status: 401, siteId: SITE });
    const response = await post();
    expect(response.status).toBe(401);
    expect(mocks.visitorLimit).not.toHaveBeenCalled();
    expect(mocks.hosts).not.toHaveBeenCalled();
  });

  it('refuses malformed bodies', async () => {
    expect((await post('{nope')).status).toBe(400);
    expect((await post({ ...BODY, productId: 'abc' })).status).toBe(400);
    expect((await post({ ...BODY, visitorHash: 'short' })).status).toBe(400);
    expect((await post({ ...BODY, variationId: 'x' })).status).toBe(400);
    expect((await post({ ...BODY, imageUrl: 5 })).status).toBe(400);
  });

  it('refuses a page whose host is not a verified domain of the site', async () => {
    const response = await post({ ...BODY, pageUrl: 'https://attacker.test/product/x' });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'page_not_verified' });
    expect(await (await post({ ...BODY, pageUrl: 'http://shop.example.com/x' })).json()).toEqual({
      error: 'page_not_verified',
    });
  });

  it('refuses a site with no verified domain', async () => {
    mocks.hosts.mockResolvedValue([]);
    const response = await post();
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'no_verified_domain' });
  });

  it('refuses an image on an unlisted host and one that resolves to a private address', async () => {
    const other = await post({ ...BODY, imageUrl: 'https://evil.test/a.jpg' });
    expect(other.status).toBe(422);
    expect(await other.json()).toEqual({ error: 'garment_unsafe' });

    mocks.lookup.mockResolvedValue([{ address: '169.254.169.254', family: 4 }]);
    const metadata = await post();
    expect(metadata.status).toBe(422);
    expect(await metadata.json()).toEqual({ error: 'garment_unsafe' });
  });

  it('is rate limited per visitor and per site, and fails closed when the limiter is down', async () => {
    mocks.visitorLimit.mockResolvedValue({ success: false, reset: Date.now() + 5000 });
    expect((await post()).status).toBe(429);
    mocks.visitorLimit.mockResolvedValue({ success: true, reset: Date.now() + 1000 });
    mocks.shopLimit.mockResolvedValue({ success: false, reset: Date.now() + 5000 });
    expect((await post()).status).toBe(429);
    mocks.shopLimit.mockRejectedValue(new Error('redis down'));
    expect((await post()).status).toBe(503);
    expect(mocks.hosts).not.toHaveBeenCalled();
  });

  it('refuses a disconnected site', async () => {
    mocks.active.mockResolvedValue(false);
    expect((await post()).status).toBe(403);
  });

  it.each([['out_of_looks'], ['plan_inactive'], ['not_installed'], ['paused']])('refuses when launch is hidden: %s', async (reason) => {
    mocks.launch.mockResolvedValue({ launch: { tryOn: 'hidden', reason }, unsubscribed: false });
    const response = await post();
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: reason });
  });

  it('keeps a switched-off button closed to the owner\'s preview link, and grants no plan for it', async () => {
    mocks.flags.mockResolvedValue(['n5_preview_mode']);
    mocks.storeLaunch.mockResolvedValue({ state: 'preview', salt: 'test-preview-salt' });
    mocks.launch.mockResolvedValue({ launch: { tryOn: 'hidden', reason: 'paused' }, unsubscribed: false });
    const response = await post({ ...BODY, preview: signPreviewToken(CORE_SECRET, `site:${SITE}`).token });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'paused' });
    expect(mocks.grant).not.toHaveBeenCalled();
  });

  it('answers 503 when launch state cannot be read', async () => {
    mocks.launch.mockResolvedValue({ launch: { tryOn: 'hidden', reason: 'unavailable' }, unsubscribed: false });
    expect((await post()).status).toBe(503);
  });

  it('grants the free plan on the first look, then checks launch again', async () => {
    mocks.launch.mockResolvedValue({ launch: { tryOn: 'hidden', reason: 'plan_inactive' }, unsubscribed: true });
    mocks.entitlement.mockResolvedValue({ available: true, status: 'active', totalCreditsRemaining: 5 });
    mocks.grant.mockResolvedValue('granted');
    const response = await post();
    expect(response.status).toBe(200);
    expect(mocks.grant).toHaveBeenCalledWith(`site:${SITE}`);
  });

  it('refuses the free plan when another site already holds this apex', async () => {
    mocks.launch.mockResolvedValue({ launch: { tryOn: 'hidden', reason: 'plan_inactive' }, unsubscribed: true });
    mocks.grant.mockResolvedValue('apex_taken');
    const response = await post();
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'free_plan_taken' });
  });

  it('answers 503 when the free plan cannot be granted right now', async () => {
    mocks.launch.mockResolvedValue({ launch: { tryOn: 'hidden', reason: 'plan_inactive' }, unsubscribed: true });
    mocks.grant.mockResolvedValue('unavailable');
    expect((await post()).status).toBe(503);
  });
});
