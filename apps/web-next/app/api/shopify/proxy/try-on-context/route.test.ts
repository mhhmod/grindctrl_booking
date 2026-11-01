// @vitest-environment node
import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const CORE_SECRET = 'test-only-independent-core-signing-key-2026';
const SECRET = 'shopify-app-secret';
const NOW_SECONDS = Math.floor(Date.now() / 1000);
const NONCE = 'abcdefghijklmnopqrstuvwx';
const DISTINCT_NONCE = 'zyxwvutsrqponmlkjihgfedc';

const { rateLimitMock, resolveStorefrontProductMock, launchMock, flagsMock, storeLaunchMock } = vi.hoisted(() => ({
  rateLimitMock: vi.fn(),
  resolveStorefrontProductMock: vi.fn(),
  launchMock: vi.fn(),
  flagsMock: vi.fn(async (): Promise<string[]> => []),
  storeLaunchMock: vi.fn(async (): Promise<unknown> => null),
}));

vi.mock('@/lib/try-on/launch', () => ({ getTryOnLaunch: (...args: unknown[]) => launchMock(...args) }));
vi.mock('@/lib/flags/store-flags', () => ({ storeFlags: () => flagsMock() }));
vi.mock('@/lib/launch/store-launch', () => ({ getStoreLaunch: () => storeLaunchMock() }));
// The downstream session/attempt routes now require the same installation
// as the proxy fixture, independently of merchant-level launch availability.
vi.mock('@/lib/shopify/tokens', () => ({
  isActiveShopifyInstallation: vi.fn(async (shop: string, app: string) =>
    shop === 'demo.myshopify.com' && app === 'test-only-client-id'),
}));

vi.mock('@/lib/ratelimit', () => {
  const limiter = (name: string) => ({ limit: (id: string) => rateLimitMock(name, id) });
  return {
    publicApiRatelimit: limiter('publicApi'),
    proxyVisitorRatelimit: limiter('proxyVisitor'),
    proxyShopReadRatelimit: limiter('proxyShopRead'),
    proxyShopMintRatelimit: limiter('proxyShopMint'),
    clientIp: () => 'test-ip',
    rateLimitedResponse: () => new Response(null, { status: 429 }),
  };
});
vi.mock('@/lib/shopify/product-resolver', async () => {
  const actual = await vi.importActual<typeof import('@/lib/shopify/product-resolver')>(
    '@/lib/shopify/product-resolver',
  );
  return { ...actual, resolveStorefrontProduct: resolveStorefrontProductMock };
});

import { GET } from './route';
import { POST as createTryOnSession } from '@/app/api/try-on/session/route';
import { POST as createTryOnAttempt } from '@/app/api/try-on/attempt/route';
import {
  STOREFRONT_CONTEXT_TTL_SECONDS,
  verifyStorefrontContext,
  verifyTryOnAttempt,
  verifyTryOnSession,
} from '@/lib/try-on/storefront-context';
import { ProductResolutionError } from '@/lib/shopify/product-resolver';
import { signPreviewToken } from '@/lib/launch/preview-token';
import { holdoutBucket } from '@/lib/launch/audience';

const RESOLVED_PRODUCT = {
  shop: 'demo.myshopify.com',
  handle: 'premium-ringer-tee',
  productGid: 'gid://shopify/Product/99',
  variantGid: 'gid://shopify/ProductVariant/123456789',
  variantId: '123456789',
  garmentUrl: 'https://cdn.shopify.com/s/files/garment.png',
};

function signedRequest(overrides: Record<string, string> = {}, secret = SECRET) {
  const params = new URLSearchParams({
    product: 'premium-ringer-tee',
    variant: '123456789',
    nonce: NONCE,
    shop: 'demo.myshopify.com',
    logged_in_customer_id: '',
    path_prefix: '/apps/grindctrl',
    timestamp: String(NOW_SECONDS),
    ...overrides,
  });
  const pairs = Array.from(params.entries()).map(([key, value]) =>
    `${key}=${value.replace(/&/g, '%26').replace(/=/g, '%3D')}`,
  );
  pairs.sort();
  params.set('signature', createHmac('sha256', secret).update(pairs.join('')).digest('hex'));
  return new NextRequest(`https://app.example.com/api/shopify/proxy/try-on-context?${params}`);
}

function sessionRequest(storefrontContext: string, nonce = NONCE) {
  return new NextRequest('https://app.example.com/api/try-on/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      context: 'storefront',
      productId: RESOLVED_PRODUCT.handle,
      variantId: RESOLVED_PRODUCT.variantId,
      storefrontNonce: nonce,
      storefrontContext,
    }),
  });
}

function attemptRequest(sessionId: string, nonce = NONCE) {
  return new NextRequest('https://app.example.com/api/try-on/attempt', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      productId: RESOLVED_PRODUCT.handle,
      variantId: RESOLVED_PRODUCT.variantId,
      storefrontNonce: nonce,
      attemptNonce: '0123456789abcdefghijklmn',
    }),
  });
}

describe('GET /api/shopify/proxy/try-on-context', () => {
  it('keeps B proof/product credentials on B when A and B share a store',async()=>{
    vi.stubEnv('SHOPIFY_APPS',JSON.stringify([{clientId:'app-b',secret:'secret-b'}]));
    try {
      const response=await GET(signedRequest({path_prefix:'/apps/grindctrl-public'},'secret-b'));
      expect(response.status).toBe(200);
      expect(resolveStorefrontProductMock).toHaveBeenCalledWith(expect.objectContaining({appClientId:'app-b'}));
      const data=await response.json();
      expect(verifyStorefrontContext('secret-b',data.token)).not.toBeNull();
      expect(verifyStorefrontContext(SECRET,data.token)).toBeNull();
    } finally {vi.unstubAllEnvs();}
  });
  beforeEach(() => {
    vi.clearAllMocks(); // Vitest 4 restoreAllMocks restores spies, not module-mock history.
    process.env.SHOPIFY_API_KEY = 'test-only-client-id';
    process.env.SHOPIFY_API_SECRET = SECRET;
    process.env.GRINDCTRL_CAPABILITY_SECRET = CORE_SECRET;
    // Reinstall after the previous test's restoreAllMocks so this suite is
    // order-independent when run with the wider focused group.
    rateLimitMock.mockResolvedValue({ success: true, reset: Date.now() + 10_000 });
    resolveStorefrontProductMock.mockResolvedValue(RESOLVED_PRODUCT);
    launchMock.mockReset().mockResolvedValue({ tryOn: 'live', reason: null });
    vi.spyOn(Date, 'now').mockReturnValue(NOW_SECONDS * 1000);
  });

  /* N34: a page cached before the looks ran out must not start a look. */
  it.each(['out_of_looks', 'plan_inactive', 'not_installed'] as const)(
    'refuses with 409 %s before asking for a photo',
    async (reason) => {
      launchMock.mockResolvedValue({ tryOn: 'hidden', reason });
      const response = await GET(signedRequest());

      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ error: reason });
      expect(launchMock).toHaveBeenCalledWith('demo.myshopify.com');
      expect(resolveStorefrontProductMock).not.toHaveBeenCalled();
    },
  );

  it('does not refuse when the looks could not be read; the reservation still gates', async () => {
    launchMock.mockResolvedValue({ tryOn: 'hidden', reason: 'unavailable' });
    const response = await GET(signedRequest());

    expect(response.status).toBe(200);
  });

  /* Phase zero item 3: these requests come from Shopify's address, so they
     are counted per shop and visitor, never against one shared address. */
  it('counts a signed request against its shop and visitor, not the address', async () => {
    rateLimitMock.mockClear();
    await GET(signedRequest({ vid: 'visitor_0123456789abcdef' }));

    expect(rateLimitMock.mock.calls).toEqual([
      ['proxyVisitor', 'tc:demo.myshopify.com:visitor_0123456789abcdef'],
      ['proxyShopMint', 'tc:demo.myshopify.com'],
    ]);
  });

  it('still applies the shop ceiling when an older script sends no visitor id', async () => {
    rateLimitMock.mockClear();
    await GET(signedRequest());

    expect(rateLimitMock.mock.calls).toEqual([['proxyShopMint', 'tc:demo.myshopify.com']]);
  });

  it('keys an unsigned request by address and refuses it', async () => {
    rateLimitMock.mockClear();
    const forged = signedRequest();
    forged.nextUrl.searchParams.set('signature', '0'.repeat(64));
    const response = await GET(new NextRequest(forged.nextUrl));

    expect(response.status).toBe(401);
    expect(rateLimitMock.mock.calls).toEqual([['publicApi', 'tc:test-ip']]);
  });

  it('answers 429 when the shop ceiling is spent', async () => {
    rateLimitMock.mockImplementation(async (name: string) => ({
      success: name !== 'proxyShopMint',
      reset: Date.now() + 10_000,
    }));
    const response = await GET(signedRequest({ vid: 'visitor_0123456789abcdef' }));

    expect(response.status).toBe(429);
    expect(resolveStorefrontProductMock).not.toHaveBeenCalled();
  });

  it('checks the signature before reading the looks', async () => {
    const forged = signedRequest();
    forged.nextUrl.searchParams.set('signature', '0'.repeat(64));
    const response = await GET(new NextRequest(forged.nextUrl));

    expect(response.status).toBe(401);
    expect(launchMock).not.toHaveBeenCalled();
  });

  afterEach(() => {
    delete process.env.SHOPIFY_API_KEY;
    delete process.env.SHOPIFY_API_SECRET;
    delete process.env.GRINDCTRL_CAPABILITY_SECRET;
    vi.restoreAllMocks();
  });

  it('mints a short-lived capability from the Shopify-signed shop and product', async () => {
    const response = await GET(signedRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(body).toMatchObject({
      shop: 'demo.myshopify.com',
      productId: 'premium-ringer-tee',
      variantId: '123456789',
      nonce: NONCE,
    });
    expect(
      verifyStorefrontContext(SECRET, body.token, {
        productId: 'premium-ringer-tee',
        variantId: '123456789',
        nonce: NONCE,
      }),
    ).toMatchObject({
      shop: 'demo.myshopify.com',
      productGid: RESOLVED_PRODUCT.productGid,
      variantGid: RESOLVED_PRODUCT.variantGid,
      canonicalGarmentUrl: RESOLVED_PRODUCT.garmentUrl,
    });
    expect(resolveStorefrontProductMock).toHaveBeenCalledWith({
      shop: 'demo.myshopify.com',
      handle: 'premium-ringer-tee',
      appClientId: 'test-only-client-id',
      variantId: '123456789',
    });
  });

  it('mints the same context and downstream request key for the same signed request', async () => {
    const firstContext = await (await GET(signedRequest())).json();
    vi.mocked(Date.now).mockReturnValue((NOW_SECONDS + 30) * 1000);
    const secondContext = await (await GET(signedRequest())).json();

    expect(secondContext.token).toBe(firstContext.token);

    const firstSession = await (
      await createTryOnSession(sessionRequest(firstContext.token))
    ).json();
    const secondSession = await (
      await createTryOnSession(sessionRequest(secondContext.token))
    ).json();
    const firstClaims = verifyTryOnSession(SECRET, firstSession.data.sessionId);
    const secondClaims = verifyTryOnSession(SECRET, secondSession.data.sessionId);
    const firstAttempt = await (
      await createTryOnAttempt(attemptRequest(firstSession.data.sessionId))
    ).json();
    const secondAttempt = await (
      await createTryOnAttempt(attemptRequest(secondSession.data.sessionId))
    ).json();

    expect(secondSession.data.sessionId).toBe(firstSession.data.sessionId);
    expect(secondClaims?.sessionId).toBe(firstClaims?.sessionId);
    expect(secondAttempt.data.attemptId).toBe(firstAttempt.data.attemptId);
    expect(
      verifyTryOnAttempt(SECRET, secondAttempt.data.attemptId, secondClaims!)?.requestKey,
    ).toBe(
      verifyTryOnAttempt(SECRET, firstAttempt.data.attemptId, firstClaims!)?.requestKey,
    );
  });

  it('mints distinct context and downstream billing identities for distinct nonces', async () => {
    const firstContext = await (await GET(signedRequest())).json();
    const secondContext = await (
      await GET(signedRequest({ nonce: DISTINCT_NONCE }))
    ).json();
    const firstContextClaims = verifyStorefrontContext(SECRET, firstContext.token);
    const secondContextClaims = verifyStorefrontContext(SECRET, secondContext.token);

    expect(secondContext.token).not.toBe(firstContext.token);
    expect(secondContextClaims?.jti).not.toBe(firstContextClaims?.jti);

    const firstSession = await (
      await createTryOnSession(sessionRequest(firstContext.token))
    ).json();
    const secondSession = await (
      await createTryOnSession(sessionRequest(secondContext.token, DISTINCT_NONCE))
    ).json();
    const firstClaims = verifyTryOnSession(SECRET, firstSession.data.sessionId);
    const secondClaims = verifyTryOnSession(SECRET, secondSession.data.sessionId);
    const firstAttempt = await (
      await createTryOnAttempt(attemptRequest(firstSession.data.sessionId))
    ).json();
    const secondAttempt = await (
      await createTryOnAttempt(
        attemptRequest(secondSession.data.sessionId, DISTINCT_NONCE),
      )
    ).json();

    expect(secondSession.data.sessionId).not.toBe(firstSession.data.sessionId);
    expect(
      verifyTryOnAttempt(SECRET, secondAttempt.data.attemptId, secondClaims!)?.requestKey,
    ).not.toBe(
      verifyTryOnAttempt(SECRET, firstAttempt.data.attemptId, firstClaims!)?.requestKey,
    );
  });

  it('resolves an omitted variant authoritatively', async () => {
    const response = await GET(signedRequest({ variant: '' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.variantId).toBe('123456789');
    expect(resolveStorefrontProductMock).toHaveBeenCalledWith({
      shop: 'demo.myshopify.com',
      handle: 'premium-ringer-tee',
      appClientId: 'test-only-client-id',
      variantId: null,
    });
  });

  it('rejects a forged signature', async () => {
    const request = signedRequest();
    request.nextUrl.searchParams.set('shop', 'victim.myshopify.com');

    const response = await GET(request);
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'invalid_signature' });
  });

  it('rejects a replayed stale proxy request', async () => {
    const response = await GET(
      signedRequest({
        timestamp: String(NOW_SECONDS - STOREFRONT_CONTEXT_TTL_SECONDS),
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'stale_proxy_request' });
  });

  it('rejects malformed product, variant, and nonce values', async () => {
    expect((await GET(signedRequest({ product: 'bad product!' }))).status).toBe(400);
    expect((await GET(signedRequest({ variant: 'variant-1' }))).status).toBe(400);
    expect((await GET(signedRequest({ nonce: 'short' }))).status).toBe(400);
  });

  it('fails closed when the signed product cannot be resolved for that shop', async () => {
    resolveStorefrontProductMock.mockRejectedValue(
      new ProductResolutionError('variant_not_found'),
    );
    const response = await GET(signedRequest({ product: 'other-product' }));

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({ error: 'variant_not_found' });
  });

  it('returns an explicit operational error when authoritative resolution is unavailable', async () => {
    resolveStorefrontProductMock.mockRejectedValue(
      new ProductResolutionError('product_resolution_unavailable'),
    );
    const response = await GET(signedRequest());

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: 'product_resolution_unavailable',
    });
  });

  it('returns 503 when the Shopify app secret is missing', async () => {
    delete process.env.SHOPIFY_API_SECRET;
    delete process.env.GRINDCTRL_CAPABILITY_SECRET;
    const response = await GET(signedRequest());

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: 'not_configured' });
  });
});

/* Phase zero item 9: only the owner, with the preview link, may start a
   look on a store that is not live, and their looks are test looks. */
describe('GET /api/shopify/proxy/try-on-context launch state (N5, N6)', () => {
  const SALT = '0123456789abcdef0123456789abcdef';
  const previewToken = () => signPreviewToken(CORE_SECRET, 'demo.myshopify.com', NOW_SECONDS).token;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SHOPIFY_API_KEY = 'test-only-client-id';
    process.env.SHOPIFY_API_SECRET = SECRET;
    process.env.GRINDCTRL_CAPABILITY_SECRET = CORE_SECRET;
    rateLimitMock.mockResolvedValue({ success: true, reset: Date.now() + 10_000 });
    resolveStorefrontProductMock.mockResolvedValue(RESOLVED_PRODUCT);
    launchMock.mockReset().mockResolvedValue({ tryOn: 'live', reason: null });
    flagsMock.mockReset().mockResolvedValue(['n5_preview_mode', 'n6_holdout']);
    storeLaunchMock.mockReset().mockResolvedValue({ state: 'preview', holdoutShare: null, holdoutStartedAt: null, holdoutEndsAt: null, salt: SALT });
    vi.spyOn(Date, 'now').mockReturnValue(NOW_SECONDS * 1000);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.SHOPIFY_API_KEY;
    delete process.env.SHOPIFY_API_SECRET;
    delete process.env.GRINDCTRL_CAPABILITY_SECRET;
  });

  it('refuses a shopper with 409 preview before asking for a photo', async () => {
    const response = await GET(signedRequest());
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'preview' });
    expect(resolveStorefrontProductMock).not.toHaveBeenCalled();
  });

  it('lets the owner in with the preview link, and signs a test look through the session and the attempt', async () => {
    const response = await GET(signedRequest({ preview: previewToken() }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(verifyStorefrontContext(SECRET, body.token)?.test).toBe(true);

    const session = await (await createTryOnSession(sessionRequest(body.token))).json();
    const claims = verifyTryOnSession(SECRET, session.data.sessionId);
    expect(claims?.test).toBe(true);
    const attempt = await (await createTryOnAttempt(attemptRequest(session.data.sessionId))).json();
    expect(verifyTryOnAttempt(SECRET, attempt.data.attemptId, claims!)?.test).toBe(true);
  });

  it('lets the owner make test looks when the store has none left', async () => {
    launchMock.mockResolvedValue({ tryOn: 'hidden', reason: 'out_of_looks' });
    expect((await GET(signedRequest({ preview: previewToken() }))).status).toBe(200);
    expect((await GET(signedRequest())).status).toBe(409);
  });

  it('refuses the holdout\'s off arm with 409 holdout', async () => {
    storeLaunchMock.mockResolvedValue({
      state: 'holdout', holdoutShare: 0.5, salt: SALT,
      holdoutStartedAt: new Date((NOW_SECONDS - 86_400) * 1000).toISOString(),
      holdoutEndsAt: new Date((NOW_SECONDS + 86_400 * 13) * 1000).toISOString(),
    });
    const ids = Array.from({ length: 40 }, (_, index) => `visitor_${index}_abcdefghijkl`);
    const off = ids.find((id) => holdoutBucket(id, SALT, 0.5) === 'off')!;
    const on = ids.find((id) => holdoutBucket(id, SALT, 0.5) === 'on')!;
    const refused = await GET(signedRequest({ vid: off }));
    expect(refused.status).toBe(409);
    expect(await refused.json()).toEqual({ error: 'holdout' });
    expect((await GET(signedRequest({ vid: on }))).status).toBe(200);
  });

  it('signs no test look while the flag is off, preview link or not', async () => {
    flagsMock.mockResolvedValue([]);
    const response = await GET(signedRequest({ preview: previewToken() }));
    expect(response.status).toBe(200);
    expect(verifyStorefrontContext(SECRET, (await response.json()).token)?.test).toBeUndefined();
    expect(storeLaunchMock).not.toHaveBeenCalled();
  });
});

