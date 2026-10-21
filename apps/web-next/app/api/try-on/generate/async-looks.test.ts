import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { signStorefrontContext, signTryOnAttempt, signTryOnSession, verifyTryOnSession } from '@/lib/try-on/storefront-context';
import type { GenerateOptions } from '@/lib/try-on/service';

/* Contract N38: a store with n38_async_jobs gets its look made after the
   answer. The answer is 202 with the job and its stage; the work runs in
   Next's after(). Any other store waits for the look as before. */
const { flags, generateMock, afterTasks } = vi.hoisted(() => ({
  flags: { on: [] as string[] },
  generateMock: vi.fn(),
  afterTasks: [] as Array<() => unknown>,
}));

vi.mock('@/lib/ratelimit', () => ({
  publicApiRatelimit: { configured: true, limit: async () => ({ success: true, reset: Date.now() + 10_000 }) },
  clientIp: () => 'test-ip',
  rateLimitedResponse: () => new Response(null, { status: 429 }),
}));
vi.mock('@/lib/flags/store-flags', () => ({ storeFlags: async () => flags.on }));
vi.mock('next/server', async (importOriginal) => {
  const real = await importOriginal<typeof import('next/server')>();
  return { ...real, after: (task: () => unknown) => afterTasks.push(task) };
});
vi.mock('@/lib/try-on/service', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/try-on/service')>();
  return { ...real, generateTryOn: (...args: unknown[]) => generateMock(...args) };
});

import { POST } from './route';

const SECRET = 'test-shopify-secret';
const NONCE = 'abcdefghijklmnopqrstuvwx';
const GARMENT_URL = 'https://cdn.shopify.com/s/files/garment.png';

function storefrontBody() {
  const context = signStorefrontContext(SECRET, {
    shop: 'proven.myshopify.com',
    productId: 'premium-ringer-tee',
    variantId: '123',
    productGid: 'gid://shopify/Product/99',
    variantGid: 'gid://shopify/ProductVariant/123',
    canonicalGarmentUrl: GARMENT_URL,
    nonce: NONCE,
  });
  const sessionId = signTryOnSession(SECRET, { purpose: 'storefront', context: context.claims }).token;
  const session = verifyTryOnSession(SECRET, sessionId)!;
  return {
    sessionId,
    attemptId: signTryOnAttempt(SECRET, { session, attemptNonce: 'zyxwvutsrqponmlkjihgfedc' }).token,
    productId: 'premium-ringer-tee',
    storefrontNonce: NONCE,
    variantId: '123',
    photoSource: 'upload',
    photoData: 'data:image/png;base64,UEhPVE8=',
    garmentUrl: GARMENT_URL,
  };
}

function post(body: Record<string, unknown>) {
  return POST(
    new NextRequest('http://localhost/api/try-on/generate', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    }),
  );
}

const PROCESSING = {
  jobId: 'tryon_async',
  sessionId: 's',
  productId: 'premium-ringer-tee',
  shop: 'proven.myshopify.com',
  status: 'processing',
  stage: 'received',
  createdAt: '2026-10-20T10:00:00.000Z',
  meta: { runtime: 'live', provider: 'p', costEstimate: null },
};

describe('asynchronous looks', () => {
  beforeEach(() => {
    process.env.SHOPIFY_API_KEY = 'test-only-client-id';
    process.env.SHOPIFY_API_SECRET = SECRET;
    flags.on = [];
    afterTasks.length = 0;
    generateMock.mockReset();
  });

  afterEach(() => {
    delete process.env.SHOPIFY_API_KEY;
    delete process.env.SHOPIFY_API_SECRET;
  });

  it('answers 202 with the job and its stage, and makes the look after the answer', async () => {
    flags.on = ['n38_async_jobs'];
    generateMock.mockImplementation(async (...args: unknown[]) => {
      const options = args[5] as GenerateOptions;
      options.background?.(async () => {});
      return PROCESSING;
    });

    const response = await post(storefrontBody());

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({ ok: true, jobId: 'tryon_async', status: 'processing', stage: 'received' });
    expect(afterTasks).toHaveLength(1);
  });

  it('waits for the look, as before, for a store without the flag', async () => {
    generateMock.mockResolvedValue({ ...PROCESSING, status: 'completed', stage: undefined, resultImageUrl: 'data:image/png;base64,TE9PSw==' });

    const response = await post(storefrontBody());

    expect(response.status).toBe(200);
    expect(generateMock.mock.calls[0][5]).toEqual({});
    const body = await response.json();
    expect(body.status).toBe('completed');
    expect(body).not.toHaveProperty('stage');
    expect(afterTasks).toHaveLength(0);
  });
});
