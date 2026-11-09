// @vitest-environment node
import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PASTE_RENDER_MAX_SESSIONS, pasteLiquidSecret, pasteCapabilitySecret, liquidSignedMessage, verifyLiquidSignature, type LiquidClaims,
} from '@/lib/paste/signing';
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
  secret_version: 1, previous_secret_version: null, previous_valid_until: null, first_seen_at: null, last_seen_at: null,
  shop_proven_at: '2033-05-18T03:33:20.000Z', disconnected_reason: null, shop_render_at: null, shop_check_outcome: null,
  shop_checked_at: null, app_installed: false,
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
  /** An in-memory stand-in for the Redis INCR counter. */
  function counter() {
    const uses = new Map<string, number>();
    return vi.fn(async (key: string) => { const next = (uses.get(key) ?? 0) + 1; uses.set(key, next); return next; });
  }
  it('lets one render mint at most three shopper sessions, whatever visitor id or network the caller rotates', async () => {
    const count = counter();
    const input = { connection, claims, signature: mac() };
    for (let session = 1; session <= PASTE_RENDER_MAX_SESSIONS; session++) {
      expect(await verifyLiquidSignature(input, { nowSeconds: NOW, count })).toEqual({ ok: true });
    }
    // The caller-chosen visitor id is not an input any more: the fourth use
    // of the same render is refused however the request is dressed up.
    expect(await verifyLiquidSignature({ ...input, visitor: 'ip:visitor-b' } as typeof input, { nowSeconds: NOW, count }))
      .toEqual({ ok: false, code: 'replayed' });
    expect(new Set(count.mock.calls.map(([key]) => key)).size).toBe(1);
    expect(count.mock.calls[0][0]).toMatch(new RegExp(`^gc-paste:render:v2:${SITE}:[a-f0-9]{64}$`));
    // A different render (a fresh issuedAt) is a different key.
    const fresh = { ...claims, issuedAt: String(NOW - 1) };
    expect(await verifyLiquidSignature({ connection, claims: fresh, signature: mac(fresh) }, { nowSeconds: NOW, count })).toEqual({ ok: true });
  });
  it.each(['productId', 'variantId', 'shopDomain', 'siteId', 'customerId'] as const)('rejects tampering with %s before touching Redis', async (field) => {
    const count = vi.fn();
    const values = { productId: '99', variantId: '99', shopDomain: 'other.myshopify.com', siteId: OTHER, customerId: '99' };
    expect(await verifyLiquidSignature({ connection, claims: { ...claims, [field]: values[field] }, signature: mac() }, { nowSeconds: NOW, count }))
      .toEqual({ ok: false, code: 'bad_signature' });
    expect(count).not.toHaveBeenCalled();
  });
  it.each(['', 'not-hex', 'a'.repeat(63), 'a'.repeat(64), 'A'.repeat(64)])('rejects invalid MAC %s', async (signature) => {
    expect((await verifyLiquidSignature({ connection, claims, signature }, { nowSeconds: NOW, count: async () => 1 })).ok).toBe(false);
  });
  it.each([NOW - 901, NOW + 31])('rejects expired/future render at %s', async (issuedAt) => {
    const p = { ...claims, issuedAt: String(issuedAt) };
    expect(await verifyLiquidSignature({ connection, claims: p, signature: mac(p) }, { nowSeconds: NOW, count: async () => 1 }))
      .toEqual({ ok: false, code: 'stale_signature' });
  });
  it('allows the current and previous secrets only inside the overlap and keeps replay identity across versions', async () => {
    const rotated = { ...connection, secret_version: 2, previous_secret_version: 1, previous_valid_until: new Date((NOW + 900) * 1000).toISOString() };
    const count = counter();
    const input = { connection: rotated, claims, signature: mac() };
    for (let session = 1; session <= PASTE_RENDER_MAX_SESSIONS; session++) {
      expect(await verifyLiquidSignature(input, { nowSeconds: NOW, count })).toEqual({ ok: true });
    }
    expect(await verifyLiquidSignature({ ...input, signature: mac(claims, 2) }, { nowSeconds: NOW, count })).toEqual({ ok: false, code: 'replayed' });
    const expired = { ...rotated, previous_valid_until: new Date(NOW * 1000).toISOString() };
    expect(await verifyLiquidSignature({ ...input, connection: expired }, { nowSeconds: NOW, count })).toEqual({ ok: false, code: 'bad_signature' });
  });
  it('fails closed when the core secret or distributed replay store is absent, down or answers nonsense', async () => {
    const input = { connection, claims, signature: mac() };
    expect(await verifyLiquidSignature(input, { nowSeconds: NOW, count: async () => { throw new Error('redis down'); } })).toEqual({ ok: false, code: 'unavailable' });
    expect(await verifyLiquidSignature(input, { nowSeconds: NOW, count: async () => 0 })).toEqual({ ok: false, code: 'unavailable' });
    expect(await verifyLiquidSignature(input, { nowSeconds: NOW, count: async () => Number.NaN })).toEqual({ ok: false, code: 'unavailable' });
    vi.stubEnv('UPSTASH_REDIS_REST_URL', ''); vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
    expect(await verifyLiquidSignature(input, { nowSeconds: NOW })).toEqual({ ok: false, code: 'unavailable' });
    vi.stubEnv('GRINDCTRL_CAPABILITY_SECRET', '');
    expect(await verifyLiquidSignature(input, { nowSeconds: NOW, count: async () => 1 })).toEqual({ ok: false, code: 'unavailable' });
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
    expect(result.snippet).toContain(`{%- assign gc_key = '${pasteLiquidSecret(SITE, 1)}' -%}`);
    expect(result.snippet).toContain('| hmac_sha256: gc_key');
    expect(result.snippet).not.toContain(pasteCapabilitySecret(SITE));
    expect(result.snippet).toContain('{{ gc_signature }}');
    expect(result.steps).toContainEqual({ kind: 'select', target: 'footer' });
    expect(result.steps).toContainEqual({ kind: 'select', target: 'custom_liquid' });
    const website = buildPasteSnippet({ ...connection, platform: 'website', shop_domain: null }, 'gc_public_key_42');
    expect(website.snippet).toBe('<script async src="https://grindctrl.cloud/widget/v1/messenger.js" data-key="gc_public_key_42" data-gc-install="paste" data-gc-platform="website"></script>');
  });
});
