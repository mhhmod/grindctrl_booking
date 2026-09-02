import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  signStorefrontContext,
  signTryOnAttempt,
  signTryOnSession,
  digestGarmentUrl,
  STOREFRONT_CONTEXT_TTL_SECONDS,
  TRYON_SESSION_TTL_SECONDS,
  verifyStorefrontContext,
  verifyTryOnAttempt,
  verifyTryOnSession,
} from './storefront-context';

const SECRET = 'test-shopify-secret';
const SHOP = 'demo.myshopify.com';
const PRODUCT = 'premium-ringer-tee';
const VARIANT = '1234567890';
const NONCE = 'abcdefghijklmnopqrstuvwx';
const NOW = 2_000_000_000;
const PRODUCT_GID = 'gid://shopify/Product/99';
const VARIANT_GID = 'gid://shopify/ProductVariant/1234567890';
const GARMENT_URL = 'https://cdn.shopify.com/s/files/garment.png';

const contextInput = {
  shop: SHOP,
  productId: PRODUCT,
  variantId: VARIANT,
  productGid: PRODUCT_GID,
  variantGid: VARIANT_GID,
  canonicalGarmentUrl: GARMENT_URL,
  nonce: NONCE,
};

function signedContext() {
  return signStorefrontContext(SECRET, contextInput, NOW);
}

function signRawPayload(payload: Record<string, unknown>): string {
  const header = Buffer.from(
    JSON.stringify({ alg: 'HS256', typ: 'JWT', kid: 'tryon-v1' }),
  ).toString('base64url');
  const body = `${header}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}`;
  const key = createHmac('sha256', SECRET)
    .update('grindctrl:tryon:capability:v1', 'utf8')
    .digest();
  const signature = createHmac('sha256', key).update(body, 'utf8').digest('base64url');
  return `${body}.${signature}`;
}

describe('Try-On storefront capabilities', () => {
  it('verifies a signed storefront context and preserves the proven shop/product/variant', () => {
    const { token } = signedContext();

    expect(
      verifyStorefrontContext(
        SECRET,
        token,
        { productId: PRODUCT, variantId: VARIANT, nonce: NONCE },
        NOW,
      ),
    ).toMatchObject({
      shop: SHOP,
      productId: PRODUCT,
      variantId: VARIANT,
      productGid: PRODUCT_GID,
      variantGid: VARIANT_GID,
      canonicalGarmentUrl: GARMENT_URL,
      garmentUrlDigest: digestGarmentUrl(GARMENT_URL),
      nonce: NONCE,
    });
  });

  it('derives context identity from the authoritative product tuple and nonce', () => {
    const first = signStorefrontContext(SECRET, contextInput, NOW);
    const laterMint = signStorefrontContext(SECRET, contextInput, NOW + 30);
    const distinctNonce = signStorefrontContext(
      SECRET,
      { ...contextInput, nonce: 'zyxwvutsrqponmlkjihgfedc' },
      NOW,
    );

    expect(laterMint.claims.jti).toBe(first.claims.jti);
    expect(laterMint.token).not.toBe(first.token);
    expect(distinctNonce.claims.jti).not.toBe(first.claims.jti);
  });

  it('rejects token and signature tampering', () => {
    const { token } = signedContext();
    const [header, payload, signature] = token.split('.');
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const tamperedPayload = Buffer.from(
      JSON.stringify({ ...decoded, shop: 'victim.myshopify.com' }),
    ).toString('base64url');

    expect(
      verifyStorefrontContext(SECRET, `${header}.${tamperedPayload}.${signature}`, {}, NOW),
    ).toBeNull();
    expect(
      verifyStorefrontContext(SECRET, `${header}.${payload}.${signature.slice(0, -1)}x`, {}, NOW),
    ).toBeNull();
  });

  it('rejects expired contexts and sessions', () => {
    const context = signedContext();
    expect(
      verifyStorefrontContext(
        SECRET,
        context.token,
        {},
        NOW + STOREFRONT_CONTEXT_TTL_SECONDS + 1,
      ),
    ).toBeNull();

    const session = signTryOnSession(
      SECRET,
      { purpose: 'storefront', context: context.claims },
      NOW,
    );
    expect(
      verifyTryOnSession(
        SECRET,
        session.token,
        {},
        NOW + TRYON_SESSION_TTL_SECONDS + 1,
      ),
    ).toBeNull();
  });

  it('rejects product, variant, and browser nonce mismatches', () => {
    const { token } = signedContext();

    expect(
      verifyStorefrontContext(SECRET, token, { productId: 'other-product' }, NOW),
    ).toBeNull();
    expect(
      verifyStorefrontContext(SECRET, token, { variantId: '999' }, NOW),
    ).toBeNull();
    expect(
      verifyStorefrontContext(
        SECRET,
        token,
        { nonce: 'zyxwvutsrqponmlkjihgfedc' },
        NOW,
      ),
    ).toBeNull();
  });

  it('rejects canonical garment URL and digest tampering', () => {
    const { claims } = signedContext();
    const differentGarment = 'https://cdn.shopify.com/s/files/other.png';

    expect(
      verifyStorefrontContext(
        SECRET,
        signRawPayload({ ...claims, canonicalGarmentUrl: differentGarment }),
        {},
        NOW,
      ),
    ).toBeNull();
    expect(
      verifyStorefrontContext(
        SECRET,
        signRawPayload({ ...claims, garmentUrlDigest: digestGarmentUrl(differentGarment) }),
        {},
        NOW,
      ),
    ).toBeNull();
  });

  it('rejects a valid HMAC with the wrong audience or purpose', () => {
    const { claims } = signedContext();
    expect(
      verifyStorefrontContext(
        SECRET,
        signRawPayload({ ...claims, aud: 'messenger-api' }),
        {},
        NOW,
      ),
    ).toBeNull();
    expect(
      verifyStorefrontContext(
        SECRET,
        signRawPayload({ ...claims, purpose: 'shop-claim' }),
        {},
        NOW,
      ),
    ).toBeNull();
  });

  it('mints a signed session whose billing shop and idempotency key are server-bound', () => {
    const context = signedContext();
    const session = signTryOnSession(
      SECRET,
      { purpose: 'storefront', context: context.claims },
      NOW,
    );
    const secondRedemption = signTryOnSession(
      SECRET,
      { purpose: 'storefront', context: context.claims },
      NOW + 60,
    );
    const first = verifyTryOnSession(
      SECRET,
      session.token,
      { productId: PRODUCT, variantId: VARIANT, nonce: NONCE },
      NOW,
    );
    const replay = verifyTryOnSession(SECRET, session.token, {}, NOW + 1);

    expect(first).toMatchObject({
      purpose: 'storefront',
      shop: SHOP,
      productId: PRODUCT,
      variantId: VARIANT,
      productGid: PRODUCT_GID,
      variantGid: VARIANT_GID,
      canonicalGarmentUrl: GARMENT_URL,
      garmentUrlDigest: digestGarmentUrl(GARMENT_URL),
      nonce: NONCE,
    });
    expect(first?.requestKey).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(replay?.requestKey).toBe(first?.requestKey);
    expect(replay?.sessionId).toBe(first?.sessionId);
    expect(secondRedemption.claims.requestKey).toBe(session.claims.requestKey);
    expect(secondRedemption.claims.sessionId).toBe(session.claims.sessionId);
    expect(secondRedemption.claims.iat).toBe(session.claims.iat);
    expect(secondRedemption.claims.exp).toBe(session.claims.exp);
    expect(secondRedemption.token).toBe(session.token);
  });

  it('keeps public demo sessions shopless', () => {
    const session = signTryOnSession(
      SECRET,
      { purpose: 'public-demo', productId: PRODUCT },
      NOW,
    );
    expect(verifyTryOnSession(SECRET, session.token, {}, NOW)).toMatchObject({
      purpose: 'public-demo',
      shop: null,
      productId: PRODUCT,
    });
  });

  it('keeps temporary legacy compatibility authoritative but non-billable', () => {
    const session = signTryOnSession(
      SECRET,
      { purpose: 'legacy-compat', context: signedContext().claims },
      NOW,
    );

    expect(verifyTryOnSession(SECRET, session.token, {}, NOW)).toMatchObject({
      purpose: 'legacy-compat',
      shop: null,
      productGid: PRODUCT_GID,
      variantGid: VARIANT_GID,
      canonicalGarmentUrl: GARMENT_URL,
    });
  });

  it('separates a retried HTTP attempt from a new user-requested generation', () => {
    const session = signTryOnSession(
      SECRET,
      { purpose: 'storefront', context: signedContext().claims },
      NOW,
    );
    const first = signTryOnAttempt(SECRET, {
      session: session.claims,
      attemptNonce: NONCE,
    });
    const retry = signTryOnAttempt(SECRET, {
      session: session.claims,
      attemptNonce: NONCE,
    });
    const nextGeneration = signTryOnAttempt(SECRET, {
      session: session.claims,
      attemptNonce: 'zyxwvutsrqponmlkjihgfedc',
    });

    expect(retry.token).toBe(first.token);
    expect(retry.claims.requestKey).toBe(first.claims.requestKey);
    expect(nextGeneration.claims.requestKey).not.toBe(first.claims.requestKey);
    expect(verifyTryOnAttempt(SECRET, first.token, session.claims, NOW)).toMatchObject({
      shop: SHOP,
      productId: PRODUCT,
      requestKey: first.claims.requestKey,
    });
  });

  it('fails closed without signing configuration', () => {
    expect(() =>
      signStorefrontContext('', contextInput, NOW),
    ).toThrow(/not configured/i);
    expect(verifyStorefrontContext('', signedContext().token, {}, NOW)).toBeNull();
    expect(verifyTryOnSession('', 'anything', {}, NOW)).toBeNull();
  });
});
