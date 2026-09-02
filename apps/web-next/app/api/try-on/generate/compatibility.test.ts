// @vitest-environment node
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { generateTryOnMock, rateLimitMock } = vi.hoisted(() => ({
  generateTryOnMock: vi.fn(),
  rateLimitMock: vi.fn(),
}));

vi.mock('@/lib/ratelimit', () => ({
  publicApiRatelimit: {
    configured: true,
    limit: (...args: unknown[]) => rateLimitMock(...args),
  },
  clientIp: () => 'test-ip',
}));
vi.mock('@/lib/try-on/service', () => ({
  generateTryOn: (...args: unknown[]) => generateTryOnMock(...args),
  getTryOnMode: () => 'mock',
  TryOnFinalizationPendingError: class TryOnFinalizationPendingError extends Error {},
  TryOnResultPersistenceError: class TryOnResultPersistenceError extends Error {},
  TryOnResultSchemaNotReadyError: class TryOnResultSchemaNotReadyError extends Error {},
  TryOnResultUnavailableError: class TryOnResultUnavailableError extends Error {},
}));

import { POST } from './route';
import {
  signStorefrontContext,
  signTryOnSession,
} from '@/lib/try-on/storefront-context';

const SECRET = 'test-shopify-secret';
const GARMENT_URL = 'https://cdn.shopify.com/s/files/garment.png';

function legacySession() {
  const context = signStorefrontContext(SECRET, {
    shop: 'proven.myshopify.com',
    productId: 'premium-ringer-tee',
    variantId: '123',
    productGid: 'gid://shopify/Product/99',
    variantGid: 'gid://shopify/ProductVariant/123',
    canonicalGarmentUrl: GARMENT_URL,
    nonce: 'abcdefghijklmnopqrstuvwx',
  });
  return signTryOnSession(SECRET, {
    purpose: 'legacy-compat',
    context: context.claims,
  });
}

function request(sessionId: string, shop: unknown) {
  return new NextRequest('https://app.example.com/api/try-on/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      productId: 'premium-ringer-tee',
      shop,
      garmentUrl: GARMENT_URL,
      useMockPhoto: true,
    }),
  });
}

describe('temporary legacy compatibility generation boundary', () => {
  beforeEach(() => {
    process.env.SHOPIFY_API_SECRET = SECRET;
    process.env.TRYON_TEMP_LEGACY_STOREFRONT_COMPAT =
      'allow-unsigned-nonbillable-storefront';
    rateLimitMock.mockResolvedValue({ success: true, reset: Date.now() + 10_000 });
    generateTryOnMock.mockResolvedValue({
      jobId: 'tryon_compat',
      sessionId: 'ts_abcdefghijklmnopqrstuvwx',
      productId: 'premium-ringer-tee',
      shop: null,
      status: 'completed',
      resultImageUrl: '/try-on/mock-result.png',
      createdAt: new Date().toISOString(),
      meta: { runtime: 'mock', provider: 'mock', costEstimate: 0 },
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    delete process.env.SHOPIFY_API_SECRET;
    delete process.env.TRYON_TEMP_LEGACY_STOREFRONT_COMPAT;
    vi.restoreAllMocks();
  });

  it('rejects victim-shop injection before reservation or provider service is reachable', async () => {
    const session = legacySession();
    const response = await POST(request(session.token, 'victim.myshopify.com'));

    expect(response.status).toBe(401);
    expect(generateTryOnMock).not.toHaveBeenCalled();
  });

  it('passes a valid compatibility request downstream only as signed shopless authorization', async () => {
    const session = legacySession();
    const response = await POST(request(session.token, null));

    expect(response.status).toBe(200);
    expect(generateTryOnMock).toHaveBeenCalledOnce();
    expect(generateTryOnMock.mock.calls[0][0]).toMatchObject({
      purpose: 'legacy-compat',
      shop: null,
      canonicalGarmentUrl: GARMENT_URL,
    });
  });
});
