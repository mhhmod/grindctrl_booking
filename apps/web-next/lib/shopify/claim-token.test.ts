// @vitest-environment node
import { describe, expect, it, vi, afterEach } from 'vitest';
import { createHmac } from 'node:crypto';
import { signClaimToken, verifyClaimToken, CLAIM_TTL_SECONDS } from './claim-token';

const SECRET = 'shpss_test_secret';
const SHOP = 'demo.myshopify.com';

// Builds a token bypassing signClaimToken entirely, so tests can assert what
// verifyClaimToken does with payloads the mint side would never produce
// (wrong issuer, non-canonical shop, empty secret) — the mint-side checks
// are not the trust boundary; verify is.
const forge = (payload: unknown, secret: string = SECRET) => {
  const body = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(
    JSON.stringify(payload),
  ).toString('base64url')}`;
  return `${body}.${createHmac('sha256', secret).update(body, 'utf8').digest('base64url')}`;
};

// forge() goes through JSON.stringify, which can't produce non-finite
// numbers (Infinity serializes to null) or omit keys present in the type.
// forgeRaw signs literal JSON text instead, so tests can reach payload
// shapes JS's own JSON.stringify would never let them build.
const forgeRaw = (json: string) => {
  const body = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(
    json,
  ).toString('base64url')}`;
  return `${body}.${createHmac('sha256', SECRET).update(body, 'utf8').digest('base64url')}`;
};

afterEach(() => vi.useRealTimers());

describe('claim token', () => {
  it('round-trips the shop it was minted for', () => {
    expect(verifyClaimToken(SECRET, signClaimToken(SECRET, SHOP))).toEqual({ shop: SHOP });
  });

  it('normalizes a mixed-case, padded shop domain', () => {
    // shop-authorization.ts's normalizeShopDomain is the single source of
    // truth for "which store is this" — claim-token defers to it entirely.
    expect(verifyClaimToken(SECRET, signClaimToken(SECRET, ' Demo.MyShopify.Com '))).toEqual({ shop: SHOP });
  });

  it('refuses a token signed with a different secret', () => {
    expect(verifyClaimToken('other-secret', signClaimToken(SECRET, SHOP))).toBeNull();
  });

  it('refuses a tampered payload', () => {
    // Swapping the shop must invalidate the signature, or a claim for one
    // store adopts another.
    const [h, p, s] = signClaimToken(SECRET, SHOP).split('.');
    const forged = Buffer.from(
      JSON.stringify({ ...JSON.parse(Buffer.from(p, 'base64url').toString()), shop: 'evil.myshopify.com' }),
    ).toString('base64url');
    expect(verifyClaimToken(SECRET, `${h}.${forged}.${s}`)).toBeNull();
  });

  it('expires', () => {
    const token = signClaimToken(SECRET, SHOP);
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + (CLAIM_TTL_SECONDS + 60) * 1000);
    expect(verifyClaimToken(SECRET, token)).toBeNull();
  });

  it('refuses junk, an empty token, and a non-myshopify shop', () => {
    expect(verifyClaimToken(SECRET, 'not.a.token')).toBeNull();
    expect(verifyClaimToken(SECRET, '')).toBeNull();
    expect(() => signClaimToken(SECRET, 'evil.example.com')).toThrow();
    expect(() => signClaimToken('', SHOP)).toThrow();
  });

  it('refuses a missing secret even when mint and verify would agree', () => {
    // The real threat isn't a mismatched secret (the MAC comparison alone
    // catches that) — it's SHOPIFY_API_SECRET absent on BOTH sides, where
    // "" is a MAC anyone can compute. signClaimToken now refuses to mint
    // with an empty secret, so simulate what a bug in that guard would
    // produce and confirm verify still refuses it independently.
    const exp = Math.floor(Date.now() / 1000) + 60;
    const forged = forge({ iss: 'grindctrl-shop-claim', shop: SHOP, iat: exp - 60, exp, jti: 'x' }, '');
    expect(verifyClaimToken('', forged)).toBeNull();
  });

  it('pins the issuer and the verify-side shop check independently', () => {
    const exp = Math.floor(Date.now() / 1000) + 60;
    // The app secret also signs messenger tokens (identity.ts). Only `iss`
    // separates "claim this store" from "you are logged in as a shopper".
    expect(
      verifyClaimToken(SECRET, forge({ iss: 'grindctrl-messenger', shop: SHOP, exp })),
    ).toBeNull();
    // A valid signature is proof of the secret, not proof of the shop —
    // the mint-side normalizeShopDomain check is not the trust boundary.
    expect(
      verifyClaimToken(SECRET, forge({ iss: 'grindctrl-shop-claim', shop: 'evil.example.com', exp })),
    ).toBeNull();
    expect(
      verifyClaimToken(SECRET, forge({ iss: 'grindctrl-shop-claim', shop: 123, exp })),
    ).toBeNull();
  });

  it('pins the canonical shop form, a null payload, and a non-finite exp', () => {
    const exp = Math.floor(Date.now() / 1000) + 60;
    const ok = { iss: 'grindctrl-shop-claim', exp };
    // A signature proves the secret, not the shop: reject anything mint
    // would not have emitted verbatim.
    expect(verifyClaimToken(SECRET, forge({ ...ok, shop: 'DEMO.myshopify.com' }))).toBeNull();
    expect(verifyClaimToken(SECRET, forge({ ...ok, shop: 'store-.myshopify.com' }))).toBeNull();
    expect(verifyClaimToken(SECRET, forge({ ...ok, shop: `${'a'.repeat(64)}.myshopify.com` }))).toBeNull();
    // A signed null payload must return null, not throw.
    expect(verifyClaimToken(SECRET, forge(null))).toBeNull();
    // An absent or non-finite exp is an immortal token.
    expect(
      verifyClaimToken(SECRET, forgeRaw(`{"iss":"grindctrl-shop-claim","shop":"${SHOP}","exp":1e999}`)),
    ).toBeNull();
    expect(
      verifyClaimToken(SECRET, forgeRaw(`{"iss":"grindctrl-shop-claim","shop":"${SHOP}"}`)),
    ).toBeNull();
  });

  it('mints a distinct token each time', () => {
    // A nonce keeps two claims for the same shop from being the same
    // string. Compare the decoded jti, not the whole token — iat alone
    // would already make same-second mints differ, so a whole-string
    // comparison wouldn't actually prove the nonce exists.
    const decode = (token: string) => JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).jti;
    expect(decode(signClaimToken(SECRET, SHOP))).not.toBe(decode(signClaimToken(SECRET, SHOP)));
  });
});
