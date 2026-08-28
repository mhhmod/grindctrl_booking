import { describe, expect, it } from 'vitest';
import {
  extractProxyIdentity,
  signShopperToken,
  verifyShopperToken,
  verifyShopifyProxySignature,
} from './identity';

const SECRET = 'test-secret-abcdef';

function signedProxyQuery(claims: Record<string, string>): URLSearchParams {
  const params = new URLSearchParams(claims);
  const pairs: string[] = [];
  for (const [k, v] of params.entries()) {
    pairs.push(`${k}=${v.replace(/&/g, '%26').replace(/=/g, '%3D')}`);
  }
  pairs.sort();
  // Mirror the server's HMAC so tests stay honest about the algorithm.
  const { createHmac } = require('node:crypto') as typeof import('node:crypto');
  params.set('signature', createHmac('sha256', SECRET).update(pairs.join(''), 'utf8').digest('hex'));
  return params;
}

describe('verifyShopifyProxySignature', () => {
  it('accepts a correctly signed proxy request', () => {
    const params = signedProxyQuery({ shop: 'store.myshopify.com', customer_id: '123' });
    expect(verifyShopifyProxySignature(params, SECRET)).toBe(true);
  });

  it('rejects tampered parameters', () => {
    const params = signedProxyQuery({ shop: 'store.myshopify.com', customer_id: '123' });
    params.set('customer_id', '999');
    expect(verifyShopifyProxySignature(params, SECRET)).toBe(false);
  });

  it('rejects wrong secrets and missing signatures', () => {
    const params = signedProxyQuery({ shop: 'store.myshopify.com' });
    expect(verifyShopifyProxySignature(params, 'other-secret')).toBe(false);
    const unsigned = new URLSearchParams({ shop: 'store.myshopify.com' });
    expect(verifyShopifyProxySignature(unsigned, SECRET)).toBe(false);
  });
});

describe('extractProxyIdentity', () => {
  it('requires a numeric customer id', () => {
    const ok = new URLSearchParams({ customer_id: '555', customer_email: 'a@b.co', customer_name: 'Sara' });
    expect(extractProxyIdentity(ok)).toEqual({ customerId: '555', email: 'a@b.co', name: 'Sara' });
    const bad = new URLSearchParams({ customer_id: 'DROP TABLE' });
    expect(extractProxyIdentity(bad)).toBeNull();
    const absent = new URLSearchParams({});
    expect(extractProxyIdentity(absent)).toBeNull();
  });
});

describe('shopper token lifecycle', () => {
  const identity = { customerId: '42', email: 'sara@example.com', name: 'Sara' };

  it('round-trips claims bound to the session id', () => {
    const token = signShopperToken(SECRET, { sessionId: 'sess1', identity });
    expect(verifyShopperToken(SECRET, token, 'sess1')).toEqual(identity);
  });

  it('refuses tokens from another browser session (replay across sessions)', () => {
    const token = signShopperToken(SECRET, { sessionId: 'sess1', identity });
    expect(verifyShopperToken(SECRET, token, 'sess2')).toBeNull();
  });

  it('refuses forged or wrong-key tokens', () => {
    const forged = signShopperToken('attacker-key', { sessionId: 'sess1', identity });
    expect(verifyShopperToken(SECRET, forged, 'sess1')).toBeNull();
    expect(verifyShopperToken(SECRET, 'garbage.token.here', 'sess1')).toBeNull();
  });
});
