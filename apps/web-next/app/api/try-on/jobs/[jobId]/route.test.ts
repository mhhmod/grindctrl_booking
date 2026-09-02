import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { durableLoadMock, rateLimitMock } = vi.hoisted(() => ({
  durableLoadMock: vi.fn(),
  rateLimitMock: vi.fn(),
}));

/* This suite exercises job lookup, not the rate limiter — real limiter calls
   @upstash/redis over the network, which vitest can't do (it doesn't load
   .env.local the way Next.js does, so Redis.fromEnv() has no credentials
   here regardless). */
vi.mock('@/lib/ratelimit', () => ({
  tryOnPollRatelimit: {
    limit: (...args: unknown[]) => rateLimitMock(...args),
  },
  clientIp: () => 'test-ip',
  rateLimitedResponse: () => new Response(JSON.stringify({ error: 'Too many requests' }), { status: 429 }),
}));
vi.mock('@/lib/try-on/persistence', async () => {
  const actual = await vi.importActual<typeof import('@/lib/try-on/persistence')>(
    '@/lib/try-on/persistence',
  );
  return {
    ...actual,
    loadAuthorizedDurableTryOnJob: (...args: unknown[]) => durableLoadMock(...args),
  };
});

import { GET } from '@/app/api/try-on/jobs/[jobId]/route';
import { generateTryOn, storeJob } from '@/lib/try-on/service';
import {
  signStorefrontContext,
  signTryOnSession,
} from '@/lib/try-on/storefront-context';

const SECRET = 'test-shopify-secret';

describe('GET /api/try-on/jobs/[jobId]', () => {
  beforeEach(() => {
    process.env.SHOPIFY_API_SECRET = SECRET;
    rateLimitMock.mockResolvedValue({ success: true, reset: Date.now() + 10_000 });
    durableLoadMock.mockResolvedValue(null);
  });

  afterEach(() => {
    delete process.env.SHOPIFY_API_SECRET;
    vi.restoreAllMocks();
  });

  it('returns the job fields in the top-level response envelope', async () => {
    const session = signTryOnSession(SECRET, {
      purpose: 'public-demo',
      productId: 'premium-ringer-tee',
    });
    const job = await generateTryOn(session.claims, 'upload');
    const response = await GET(new NextRequest(`http://localhost/api/try-on/jobs/${job.jobId}`, {
      headers: { authorization: `Bearer ${session.token}` },
    }), {
      params: Promise.resolve({ jobId: job.jobId }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.jobId).toBe(job.jobId);
    expect(body.status).toBe('completed');
    expect(body.resultImageUrl).toBe('/try-on/mock-result.png');
    expect(body.productId).toBe('premium-ringer-tee');
    expect(body.message).toMatch(/mock mode/i);
    expect(body.meta.runtime).toBe('mock');
    expect(body.data).toBeUndefined();
  });

  it('does not expose a job to a different valid session', async () => {
    const owner = signTryOnSession(SECRET, {
      purpose: 'public-demo',
      productId: 'premium-ringer-tee',
    });
    const other = signTryOnSession(SECRET, {
      purpose: 'public-demo',
      productId: 'premium-ringer-tee',
    });
    const job = await generateTryOn(owner.claims, 'mock');
    const response = await GET(new NextRequest(`http://localhost/api/try-on/jobs/${job.jobId}`, {
      headers: { authorization: `Bearer ${other.token}` },
    }), {
      params: Promise.resolve({ jobId: job.jobId }),
    });

    expect(response.status).toBe(404);
  });

  it('returns an explicit reconciliation error for a completed job with no result', async () => {
    const session = signTryOnSession(SECRET, {
      purpose: 'public-demo',
      productId: 'premium-ringer-tee',
    });
    storeJob({
      jobId: 'tryon_completed_missing_result',
      sessionId: session.claims.sessionId,
      productId: session.claims.productId,
      shop: null,
      status: 'completed',
      createdAt: new Date().toISOString(),
      meta: { runtime: 'live', provider: 'provider-v1', costEstimate: 0.01 },
    });
    const alert = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await GET(
      new NextRequest(
        'http://localhost/api/try-on/jobs/tryon_completed_missing_result',
        { headers: { authorization: `Bearer ${session.token}` } },
      ),
      { params: Promise.resolve({ jobId: 'tryon_completed_missing_result' }) },
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toMatchObject({
      ok: false,
      code: 'TRYON_RESULT_UNAVAILABLE',
      jobId: 'tryon_completed_missing_result',
    });
    expect(alert).toHaveBeenCalledWith(
      '[try-on] reconciliation_required',
      expect.objectContaining({ reason: 'completed_result_missing' }),
    );
    expect(JSON.stringify(alert.mock.calls)).not.toContain(session.token);
  });

  it('recovers a durable finalizer-pending result after an in-memory restart', async () => {
    const session = signTryOnSession(SECRET, {
      purpose: 'public-demo',
      productId: 'premium-ringer-tee',
    });
    durableLoadMock.mockResolvedValueOnce({
      jobId: 'tryon_durable_restart',
      sessionId: session.claims.sessionId,
      productId: session.claims.productId,
      shop: null,
      status: 'completed',
      resultImageUrl: 'https://storage.example/signed-result',
      createdAt: new Date().toISOString(),
      meta: { runtime: 'live', provider: 'provider-v1', costEstimate: 0.01 },
    });

    const response = await GET(
      new NextRequest('http://localhost/api/try-on/jobs/tryon_durable_restart', {
        headers: { authorization: `Bearer ${session.token}` },
      }),
      { params: Promise.resolve({ jobId: 'tryon_durable_restart' }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      status: 'completed',
      resultImageUrl: 'https://storage.example/signed-result',
    });
    expect(durableLoadMock).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: session.claims.sessionId }),
      'tryon_durable_restart',
    );
  });

  it('masks durable session, product, and shop mismatches as not found', async () => {
    const owner = signTryOnSession(SECRET, {
      purpose: 'public-demo',
      productId: 'premium-ringer-tee',
    });
    const differentSession = signTryOnSession(SECRET, {
      purpose: 'public-demo',
      productId: 'premium-ringer-tee',
    });
    const differentProduct = signTryOnSession(SECRET, {
      purpose: 'public-demo',
      productId: 'different-product',
    });
    const storefrontContext = signStorefrontContext(SECRET, {
      shop: 'other-shop.myshopify.com',
      productId: 'premium-ringer-tee',
      productGid: 'gid://shopify/Product/99',
      variantGid: 'gid://shopify/ProductVariant/123',
      variantId: '123',
      canonicalGarmentUrl: 'https://cdn.shopify.com/s/files/garment.png',
      nonce: 'abcdefghijklmnopqrstuvwx',
    });
    const differentShop = signTryOnSession(SECRET, {
      purpose: 'storefront',
      context: storefrontContext.claims,
    });

    for (const session of [differentSession, differentProduct, differentShop]) {
      const response = await GET(
        new NextRequest('http://localhost/api/try-on/jobs/tryon_durable_owner', {
          headers: { authorization: `Bearer ${session.token}` },
        }),
        { params: Promise.resolve({ jobId: 'tryon_durable_owner' }) },
      );
      expect(response.status).toBe(404);
    }

    expect(durableLoadMock).toHaveBeenCalledTimes(3);
    expect(durableLoadMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: owner.claims.sessionId }),
      expect.anything(),
    );
  });

  it('rejects a missing bearer token', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/try-on/jobs/tryon_unknown'),
      { params: Promise.resolve({ jobId: 'tryon_unknown' }) },
    );

    expect(response.status).toBe(401);
  });

  it('rate-limits foreign polling before disclosing authentication state', async () => {
    rateLimitMock.mockResolvedValueOnce({
      success: false,
      reset: Date.now() + 30_000,
    });

    const response = await GET(
      new NextRequest('http://localhost/api/try-on/jobs/tryon_foreign', {
        headers: { authorization: 'Bearer attacker-controlled' },
      }),
      { params: Promise.resolve({ jobId: 'tryon_foreign' }) },
    );

    expect(response.status).toBe(429);
    expect(rateLimitMock).toHaveBeenCalledWith('test-ip');
    expect(durableLoadMock).not.toHaveBeenCalled();
  });

  it('rejects an expired bearer token', async () => {
    const expired = signTryOnSession(
      SECRET,
      { purpose: 'public-demo', productId: 'premium-ringer-tee' },
      Math.floor(Date.now() / 1000) - 601,
    );
    const response = await GET(
      new NextRequest('http://localhost/api/try-on/jobs/tryon_unknown', {
        headers: { authorization: `Bearer ${expired.token}` },
      }),
      { params: Promise.resolve({ jobId: 'tryon_unknown' }) },
    );

    expect(response.status).toBe(401);
  });
});
