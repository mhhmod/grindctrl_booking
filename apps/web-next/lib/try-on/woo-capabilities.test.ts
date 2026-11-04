// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ version: 1 as number | null }));
vi.mock('@/lib/messenger/db', () => ({
  getMessengerServiceClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: db.version === null ? null : { secret_version: db.version },
            error: null,
          }),
        }),
      }),
    }),
  }),
}));

import {
  resolveAnyStorefrontContextKey,
  resolveAnyTryOnSessionKey,
  resolveShopifyStorefrontContext,
  resolveTryOnSessionKey,
  wooTryOnKey,
} from './signing-keys';
import {
  signStorefrontContext,
  signTryOnAttempt,
  signTryOnSession,
  verifyStorefrontContext,
  verifyTryOnAttempt,
  verifyTryOnSession,
} from './storefront-context';
import { deriveWooSiteSecret } from '@/lib/woo/site-secret';

const CORE = 'test-only-core-secret-independent-at-least-32-bytes';
const SHOPIFY = 'test-only-platform-secret-unrelated-to-core-key';
const SITE = '123e4567-e89b-42d3-a456-426614174000';
const OTHER_SITE = '223e4567-e89b-42d3-a456-426614174000';
const TENANT = `site:${SITE}`;
const NONCE = 'abcdefghijklmnopqrstuvwx';
const GARMENT = 'https://shop.example.com/wp-content/uploads/tee.jpg';
const NOW = 2_000_000_000;

function wooInput(over: Record<string, unknown> = {}) {
  return {
    shop: TENANT,
    platform: 'woocommerce' as const,
    productId: 'woo-42',
    variantId: '77',
    productGid: 'woo:42',
    variantGid: 'woo:77',
    canonicalGarmentUrl: GARMENT,
    title: 'Linen tee',
    pageUrl: 'https://shop.example.com/product/tee/',
    origin: 'https://shop.example.com',
    nonce: NONCE,
    ...over,
  };
}

beforeEach(() => {
  vi.stubEnv('GRINDCTRL_CAPABILITY_SECRET', CORE);
  vi.stubEnv('SHOPIFY_API_KEY', 'app-a');
  vi.stubEnv('SHOPIFY_API_SECRET', SHOPIFY);
  db.version = 1;
});
afterEach(() => vi.unstubAllEnvs());

describe('WooCommerce Try-On trust domain', () => {
  it('derives a key per site and version, separate from the pairing secret and the core key', () => {
    const key = wooTryOnKey(SITE, 1)!;
    expect(key).toBeTruthy();
    expect(key).not.toBe(deriveWooSiteSecret(SITE, 1));
    expect(key).not.toBe(CORE);
    expect(key).not.toBe(wooTryOnKey(SITE, 2));
    expect(key).not.toBe(wooTryOnKey(OTHER_SITE, 1));
    expect(wooTryOnKey('not-a-uuid', 1)).toBeNull();
    expect(wooTryOnKey(SITE, 0)).toBeNull();
    vi.stubEnv('GRINDCTRL_CAPABILITY_SECRET', '');
    expect(wooTryOnKey(SITE, 1)).toBeNull();
  });

  it('carries a Woo context through session and attempt', async () => {
    const key = wooTryOnKey(SITE, 1)!;
    const { token, claims } = signStorefrontContext(key, wooInput(), NOW);
    expect(claims).toMatchObject({ shop: TENANT, platform: 'woocommerce', title: 'Linen tee' });

    const resolved = await resolveAnyStorefrontContextKey(token, (secret) =>
      verifyStorefrontContext(secret, token, { productId: 'woo-42', variantId: '77', nonce: NONCE }, NOW),
    );
    expect(resolved?.value.shop).toBe(TENANT);
    expect(resolved?.app.clientId).toBe('grindctrl-woo');

    const session = signTryOnSession(resolved!.app.secret, { purpose: 'storefront', context: resolved!.value }, NOW);
    expect(session.claims).toMatchObject({ shop: TENANT, platform: 'woocommerce', productGid: 'woo:42' });
    const sessionResolved = await resolveAnyTryOnSessionKey(session.token, (secret) =>
      verifyTryOnSession(secret, session.token, { productId: 'woo-42' }, NOW),
    );
    expect(sessionResolved?.value.platform).toBe('woocommerce');

    const attempt = signTryOnAttempt(sessionResolved!.app.secret, {
      session: sessionResolved!.value,
      attemptNonce: NONCE,
    });
    expect(verifyTryOnAttempt(sessionResolved!.app.secret, attempt.token, sessionResolved!.value, NOW)?.platform).toBe(
      'woocommerce',
    );
  });

  it('rejects a Woo token under the wrong site key, a stale version, or a rotated secret', async () => {
    const { token } = signStorefrontContext(wooTryOnKey(SITE, 1)!, wooInput(), NOW);
    const verify = (secret: string) => verifyStorefrontContext(secret, token, {}, NOW);

    db.version = 2; // rotation retires version 1
    expect(await resolveAnyStorefrontContextKey(token, verify)).toBeNull();

    db.version = 1;
    const forged = signStorefrontContext(wooTryOnKey(OTHER_SITE, 1)!, wooInput(), NOW).token;
    expect(
      await resolveAnyStorefrontContextKey(forged, (secret) => verifyStorefrontContext(secret, forged, {}, NOW)),
    ).toBeNull();

    db.version = null; // unknown or unreadable site connection
    expect(await resolveAnyStorefrontContextKey(token, verify)).toBeNull();
  });

  it('does not accept a Shopify-signed context presented as Woo', async () => {
    // Even a holder of the Shopify app secret cannot mint a site-tenant capability.
    const asWoo = signStorefrontContext(SHOPIFY, wooInput(), NOW).token;
    const verify = (secret: string) => verifyStorefrontContext(secret, asWoo, {}, NOW);
    expect(resolveShopifyStorefrontContext(verify)).toBeNull();
    expect(await resolveAnyStorefrontContextKey(asWoo, verify)).toBeNull();

    const woo = signTryOnSession(
      SHOPIFY,
      { purpose: 'storefront', context: signStorefrontContext(SHOPIFY, wooInput(), NOW).claims },
      NOW,
    ).token;
    expect(resolveTryOnSessionKey((secret) => verifyTryOnSession(secret, woo, {}, NOW))).toBeNull();
    expect(await resolveAnyTryOnSessionKey(woo, (secret) => verifyTryOnSession(secret, woo, {}, NOW))).toBeNull();
  });

  it('does not accept a Woo-signed context presented as Shopify', async () => {
    const wooToken = signStorefrontContext(wooTryOnKey(SITE, 1)!, wooInput(), NOW).token;
    expect(
      resolveShopifyStorefrontContext((secret) => verifyStorefrontContext(secret, wooToken, {}, NOW)),
    ).toBeNull();

    // A Shopify context cannot be replayed through the Woo branch either.
    const shopifyToken = signStorefrontContext(
      SHOPIFY,
      {
        shop: 'demo.myshopify.com',
        productId: 'tee',
        variantId: '1',
        productGid: 'gid://shopify/Product/9',
        variantGid: 'gid://shopify/ProductVariant/1',
        canonicalGarmentUrl: 'https://cdn.shopify.com/s/files/g.png',
        nonce: NONCE,
      },
      NOW,
    ).token;
    const verify = (secret: string) => verifyStorefrontContext(secret, shopifyToken, {}, NOW);
    expect(resolveShopifyStorefrontContext(verify)?.value.shop).toBe('demo.myshopify.com');
    expect(await resolveAnyStorefrontContextKey(shopifyToken, verify)).toMatchObject({
      value: { shop: 'demo.myshopify.com' },
    });
  });

  it('refuses to sign a Woo context with Shopify-shaped or unsafe fields', () => {
    const key = wooTryOnKey(SITE, 1)!;
    expect(() => signStorefrontContext(key, wooInput({ shop: 'demo.myshopify.com' }), NOW)).toThrow();
    expect(() => signStorefrontContext(key, wooInput({ productGid: 'gid://shopify/Product/9' }), NOW)).toThrow();
    expect(() => signStorefrontContext(key, wooInput({ canonicalGarmentUrl: 'http://shop.example.com/a.jpg' }), NOW)).toThrow();
    expect(() => signStorefrontContext(key, wooInput({ canonicalGarmentUrl: 'https://u:p@shop.example.com/a.jpg' }), NOW)).toThrow();
    // A Shopify context still cannot name a site tenant.
    expect(() =>
      signStorefrontContext(SHOPIFY, { ...wooInput(), platform: undefined, productGid: 'gid://shopify/Product/9', variantGid: 'gid://shopify/ProductVariant/1', canonicalGarmentUrl: 'https://cdn.shopify.com/s/files/g.png' }, NOW),
    ).toThrow();
  });

  it('keeps public-demo sessions and Woo sessions apart', () => {
    const demo = signTryOnSession(CORE, { purpose: 'public-demo', productId: 'sage-linen-shirt' }, NOW);
    expect(demo.claims.platform).toBeUndefined();
    expect(resolveTryOnSessionKey((secret) => verifyTryOnSession(secret, demo.token, {}, NOW))?.value.purpose).toBe(
      'public-demo',
    );
  });
});
