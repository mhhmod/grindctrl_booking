// @vitest-environment node
import { describe, expect, it, vi, afterEach } from 'vitest';
import { signClaimToken, verifyClaimToken, CLAIM_TTL_SECONDS } from './claim-token';

const SECRET = 'shpss_test_secret';
const SHOP = 'demo.myshopify.com';

afterEach(() => vi.useRealTimers());

describe('claim token', () => {
  it('round-trips the shop it was minted for', () => {
    expect(verifyClaimToken(SECRET, signClaimToken(SECRET, SHOP))).toEqual({ shop: SHOP });
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

  it('refuses junk, a missing secret, and a non-myshopify shop', () => {
    expect(verifyClaimToken(SECRET, 'not.a.token')).toBeNull();
    expect(verifyClaimToken(SECRET, '')).toBeNull();
    expect(verifyClaimToken('', signClaimToken(SECRET, SHOP))).toBeNull();
    expect(() => signClaimToken(SECRET, 'evil.example.com')).toThrow();
  });

  it('mints a distinct token each time', () => {
    // A nonce keeps two claims for the same shop from being the same string.
    expect(signClaimToken(SECRET, SHOP)).not.toBe(signClaimToken(SECRET, SHOP));
  });
});
