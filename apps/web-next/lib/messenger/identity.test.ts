import { describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import {
  extractProxyIdentity,
  signShopperToken,
  verifyShopperToken,
  verifyShopifyProxySignature,
} from './identity';

const SECRET = 'test-secret-abcdef';
const SHOP = 'store.myshopify.com';

/** Mirrors the server's HMAC exactly: decoded, sorted k=v groups, repeated
 *  values comma-joined, no escaping. Shopify does not escape the query
 *  string it signs, so a test helper that did would sign a different string
 *  than the one under test and every "correctly signed" case would be
 *  exercising the wrong algorithm. */
function signedProxyQuery(claims: Record<string, string | string[]>): URLSearchParams {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(claims)) {
    for (const value of Array.isArray(v) ? v : [v]) params.append(k, value);
  }
  const pairs = [...new Set(params.keys())]
    .map((key) => `${key}=${params.getAll(key).join(',')}`)
    .sort();
  params.set('signature', createHmac('sha256', SECRET).update(pairs.join(''), 'utf8').digest('hex'));
  return params;
}

describe('verifyShopifyProxySignature', () => {
  it('accepts a correctly signed proxy request', () => {
    const params = signedProxyQuery({ shop: SHOP, logged_in_customer_id: '123' });
    expect(verifyShopifyProxySignature(params, SECRET)).toBe(true);
  });

  it('rejects tampered parameters', () => {
    const params = signedProxyQuery({ shop: SHOP, logged_in_customer_id: '123' });
    params.set('logged_in_customer_id', '999');
    expect(verifyShopifyProxySignature(params, SECRET)).toBe(false);
  });

  it('rejects wrong secrets and missing signatures', () => {
    const params = signedProxyQuery({ shop: SHOP });
    expect(verifyShopifyProxySignature(params, 'other-secret')).toBe(false);
    const unsigned = new URLSearchParams({ shop: SHOP });
    expect(verifyShopifyProxySignature(unsigned, SECRET)).toBe(false);
  });

  it('rejects a signature that is not 64 lowercase hex characters', () => {
    const params = new URLSearchParams({ shop: SHOP, signature: 'not-hex' });
    expect(verifyShopifyProxySignature(params, SECRET)).toBe(false);
    const upper = new URLSearchParams({ shop: SHOP, signature: 'A'.repeat(64) });
    expect(verifyShopifyProxySignature(upper, SECRET)).toBe(false);
  });

  /* A duplicate value on a security-sensitive key is exactly the shape a
     first-value/joined-value parsing mismatch between us and an attacker's
     client could be exploited through, so it must fail closed rather than
     silently pick one interpretation. */
  it('refuses a repeated security-sensitive key rather than guessing which value counts', () => {
    const params = signedProxyQuery({ shop: [SHOP, 'evil.myshopify.com'] });
    expect(verifyShopifyProxySignature(params, SECRET)).toBe(false);
  });

  it('tolerates a repeated ordinary key by comma-joining, per Shopify\'s documented example', () => {
    const params = signedProxyQuery({ shop: SHOP, extra: ['1', '2'] });
    expect(verifyShopifyProxySignature(params, SECRET)).toBe(true);
  });
});

describe('extractProxyIdentity', () => {
  it('trusts only Shopify\'s own logged_in_customer_id, never caller-supplied fields', () => {
    const params = new URLSearchParams({
      logged_in_customer_id: '555',
      // These look like identity claims but the proxy will sign whatever a
      // theme puts in the URL, so they must never surface as trusted PII.
      customer_email: 'a@b.co',
      customer_name: 'Sara',
    });
    expect(extractProxyIdentity(params)).toEqual({ customerId: '555', email: null, name: null });
  });

  it('rejects a non-numeric, zero, or absent customer id', () => {
    expect(extractProxyIdentity(new URLSearchParams({ logged_in_customer_id: 'DROP TABLE' }))).toBeNull();
    expect(extractProxyIdentity(new URLSearchParams({ logged_in_customer_id: '0' }))).toBeNull();
    expect(extractProxyIdentity(new URLSearchParams({}))).toBeNull();
  });

  it('refuses a duplicated logged_in_customer_id rather than picking the first', () => {
    const params = new URLSearchParams();
    params.append('logged_in_customer_id', '555');
    params.append('logged_in_customer_id', '999');
    expect(extractProxyIdentity(params)).toBeNull();
  });
});

describe('shopper token lifecycle', () => {
  const identity = { customerId: '42', email: 'sara@example.com', name: 'Sara' };

  it('round-trips claims bound to the session id and shop', () => {
    const token = signShopperToken(SECRET, { sessionId: 'sess1', shop: SHOP, identity });
    // verifyShopperToken returns whatever the token actually carries; the
    // real production path only ever signs email/name as null because
    // extractProxyIdentity no longer trusts them (see above), but that is a
    // property of the caller, not of this round-trip.
    expect(verifyShopperToken(SECRET, token, 'sess1', SHOP)).toEqual(identity);
  });

  it('refuses tokens from another browser session (replay across sessions)', () => {
    const token = signShopperToken(SECRET, { sessionId: 'sess1', shop: SHOP, identity });
    expect(verifyShopperToken(SECRET, token, 'sess2', SHOP)).toBeNull();
  });

  /* The property this change actually adds: a token minted for one store
     must not verify for another, even with the right session id and secret
     - the scenario a shared app secret across all merchants makes possible. */
  it('refuses a token presented against a different shop', () => {
    const token = signShopperToken(SECRET, { sessionId: 'sess1', shop: SHOP, identity });
    expect(verifyShopperToken(SECRET, token, 'sess1', 'other-store.myshopify.com')).toBeNull();
  });

  it('refuses forged or wrong-key tokens', () => {
    const forged = signShopperToken('attacker-key', { sessionId: 'sess1', shop: SHOP, identity });
    expect(verifyShopperToken(SECRET, forged, 'sess1', SHOP)).toBeNull();
    expect(verifyShopperToken(SECRET, 'garbage.token.here', 'sess1', SHOP)).toBeNull();
  });

  it('refuses to sign or verify against an unresolvable shop', () => {
    expect(() => signShopperToken(SECRET, { sessionId: 'sess1', shop: 'not a shop', identity })).toThrow();
    const token = signShopperToken(SECRET, { sessionId: 'sess1', shop: SHOP, identity });
    expect(verifyShopperToken(SECRET, token, 'sess1', 'not a shop')).toBeNull();
  });
});
