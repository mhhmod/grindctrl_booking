import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { signStorefrontContext, signTryOnAttempt, signTryOnSession, verifyTryOnSession } from '@/lib/try-on/storefront-context';
import type { GenerateOptions } from '@/lib/try-on/service';
import { wooTryOnKey } from '@/lib/try-on/signing-keys';

/* All tenants and the public studio make looks after the response. */
const { runtime, generateMock, afterTasks } = vi.hoisted(() => ({
  runtime: { unavailable: false },
  generateMock: vi.fn(),
  afterTasks: [] as Array<() => unknown>,
}));

vi.mock('@/lib/ratelimit', () => ({
  publicApiRatelimit: { configured: true, limit: async () => ({ success: true, reset: Date.now() + 10_000 }) },
  clientIp: () => 'test-ip',
  rateLimitedResponse: () => new Response(null, { status: 429 }),
}));
vi.mock('@/lib/messenger/db', () => ({ getMessengerServiceClient: () => ({
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { secret_version: 1 }, error: null }) }) }) }),
}) }));
vi.mock('@/lib/shopify/tokens', () => ({ isActiveShopifyInstallation: vi.fn(async () => true), isActiveTenant: vi.fn(async () => true) }));
vi.mock('next/server', async (importOriginal) => {
  const real = await importOriginal<typeof import('next/server')>();
  return { ...real, after: (task: () => unknown) => {
    if (runtime.unavailable) throw new Error('`after()` will not work correctly, because `waitUntil` is not available in the current environment.');
    afterTasks.push(task);
  } };
});
vi.mock('@/lib/try-on/service', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/try-on/service')>();
  return { ...real, generateTryOn: (...args: unknown[]) => generateMock(...args) };
});

import { POST } from './route';

const SECRET = 'test-shopify-secret';
const CORE = 'test-only-independent-core-secret-at-least-32-bytes';
const NONCE = 'abcdefghijklmnopqrstuvwx';
const GARMENT_URL = 'https://cdn.shopify.com/s/files/garment.png';

function storefrontBody(woo = false, legacy = false) {
  const secret = woo ? wooTryOnKey('123e4567-e89b-42d3-a456-426614174000', 1)! : SECRET;
  const context = signStorefrontContext(secret, {
    shop: woo ? 'site:123e4567-e89b-42d3-a456-426614174000' : 'proven.myshopify.com',
    ...(woo ? { platform: 'woocommerce' as const } : {}),
    productId: 'premium-ringer-tee',
    variantId: '123',
    productGid: woo ? 'woo:99' : 'gid://shopify/Product/99',
    variantGid: woo ? 'woo:123' : 'gid://shopify/ProductVariant/123',
    canonicalGarmentUrl: GARMENT_URL,
    nonce: NONCE,
  });
  const sessionId = signTryOnSession(secret, { purpose: legacy ? 'legacy-compat' : 'storefront', context: context.claims }).token;
  const session = verifyTryOnSession(secret, sessionId)!;
  return {
    sessionId,
    attemptId: signTryOnAttempt(secret, { session, attemptNonce: 'zyxwvutsrqponmlkjihgfedc' }).token,
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
    process.env.GRINDCTRL_CAPABILITY_SECRET = CORE;
    runtime.unavailable = false;
    afterTasks.length = 0;
    generateMock.mockReset();
  });

  afterEach(() => {
    delete process.env.SHOPIFY_API_KEY;
    delete process.env.SHOPIFY_API_SECRET;
    delete process.env.GRINDCTRL_CAPABILITY_SECRET;
    delete process.env.TRYON_TEMP_LEGACY_STOREFRONT_COMPAT;
  });

  it.each([false, true])('defaults to 202 without a store flag (site tenant: %s)', async (woo) => {
    const made = vi.fn(async () => {});
    generateMock.mockImplementation(async (...args: unknown[]) => {
      const options = args[5] as GenerateOptions;
      options.background?.(made);
      return PROCESSING;
    });

    const response = await post(storefrontBody(woo));

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({ ok: true, jobId: 'tryon_async', status: 'processing', stage: 'received' });
    expect(afterTasks).toHaveLength(1);
    expect(made).not.toHaveBeenCalled();
    await afterTasks[0]();
    expect(made).toHaveBeenCalledOnce();
  });

  it('also defaults the public studio to after()/202', async () => {
    const sessionId = signTryOnSession(CORE, { purpose: 'public-demo', productId: 'premium-ringer-tee' }).token;
    const session = verifyTryOnSession(CORE, sessionId)!;
    generateMock.mockResolvedValue({ ...PROCESSING, shop: null });
    const response = await post({
      sessionId, productId: session.productId,
      attemptId: signTryOnAttempt(CORE, { session, attemptNonce: 'zyxwvutsrqponmlkjihgfedc' }).token,
      photoSource: 'upload', photoData: 'data:image/png;base64,UEhPVE8=',
    });
    expect(response.status).toBe(202);
    expect(generateMock.mock.calls[0][5].background).toEqual(expect.any(Function));
  });

  it('returns an already completed idempotent result immediately', async () => {
    generateMock.mockResolvedValue({ ...PROCESSING, status: 'completed', stage: undefined, resultImageUrl: 'data:image/png;base64,TE9PSw==' });

    const response = await post(storefrontBody());

    expect(response.status).toBe(200);
    expect(generateMock.mock.calls[0][5].background).toEqual(expect.any(Function));
    const body = await response.json();
    expect(body.status).toBe('completed');
    expect(body).not.toHaveProperty('stage');
    await afterTasks[0]();
  });

  it('uses the synchronous path only when after is genuinely unavailable', async () => {
    runtime.unavailable = true;
    generateMock.mockResolvedValue({ ...PROCESSING, status: 'completed', resultImageUrl: 'data:image/png;base64,TE9PSw==' });
    const response = await post(storefrontBody());
    expect(response.status).toBe(200);
    expect(generateMock.mock.calls[0][5]).toEqual({});
    expect(afterTasks).toHaveLength(0);
  });

  it('keeps the temporary legacy bridge on its explicit synchronous compatibility fallback', async () => {
    process.env.TRYON_TEMP_LEGACY_STOREFRONT_COMPAT = 'allow-unsigned-nonbillable-storefront';
    generateMock.mockResolvedValue({ ...PROCESSING, shop: null, status: 'completed', resultImageUrl: 'data:image/png;base64,TE9PSw==' });
    const response = await post(storefrontBody(false, true));
    expect(response.status).toBe(200);
    expect(generateMock.mock.calls[0][5]).toEqual({});
    expect(afterTasks).toHaveLength(0);
  });

  it('keeps a job scheduled when the browser disconnects during reservation', async () => {
    let reserved!: () => void;
    const reservation = new Promise<void>((resolve) => { reserved = resolve; });
    const made = vi.fn(async () => {});
    generateMock.mockImplementation(async (...args: unknown[]) => {
      await reservation;
      (args[5] as GenerateOptions).background?.(made);
      return PROCESSING;
    });
    const response = post(storefrontBody());
    await vi.waitFor(() => expect(afterTasks).toHaveLength(1));
    // Next may start after() on a disconnect, before reservation answers.
    const closed = afterTasks[0]();
    expect(made).not.toHaveBeenCalled();
    reserved();
    expect((await response).status).toBe(202);
    await closed;
    expect(made).toHaveBeenCalledOnce();
  });
});
