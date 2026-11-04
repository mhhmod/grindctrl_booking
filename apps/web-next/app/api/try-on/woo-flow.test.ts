// @vitest-environment node
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  active: vi.fn(),
  version: { value: 1 as number | null },
}));

vi.mock('@/lib/shopify/tokens', () => ({
  isActiveShopifyInstallation: mocks.active,
  isActiveTenant: mocks.active,
}));
vi.mock('@/lib/ratelimit', () => ({
  publicApiRatelimit: { configured: true, limit: async () => ({ success: true, reset: Date.now() + 10_000 }) },
  tryOnPollRatelimit: { configured: true, limit: async () => ({ success: true, reset: Date.now() + 10_000 }) },
  clientIp: () => 'test-ip',
  rateLimitedResponse: () => new Response(null, { status: 429 }),
}));
vi.mock('@/lib/messenger/db', () => ({
  getMessengerServiceClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: mocks.version.value === null ? null : { secret_version: mocks.version.value },
            error: null,
          }),
        }),
      }),
    }),
  }),
}));

import { POST as createSession } from './session/route';
import { POST as createAttempt } from './attempt/route';
import { signStorefrontContext } from '@/lib/try-on/storefront-context';
import { wooTryOnKey } from '@/lib/try-on/signing-keys';

const CORE = 'test-only-independent-core-signing-key-2026';
const SHOPIFY = 'test-shopify-secret';
const SITE = '123e4567-e89b-42d3-a456-426614174000';
const NONCE = 'abcdefghijklmnopqrstuvwx';

const wooContext = (secret: string, over: Record<string, unknown> = {}) =>
  signStorefrontContext(secret, {
    shop: `site:${SITE}`,
    platform: 'woocommerce',
    productId: 'woo-42',
    variantId: '77',
    productGid: 'woo:42',
    variantGid: 'woo:77',
    canonicalGarmentUrl: 'https://shop.example.com/wp-content/uploads/tee.jpg',
    nonce: NONCE,
    ...over,
  }).token;

const post = (path: string, body: Record<string, unknown>) =>
  new NextRequest(`https://app.example.com/api/try-on/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

const sessionBody = (token: string) => ({
  productId: 'woo-42',
  context: 'storefront',
  storefrontContext: token,
  storefrontNonce: NONCE,
  variantId: '77',
});

beforeEach(() => {
  vi.stubEnv('GRINDCTRL_CAPABILITY_SECRET', CORE);
  vi.stubEnv('SHOPIFY_API_KEY', 'test-only-client-id');
  vi.stubEnv('SHOPIFY_API_SECRET', SHOPIFY);
  mocks.active.mockReset().mockResolvedValue(true);
  mocks.version.value = 1;
});
afterEach(() => vi.unstubAllEnvs());

describe('WooCommerce Try-On session and attempt', () => {
  it('turns a Woo context into a session and an attempt for the site tenant', async () => {
    const res = await createSession(post('session', sessionBody(wooContext(wooTryOnKey(SITE, 1)!))));
    const session = await res.json();
    expect(res.status).toBe(200);
    expect(session.data).toMatchObject({ shop: `site:${SITE}`, productId: 'woo-42', variantId: '77' });
    expect(mocks.active).toHaveBeenCalledWith(`site:${SITE}`, 'grindctrl-woo');

    const attempt = await createAttempt(
      post('attempt', {
        sessionId: session.data.sessionId,
        productId: 'woo-42',
        variantId: '77',
        storefrontNonce: NONCE,
        attemptNonce: 'zyxwvutsrqponmlkjihgfedc',
      }),
    );
    expect(attempt.status).toBe(200);
    expect((await attempt.json()).data.attemptId).toBeTruthy();
  });

  it('refuses a Shopify-signed context that claims to be a Woo site', async () => {
    const res = await createSession(post('session', sessionBody(wooContext(SHOPIFY))));
    expect(res.status).toBe(401);
  });

  it('refuses a Woo-signed context for another site, or after the secret rotated', async () => {
    const other = await createSession(
      post('session', sessionBody(wooContext(wooTryOnKey('223e4567-e89b-42d3-a456-426614174000', 1)!))),
    );
    expect(other.status).toBe(401);

    const token = wooContext(wooTryOnKey(SITE, 1)!);
    mocks.version.value = 2;
    expect((await createSession(post('session', sessionBody(token)))).status).toBe(401);
  });

  it('refuses spending for a disconnected site', async () => {
    mocks.active.mockResolvedValue(false);
    const res = await createSession(post('session', sessionBody(wooContext(wooTryOnKey(SITE, 1)!))));
    expect(res.status).toBe(401);
  });

  it('refuses a context for a different product or variant than the page asked for', async () => {
    const token = wooContext(wooTryOnKey(SITE, 1)!);
    expect((await createSession(post('session', { ...sessionBody(token), productId: 'woo-43' }))).status).toBe(401);
    expect((await createSession(post('session', { ...sessionBody(token), variantId: '78' }))).status).toBe(401);
  });
});
