import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  signStorefrontContext,
  signTryOnAttempt,
  signTryOnSession,
  verifyTryOnSession,
} from '@/lib/try-on/storefront-context';

const { rateLimitMock, rateLimitState } = vi.hoisted(() => ({
  rateLimitMock: vi.fn(),
  rateLimitState: { configured: true },
}));

/* This suite exercises generation logic, not the rate limiter — real limiter
   calls @upstash/redis over the network, which vitest can't do (it doesn't
   load .env.local the way Next.js does, so Redis.fromEnv() has no
   credentials here regardless). */
vi.mock('@/lib/ratelimit', () => ({
  publicApiRatelimit: {
    get configured() { return rateLimitState.configured; },
    limit: (...args: unknown[]) => rateLimitMock(...args),
  },
  clientIp: () => 'test-ip',
  rateLimitedResponse: () => new Response(JSON.stringify({ error: 'Too many requests' }), { status: 429 }),
}));

import { POST } from '@/app/api/try-on/generate/route';

const SECRET = 'test-shopify-secret';
const STOREFRONT_NONCE = 'abcdefghijklmnopqrstuvwx';
const GARMENT_URL = 'https://cdn.shopify.com/s/files/garment.png';

function demoSession(productId = 'premium-ringer-tee', now = Math.floor(Date.now() / 1000)) {
  return signTryOnSession(SECRET, { purpose: 'public-demo', productId }, now).token;
}

function attemptFor(sessionToken: string, attemptNonce = 'zyxwvutsrqponmlkjihgfedc') {
  const session = verifyTryOnSession(SECRET, sessionToken);
  if (!session) return 'invalid-attempt';
  return signTryOnAttempt(SECRET, { session, attemptNonce }).token;
}

function storefrontSession() {
  const context = signStorefrontContext(SECRET, {
    shop: 'proven.myshopify.com',
    productId: 'premium-ringer-tee',
    variantId: '123',
    productGid: 'gid://shopify/Product/99',
    variantGid: 'gid://shopify/ProductVariant/123',
    canonicalGarmentUrl: GARMENT_URL,
    nonce: STOREFRONT_NONCE,
  });
  return signTryOnSession(SECRET, { purpose: 'storefront', context: context.claims });
}

function legacyCompatSession() {
  const context = signStorefrontContext(SECRET, {
    shop: 'proven.myshopify.com',
    productId: 'premium-ringer-tee',
    variantId: '123',
    productGid: 'gid://shopify/Product/99',
    variantGid: 'gid://shopify/ProductVariant/123',
    canonicalGarmentUrl: GARMENT_URL,
    nonce: STOREFRONT_NONCE,
  });
  return signTryOnSession(SECRET, { purpose: 'legacy-compat', context: context.claims });
}

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/try-on/generate', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

describe('POST /api/try-on/generate', () => {
  beforeEach(() => {
    process.env.SHOPIFY_API_SECRET = SECRET;
    delete process.env.TRYON_TEMP_LEGACY_STOREFRONT_COMPAT;
    rateLimitState.configured = true;
    rateLimitMock.mockResolvedValue({ success: true, reset: Date.now() + 10_000 });
  });

  afterEach(() => {
    delete process.env.SHOPIFY_API_SECRET;
    delete process.env.TRYON_TEMP_LEGACY_STOREFRONT_COMPAT;
    vi.restoreAllMocks();
  });

  it('rejects generation without a photo after validating its signed attempt', async () => {
    const sessionId = demoSession();
    const response = await POST(
      makeRequest({
        sessionId,
        attemptId: attemptFor(sessionId),
        productId: 'premium-ringer-tee',
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.message).toMatch(/photo reference is required/i);
  });

  it('rejects a missing signed session token', async () => {
    const response = await POST(
      makeRequest({ productId: 'premium-ringer-tee', useMockPhoto: true }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ ok: false });
  });

  it('accepts generation with an uploaded photo reference', async () => {
    const sessionId = demoSession();
    const response = await POST(
      makeRequest({
        sessionId,
        attemptId: attemptFor(sessionId),
        productId: 'premium-ringer-tee',
        photoReference: 'uploaded-photo',
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.jobId).toMatch(/^tryon_/);
    expect(body.status).toBe('completed');
    expect(body.resultImageUrl).toBe('/try-on/mock-result.png');
    expect(body.productId).toBe('premium-ringer-tee');
    expect(body.message).toMatch(/mock mode/i);
    expect(body.meta.runtime).toBe('mock');
    expect(body.data).toBeUndefined();
  });

  it('accepts generation with explicit mock photo flag', async () => {
    const sessionId = demoSession();
    const response = await POST(
      makeRequest({
        sessionId,
        attemptId: attemptFor(sessionId),
        productId: 'premium-ringer-tee',
        useMockPhoto: true,
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.jobId).toMatch(/^tryon_/);
    expect(body.status).toBe('completed');
    expect(body.productId).toBe('premium-ringer-tee');
    expect(body.meta.runtime).toBe('mock');
    expect(body.data).toBeUndefined();
  });

  it('rejects client shop and request-key overrides before generation', async () => {
    const sessionId = demoSession();
    for (const override of [
      { shop: 'victim.myshopify.com' },
      { requestKey: '11111111-1111-4111-8111-111111111111' },
    ]) {
      const response = await POST(
        makeRequest({
          sessionId,
          attemptId: attemptFor(sessionId),
          productId: 'premium-ringer-tee',
          useMockPhoto: true,
          ...override,
        }),
      );
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({ ok: false });
    }
  });

  it('accepts only the canonical garment bound to the storefront session', async () => {
    const session = storefrontSession();
    const response = await POST(
      makeRequest({
        sessionId: session.token,
        attemptId: signTryOnAttempt(SECRET, {
          session: session.claims,
          attemptNonce: 'zyxwvutsrqponmlkjihgfedc',
        }).token,
        productId: 'premium-ringer-tee',
        variantId: '123',
        storefrontNonce: STOREFRONT_NONCE,
        garmentUrl: GARMENT_URL,
        useMockPhoto: true,
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      productId: 'premium-ringer-tee',
    });
  });

  it('rejects a missing or cross-garment Shopify URL', async () => {
    const session = storefrontSession();
    const attemptId = signTryOnAttempt(SECRET, {
      session: session.claims,
      attemptNonce: 'zyxwvutsrqponmlkjihgfedc',
    }).token;
    for (const garmentUrl of [undefined, 'https://cdn.shopify.com/s/files/other.png']) {
      const response = await POST(
        makeRequest({
          sessionId: session.token,
          attemptId,
          productId: 'premium-ringer-tee',
          variantId: '123',
          storefrontNonce: STOREFRONT_NONCE,
          garmentUrl,
          useMockPhoto: true,
        }),
      );
      expect(response.status).toBe(401);
    }
  });

  it('rejects token tampering, expiry, and product mismatch', async () => {
    const token = demoSession();
    const tampered = `${token.slice(0, -1)}${token.endsWith('a') ? 'b' : 'a'}`;
    const expired = demoSession(
      'premium-ringer-tee',
      Math.floor(Date.now() / 1000) - 601,
    );

    for (const [sessionId, productId] of [
      [tampered, 'premium-ringer-tee'],
      [expired, 'premium-ringer-tee'],
      [token, 'other-product'],
    ]) {
      const response = await POST(
        makeRequest({
          sessionId,
          attemptId: attemptFor(sessionId),
          productId,
          useMockPhoto: true,
        }),
      );
      expect(response.status).toBe(401);
    }
  });

  it('fails closed when the signing secret is missing', async () => {
    const token = demoSession();
    delete process.env.SHOPIFY_API_SECRET;
    const response = await POST(
      makeRequest({ sessionId: token, productId: 'premium-ringer-tee', useMockPhoto: true }),
    );
    expect(response.status).toBe(503);
  });

  it('keeps legacy generation disabled by default', async () => {
    const session = legacyCompatSession();
    const response = await POST(
      makeRequest({
        sessionId: session.token,
        productId: 'premium-ringer-tee',
        shop: null,
        garmentUrl: GARMENT_URL,
        useMockPhoto: true,
      }),
    );

    expect(response.status).toBe(401);
  });

  it('temporarily accepts a matching signed legacy session without exposing tokens in warnings', async () => {
    process.env.TRYON_TEMP_LEGACY_STOREFRONT_COMPAT =
      'allow-unsigned-nonbillable-storefront';
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const session = legacyCompatSession();
    const response = await POST(
      makeRequest({
        sessionId: session.token,
        productId: 'premium-ringer-tee',
        shop: null,
        garmentUrl: GARMENT_URL,
        useMockPhoto: true,
      }),
    );

    expect(response.status).toBe(200);
    expect(JSON.stringify(warning.mock.calls)).not.toContain(session.token);
    expect(warning).toHaveBeenCalledWith(
      '[try-on] temporary_legacy_storefront_compat_used',
      expect.objectContaining({ boundary: 'generation_non_billable' }),
    );
  });

  it('fails compatibility generation closed when rate limiting is unavailable', async () => {
    process.env.TRYON_TEMP_LEGACY_STOREFRONT_COMPAT =
      'allow-unsigned-nonbillable-storefront';
    rateLimitState.configured = false;
    const session = legacyCompatSession();
    const response = await POST(
      makeRequest({
        sessionId: session.token,
        productId: 'premium-ringer-tee',
        shop: null,
        garmentUrl: GARMENT_URL,
        useMockPhoto: true,
      }),
    );

    expect(response.status).toBe(503);
  });

  it('does not let the compatibility flag bypass attempts for billable storefront sessions', async () => {
    process.env.TRYON_TEMP_LEGACY_STOREFRONT_COMPAT =
      'allow-unsigned-nonbillable-storefront';
    const session = storefrontSession();
    const response = await POST(
      makeRequest({
        sessionId: session.token,
        productId: 'premium-ringer-tee',
        shop: null,
        garmentUrl: GARMENT_URL,
        useMockPhoto: true,
      }),
    );

    expect(response.status).toBe(401);
  });

  it('rejects victim-shop injection into a signed non-billable compatibility session', async () => {
    process.env.TRYON_TEMP_LEGACY_STOREFRONT_COMPAT =
      'allow-unsigned-nonbillable-storefront';
    const session = legacyCompatSession();
    const response = await POST(
      makeRequest({
        sessionId: session.token,
        productId: 'premium-ringer-tee',
        shop: 'victim.myshopify.com',
        garmentUrl: GARMENT_URL,
        useMockPhoto: true,
      }),
    );

    expect(response.status).toBe(401);
  });
});
