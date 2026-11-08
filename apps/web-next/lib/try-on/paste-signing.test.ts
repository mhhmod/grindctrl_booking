// @vitest-environment node
import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pasteLiquidSecret, pasteCapabilitySecret, liquidSignedMessage, verifyLiquidSignature, type LiquidClaims } from '@/lib/paste/signing';
import { buildPasteSnippet } from '@/lib/paste/snippet';
import type { PasteConnection } from '@/lib/paste/types';
import { signStorefrontContext, signTryOnSession, signTryOnAttempt, verifyStorefrontContext, verifyTryOnSession, verifyTryOnAttempt } from './storefront-context';
import { deriveWooSiteSecret } from '@/lib/woo/site-secret';
import { wooTryOnKey, resolveTryOnSessionKey } from './signing-keys';

const SITE = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const NOW = 2_000_000_000;
const connection: PasteConnection = {
  widget_site_id: SITE, platform: 'shopify', shop_domain: 'merchant.myshopify.com', status: 'active',
  secret_version: 1, previous_secret_version: null, previous_valid_until: null,
};
const claims: LiquidClaims = { siteId: SITE, shopDomain: connection.shop_domain!, productId: '42', variantId: '77', issuedAt: String(NOW), customerId: '' };
const mac = (p = claims, version = 1) => createHmac('sha256', pasteLiquidSecret(SITE, version)!).update(liquidSignedMessage(p)).digest('hex');

beforeEach(() => vi.stubEnv('GRINDCTRL_CAPABILITY_SECRET', 'test-only-independent-core-key-with-at-least-32-bytes'));
afterEach(() => vi.unstubAllEnvs());

describe('Liquid signatures and replay', () => {
  it('uses the exact Liquid-compatible ASCII canonical message, including the empty last field', () => {
    expect(liquidSignedMessage(claims)).toBe(`gc-paste-v1|${SITE}|merchant.myshopify.com|42|77|2000000000|`);
    expect(liquidSignedMessage({ ...claims, customerId: '5' })).toBe(`gc-paste-v1|${SITE}|merchant.myshopify.com|42|77|2000000000|5`);
  });
  it('accepts a valid hex MAC and claims a render once per visitor', async () => {
    const used = new Set<string>();
    const claim = vi.fn(async (key: string) => { if (used.has(key)) return false; used.add(key); return true; });
    const input = { connection, claims, signature: mac(), visitor: 'ip:visitor-a' };
    expect(await verifyLiquidSignature(input, { nowSeconds: NOW, claim })).toEqual({ ok: true });
    expect(await verifyLiquidSignature(input, { nowSeconds: NOW, claim })).toEqual({ ok: false, code: 'replayed' });
    expect(await verifyLiquidSignature({ ...input, visitor: 'ip:visitor-b' }, { nowSeconds: NOW, claim })).toEqual({ ok: true });
    expect(claim.mock.calls[0][0]).not.toContain(claims.customerId || 'merchant');
  });
  it.each(['productId', 'variantId', 'shopDomain', 'siteId', 'customerId'] as const)('rejects tampering with %s before touching Redis', async (field) => {
    const claim = vi.fn();
    const values = { productId: '99', variantId: '99', shopDomain: 'other.myshopify.com', siteId: OTHER, customerId: '99' };
    expect(await verifyLiquidSignature({ connection, claims: { ...claims, [field]: values[field] }, signature: mac(), visitor: 'v' }, { nowSeconds: NOW, claim }))
      .toEqual({ ok: false, code: 'bad_signature' });
    expect(claim).not.toHaveBeenCalled();
  });
  it.each(['', 'not-hex', 'a'.repeat(63), 'a'.repeat(64), 'A'.repeat(64)])('rejects invalid MAC %s', async (signature) => {
    expect((await verifyLiquidSignature({ connection, claims, signature, visitor: 'v' }, { nowSeconds: NOW, claim: async () => true })).ok).toBe(false);
  });
  it.each([NOW - 901, NOW + 31])('rejects expired/future render at %s', async (issuedAt) => {
    const p = { ...claims, issuedAt: String(issuedAt) };
    expect(await verifyLiquidSignature({ connection, claims: p, signature: mac(p), visitor: 'v' }, { nowSeconds: NOW, claim: async () => true }))
      .toEqual({ ok: false, code: 'stale_signature' });
  });
  it('allows the current and previous secrets only inside the overlap and keeps replay identity across versions', async () => {
    const rotated = { ...connection, secret_version: 2, previous_secret_version: 1, previous_valid_until: new Date((NOW + 900) * 1000).toISOString() };
    const used = new Set<string>();
    const claim = async (key: string) => { if (used.has(key)) return false; used.add(key); return true; };
    const input = { connection: rotated, claims, signature: mac(), visitor: 'v' };
    expect(await verifyLiquidSignature(input, { nowSeconds: NOW, claim })).toEqual({ ok: true });
    expect(await verifyLiquidSignature({ ...input, signature: mac(claims, 2) }, { nowSeconds: NOW, claim })).toEqual({ ok: false, code: 'replayed' });
    const expired = { ...rotated, previous_valid_until: new Date(NOW * 1000).toISOString() };
    expect(await verifyLiquidSignature({ ...input, connection: expired }, { nowSeconds: NOW, claim })).toEqual({ ok: false, code: 'bad_signature' });
  });
  it('fails closed when the core secret or distributed replay store is absent or down', async () => {
    const input = { connection, claims, signature: mac(), visitor: 'v' };
    expect(await verifyLiquidSignature(input, { nowSeconds: NOW, claim: async () => { throw new Error('redis down'); } })).toEqual({ ok: false, code: 'unavailable' });
    vi.stubEnv('UPSTASH_REDIS_REST_URL', ''); vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
    expect(await verifyLiquidSignature(input, { nowSeconds: NOW })).toEqual({ ok: false, code: 'unavailable' });
    vi.stubEnv('GRINDCTRL_CAPABILITY_SECRET', '');
    expect(await verifyLiquidSignature(input, { nowSeconds: NOW, claim: async () => true })).toEqual({ ok: false, code: 'unavailable' });
  });
});

describe('paste capabilities and snippet', () => {
  it('separates Liquid, capability, Woo, Shopify and other-site trust domains', () => {
    const values = [pasteLiquidSecret(SITE, 1), pasteLiquidSecret(SITE, 2), pasteCapabilitySecret(SITE), pasteCapabilitySecret(OTHER), deriveWooSiteSecret(SITE, 1), wooTryOnKey(SITE, 1)];
    expect(new Set(values).size).toBe(values.length);
  });
  it.each(['paste-website', 'paste-shopify'] as const)('preserves platform, origin and test flag through %s session and attempt', (platform) => {
    const secret = pasteCapabilitySecret(SITE)!;
    const context = signStorefrontContext(secret, {
      shop: `site:${SITE}`, platform, productId: 'tee-42', variantId: '77', productGid: 'paste:tee-42', variantGid: 'paste:77',
      canonicalGarmentUrl: 'https://merchant.example/a.png', origin: 'https://merchant.example', nonce: 'abcdefghijklmnopqrstuvwx', test: true,
    }, NOW);
    expect(verifyStorefrontContext(pasteCapabilitySecret(OTHER)!, context.token, {}, NOW)).toBeNull();
    const verified = verifyStorefrontContext(secret, context.token, {}, NOW)!;
    expect(verified).toMatchObject({ platform, test: true, origin: 'https://merchant.example' });
    const session = signTryOnSession(secret, { purpose: 'storefront', context: verified }, NOW);
    const s = verifyTryOnSession(secret, session.token, {}, NOW)!;
    expect(s).toMatchObject({ platform, test: true, origin: 'https://merchant.example' });
    const attempt = signTryOnAttempt(secret, { session: s, attemptNonce: 'abcdefghijklmnopqrstuvwx' });
    expect(verifyTryOnAttempt(secret, attempt.token, s, NOW)).toMatchObject({ platform, test: true, origin: 'https://merchant.example' });
    expect(resolveTryOnSessionKey((key) => verifyTryOnSession(key, session.token, {}, NOW))).toBeNull();
    expect(verifyStorefrontContext(secret, context.token, {}, NOW + 120)).toBeNull();
  });
  it('puts only the Liquid derivation in the merchant snippet and emits just a MAC to the browser', () => {
    const result = buildPasteSnippet(connection, 'gc_public_key_42');
    expect(result.snippet).toContain(`| hmac_sha256: '${pasteLiquidSecret(SITE, 1)}'`);
    expect(result.snippet).not.toContain(pasteCapabilitySecret(SITE));
    expect(result.snippet).toContain('{{ gc_signature }}');
    expect(result.steps).toContainEqual({ kind: 'select', target: 'footer' });
    expect(result.steps).toContainEqual({ kind: 'select', target: 'custom_liquid' });
    const website = buildPasteSnippet({ ...connection, platform: 'website', shop_domain: null }, 'gc_public_key_42');
    expect(website.snippet).toBe('<script async src="https://grindctrl.cloud/widget/v1/messenger.js" data-key="gc_public_key_42" data-gc-install="paste" data-gc-platform="website"></script>');
  });
});
