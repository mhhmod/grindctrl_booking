// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { rateLimitMock, rateLimitState, resolveStorefrontProductMock } = vi.hoisted(() => ({
  rateLimitMock: vi.fn(),
  rateLimitState: { configured: true },
  resolveStorefrontProductMock: vi.fn(),
}));

vi.mock('@/lib/ratelimit', () => ({
  publicApiRatelimit: {
    get configured() { return rateLimitState.configured; },
    limit: (...args: unknown[]) => rateLimitMock(...args),
  },
  clientIp: () => 'test-ip',
  rateLimitedResponse: () => new Response(null, { status: 429 }),
}));
vi.mock('@/lib/shopify/product-resolver', async () => {
  const actual = await vi.importActual<typeof import('@/lib/shopify/product-resolver')>(
    '@/lib/shopify/product-resolver',
  );
  return { ...actual, resolveStorefrontProduct: resolveStorefrontProductMock };
});

import { POST } from './route';
import {
  signStorefrontContext,
  verifyTryOnSession,
} from '@/lib/try-on/storefront-context';

const SECRET = 'test-shopify-secret';
const NONCE = 'abcdefghijklmnopqrstuvwx';
const GARMENT_URL = 'https://cdn.shopify.com/s/files/garment.png';

function request(body: Record<string, unknown>) {
  return new NextRequest('https://app.example.com/api/try-on/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function storefrontToken() {
  return signStorefrontContext(SECRET, {
    shop: 'proven.myshopify.com',
    productId: 'premium-ringer-tee',
    variantId: '123456789',
    productGid: 'gid://shopify/Product/99',
    variantGid: 'gid://shopify/ProductVariant/123456789',
    canonicalGarmentUrl: GARMENT_URL,
    nonce: NONCE,
  }).token;
}

describe('POST /api/try-on/session', () => {
  beforeEach(() => {
    process.env.SHOPIFY_API_SECRET = SECRET;
    delete process.env.TRYON_TEMP_LEGACY_STOREFRONT_COMPAT;
    rateLimitState.configured = true;
    rateLimitMock.mockResolvedValue({ success: true });
    resolveStorefrontProductMock.mockResolvedValue({
      shop: 'proven.myshopify.com',
      handle: 'premium-ringer-tee',
      productGid: 'gid://shopify/Product/99',
      variantGid: 'gid://shopify/ProductVariant/123456789',
      variantId: '123456789',
      garmentUrl: GARMENT_URL,
    });
  });

  afterEach(() => {
    delete process.env.SHOPIFY_API_SECRET;
    delete process.env.TRYON_TEMP_LEGACY_STOREFRONT_COMPAT;
    vi.restoreAllMocks();
  });

  it('derives the billing shop, product, variant, and nonce from verified storefront proof', async () => {
    const response = await POST(
      request({
        context: 'storefront',
        productId: 'premium-ringer-tee',
        variantId: '123456789',
        storefrontNonce: NONCE,
        storefrontContext: storefrontToken(),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({
      shop: 'proven.myshopify.com',
      productId: 'premium-ringer-tee',
      variantId: '123456789',
      garmentUrl: GARMENT_URL,
      nonce: NONCE,
    });
    expect(verifyTryOnSession(SECRET, body.data.sessionId)).toMatchObject({
      purpose: 'storefront',
      shop: 'proven.myshopify.com',
      productGid: 'gid://shopify/Product/99',
      variantGid: 'gid://shopify/ProductVariant/123456789',
      canonicalGarmentUrl: GARMENT_URL,
    });
  });

  it('redeems the same storefront context to the same billing identity', async () => {
    const context = storefrontToken();
    const body = {
      context: 'storefront',
      productId: 'premium-ringer-tee',
      variantId: '123456789',
      storefrontNonce: NONCE,
      storefrontContext: context,
    };

    const first = await (await POST(request(body))).json();
    const second = await (await POST(request(body))).json();
    const firstClaims = verifyTryOnSession(SECRET, first.data.sessionId);
    const secondClaims = verifyTryOnSession(SECRET, second.data.sessionId);

    expect(second.data.sessionId).toBe(first.data.sessionId);
    expect(secondClaims?.sessionId).toBe(firstClaims?.sessionId);
    expect(secondClaims?.requestKey).toBe(firstClaims?.requestKey);
    expect(secondClaims?.jti).toBe(firstClaims?.jti);
  });

  it('rejects victim-shop and request-key body overrides', async () => {
    for (const override of [
      { shop: 'victim.myshopify.com' },
      { requestKey: '11111111-1111-4111-8111-111111111111' },
    ]) {
      const response = await POST(
        request({
          context: 'storefront',
          productId: 'premium-ringer-tee',
          storefrontNonce: NONCE,
          storefrontContext: storefrontToken(),
          ...override,
        }),
      );
      expect(response.status).toBe(400);
    }
  });

  it('defaults the temporary legacy storefront bridge closed', async () => {
    const response = await POST(
      request({ productId: 'premium-ringer-tee', shop: 'proven.myshopify.com' }),
    );

    expect(response.status).toBe(400);
    expect(resolveStorefrontProductMock).not.toHaveBeenCalled();
  });

  it('allows the explicitly enabled temporary legacy bridge without logging secrets', async () => {
    process.env.TRYON_TEMP_LEGACY_STOREFRONT_COMPAT =
      'allow-unsigned-nonbillable-storefront';
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const response = await POST(
      request({ productId: 'premium-ringer-tee', shop: 'proven.myshopify.com' }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({
      shop: null,
      productId: 'premium-ringer-tee',
      garmentUrl: GARMENT_URL,
    });
    expect(verifyTryOnSession(SECRET, body.data.sessionId)).toMatchObject({
      purpose: 'legacy-compat',
      shop: null,
      canonicalGarmentUrl: GARMENT_URL,
    });
    expect(warning).toHaveBeenCalledWith(
      '[try-on] temporary_legacy_storefront_compat_used',
      expect.objectContaining({
        boundary: 'session_non_billable',
        shopHash: expect.any(String),
      }),
    );
    expect(JSON.stringify(warning.mock.calls)).not.toContain(body.data.sessionId);
  });

  it('fails the compatibility bridge closed when rate limiting is unavailable', async () => {
    process.env.TRYON_TEMP_LEGACY_STOREFRONT_COMPAT =
      'allow-unsigned-nonbillable-storefront';
    rateLimitState.configured = false;

    const response = await POST(
      request({ productId: 'premium-ringer-tee', shop: 'proven.myshopify.com' }),
    );

    expect(response.status).toBe(503);
    expect(resolveStorefrontProductMock).not.toHaveBeenCalled();
  });

  it('rejects product, variant, and nonce mismatches', async () => {
    for (const mismatch of [
      { productId: 'other-product', storefrontNonce: NONCE, variantId: '123456789' },
      { productId: 'premium-ringer-tee', storefrontNonce: NONCE, variantId: '999' },
      {
        productId: 'premium-ringer-tee',
        storefrontNonce: 'zyxwvutsrqponmlkjihgfedc',
        variantId: '123456789',
      },
    ]) {
      const response = await POST(
        request({ context: 'storefront', storefrontContext: storefrontToken(), ...mismatch }),
      );
      expect(response.status).toBe(401);
    }
  });

  it('keeps the public demo shopless and rejects shop injection', async () => {
    const valid = await POST(
      request({ context: 'public-demo', productId: 'premium-ringer-tee' }),
    );
    const validBody = await valid.json();
    expect(valid.status).toBe(200);
    expect(validBody.data.shop).toBeNull();

    const injected = await POST(
      request({
        context: 'public-demo',
        productId: 'premium-ringer-tee',
        shop: 'victim.myshopify.com',
      }),
    );
    expect(injected.status).toBe(400);
  });

  it('fails closed when the signing secret is missing', async () => {
    delete process.env.SHOPIFY_API_SECRET;
    const response = await POST(
      request({ context: 'public-demo', productId: 'premium-ringer-tee' }),
    );
    expect(response.status).toBe(503);
  });
});
