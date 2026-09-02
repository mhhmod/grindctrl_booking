// @vitest-environment node
import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const SECRET = 'shopify-app-secret';
const NOW_SECONDS = Math.floor(Date.now() / 1000);
const NONCE = 'abcdefghijklmnopqrstuvwx';
const DISTINCT_NONCE = 'zyxwvutsrqponmlkjihgfedc';

const { rateLimitMock, resolveStorefrontProductMock } = vi.hoisted(() => ({
  rateLimitMock: vi.fn(),
  resolveStorefrontProductMock: vi.fn(),
}));

vi.mock('@/lib/ratelimit', () => ({
  publicApiRatelimit: { limit: (...args: unknown[]) => rateLimitMock(...args) },
  clientIp: () => 'test-ip',
  rateLimitedResponse: () => new Response(null, { status: 429 }),
}));
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

const RESOLVED_PRODUCT = {
  shop: 'demo.myshopify.com',
  handle: 'premium-ringer-tee',
  productGid: 'gid://shopify/Product/99',
  variantGid: 'gid://shopify/ProductVariant/123456789',
  variantId: '123456789',
  garmentUrl: 'https://cdn.shopify.com/s/files/garment.png',
};

function signedRequest(overrides: Record<string, string> = {}) {
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
  params.set('signature', createHmac('sha256', SECRET).update(pairs.join('')).digest('hex'));
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
  beforeEach(() => {
    process.env.SHOPIFY_API_SECRET = SECRET;
    // Reinstall after the previous test's restoreAllMocks so this suite is
    // order-independent when run with the wider focused group.
    rateLimitMock.mockResolvedValue({ success: true });
    resolveStorefrontProductMock.mockResolvedValue(RESOLVED_PRODUCT);
    vi.spyOn(Date, 'now').mockReturnValue(NOW_SECONDS * 1000);
  });

  afterEach(() => {
    delete process.env.SHOPIFY_API_SECRET;
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
    const response = await GET(signedRequest());

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: 'not_configured' });
  });
});
