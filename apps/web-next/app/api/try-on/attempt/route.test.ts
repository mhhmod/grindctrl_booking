// @vitest-environment node
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const { activeInstallationMock } = vi.hoisted(() => ({ activeInstallationMock: vi.fn() }));
vi.mock('@/lib/shopify/tokens', () => ({ isActiveShopifyInstallation: activeInstallationMock }));

vi.mock('@/lib/ratelimit', () => ({
  publicApiRatelimit: { limit: vi.fn(async () => ({ success: true, reset: Date.now() + 10_000 })) },
  clientIp: () => 'test-ip',
  rateLimitedResponse: () => new Response(null, { status: 429 }),
}));

import { POST } from './route';
import {
  signStorefrontContext,
  signTryOnSession,
  verifyTryOnAttempt,
  verifyTryOnSession,
} from '@/lib/try-on/storefront-context';

const CORE_SECRET = 'test-only-independent-core-signing-key-2026';
const SECRET = 'test-shopify-secret';
const ATTEMPT_NONCE = 'abcdefghijklmnopqrstuvwx';
const OTHER_ATTEMPT_NONCE = 'zyxwvutsrqponmlkjihgfedc';

function request(sessionId: string, attemptNonce = ATTEMPT_NONCE) {
  return new NextRequest('https://app.example.com/api/try-on/attempt', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      productId: 'premium-ringer-tee',
      attemptNonce,
    }),
  });
}

describe('POST /api/try-on/attempt', () => {
  beforeEach(() => {
    process.env.SHOPIFY_API_KEY = 'test-only-client-id';
    process.env.SHOPIFY_API_SECRET = SECRET;
    process.env.GRINDCTRL_CAPABILITY_SECRET = CORE_SECRET;
    activeInstallationMock.mockReset().mockResolvedValue(true);
  });

  afterEach(() => {
    delete process.env.SHOPIFY_APPS;
    delete process.env.SHOPIFY_API_KEY;
    delete process.env.SHOPIFY_API_SECRET;
    delete process.env.GRINDCTRL_CAPABILITY_SECRET;
  });

  it.each([
    ['test-only-client-id', SECRET, 401], ['app-b', 'secret-b', 200],
  ] as const)('authorizes a new attempt only for the active signing app %s', async (clientId, secret, status) => {
    process.env.SHOPIFY_APPS = JSON.stringify([{ clientId: 'app-b', secret: 'secret-b' }]);
    activeInstallationMock.mockImplementation(async (_shop: string, app: string) => app === 'app-b');
    const context = signStorefrontContext(secret, {
      shop: 'proven.myshopify.com', productId: 'premium-ringer-tee', variantId: '123',
      productGid: 'gid://shopify/Product/99', variantGid: 'gid://shopify/ProductVariant/123',
      canonicalGarmentUrl: 'https://cdn.shopify.com/s/files/garment.png', nonce: ATTEMPT_NONCE,
    });
    const session = signTryOnSession(secret, { purpose: 'storefront', context: context.claims });
    const response = await POST(new NextRequest('https://app.example.com/api/try-on/attempt', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionId: session.token, productId: 'premium-ringer-tee',
        storefrontNonce: ATTEMPT_NONCE, attemptNonce: OTHER_ATTEMPT_NONCE,
      }),
    }));
    expect(response.status).toBe(status);
    expect(activeInstallationMock).toHaveBeenCalledWith('proven.myshopify.com', clientId);
    if (status === 401) expect(await response.json()).not.toHaveProperty('data');
  });

  it('reuses one signed attempt for an exact HTTP retry', async () => {
    const session = signTryOnSession(CORE_SECRET, {
      purpose: 'public-demo',
      productId: 'premium-ringer-tee',
    });
    const first = await (await POST(request(session.token))).json();
    const retry = await (await POST(request(session.token))).json();
    const verifiedSession = verifyTryOnSession(CORE_SECRET, session.token)!;
    const firstClaims = verifyTryOnAttempt(CORE_SECRET, first.data.attemptId, verifiedSession);
    const retryClaims = verifyTryOnAttempt(CORE_SECRET, retry.data.attemptId, verifiedSession);

    expect(retry.data.attemptId).toBe(first.data.attemptId);
    expect(retryClaims?.requestKey).toBe(firstClaims?.requestKey);
  });

  it('mints a new request key for a new explicit generation nonce', async () => {
    const session = signTryOnSession(CORE_SECRET, {
      purpose: 'public-demo',
      productId: 'premium-ringer-tee',
    });
    const first = await (await POST(request(session.token))).json();
    const second = await (
      await POST(request(session.token, OTHER_ATTEMPT_NONCE))
    ).json();
    const verifiedSession = verifyTryOnSession(CORE_SECRET, session.token)!;

    expect(
      verifyTryOnAttempt(CORE_SECRET, second.data.attemptId, verifiedSession)?.requestKey,
    ).not.toBe(
      verifyTryOnAttempt(CORE_SECRET, first.data.attemptId, verifiedSession)?.requestKey,
    );
  });

  it('rejects an attempt for an expired session and client authority fields', async () => {
    const expired = signTryOnSession(CORE_SECRET,
      { purpose: 'public-demo', productId: 'premium-ringer-tee' },
      Math.floor(Date.now() / 1000) - 601,
    );
    expect((await POST(request(expired.token))).status).toBe(401);

    const current = signTryOnSession(CORE_SECRET, {
      purpose: 'public-demo',
      productId: 'premium-ringer-tee',
    });
    const injected = new NextRequest('https://app.example.com/api/try-on/attempt', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionId: current.token,
        productId: 'premium-ringer-tee',
        attemptNonce: ATTEMPT_NONCE,
        shop: 'victim.myshopify.com',
      }),
    });
    expect((await POST(injected)).status).toBe(400);
  });
});
