import { describe, expect, it } from 'vitest';
import { proxyRateLimitKeys, proxyVisitorId } from './proxy-rate-limit';

/* Phase zero item 3: App Proxy requests come from Shopify's address, so a
   signed request is never keyed by address. */
describe('proxyRateLimitKeys', () => {
  it('keys a signed request by shop and visitor, with a separate shop key', () => {
    expect(
      proxyRateLimitKeys({
        route: 'config',
        signedShop: 'maison.myshopify.com',
        visitorId: 'v_0123456789abcdef',
        address: '23.227.38.65',
      }),
    ).toEqual({
      kind: 'signed',
      visitor: 'pc:maison.myshopify.com:v_0123456789abcdef',
      shop: 'pc:maison.myshopify.com',
    });
  });

  it('gives two shoppers of one store different buckets behind the same address', () => {
    const a = proxyRateLimitKeys({ route: 'try-on-context', signedShop: 's.myshopify.com', visitorId: 'aaaaaaaaaaaaaaaa', address: '23.227.38.65' });
    const b = proxyRateLimitKeys({ route: 'try-on-context', signedShop: 's.myshopify.com', visitorId: 'bbbbbbbbbbbbbbbb', address: '23.227.38.65' });
    expect(a.kind === 'signed' && b.kind === 'signed' && a.visitor !== b.visitor).toBe(true);
  });

  it('gives two stores different ceilings behind the same address', () => {
    const a = proxyRateLimitKeys({ route: 'config', signedShop: 'a.myshopify.com', visitorId: null, address: '23.227.38.65' });
    const b = proxyRateLimitKeys({ route: 'config', signedShop: 'b.myshopify.com', visitorId: null, address: '23.227.38.65' });
    expect(a).toEqual({ kind: 'signed', visitor: null, shop: 'pc:a.myshopify.com' });
    expect(b).toEqual({ kind: 'signed', visitor: null, shop: 'pc:b.myshopify.com' });
  });

  it('keeps the address key only for unsigned requests', () => {
    expect(
      proxyRateLimitKeys({ route: 'messenger-identity', signedShop: null, visitorId: 'v_0123456789abcdef', address: '198.51.100.7' }),
    ).toEqual({ kind: 'direct', address: 'mi:198.51.100.7' });
    expect(
      proxyRateLimitKeys({ route: 'config', signedShop: null, visitorId: null, address: null }),
    ).toEqual({ kind: 'direct', address: 'pc:unknown' });
  });
});

describe('proxyVisitorId', () => {
  it('accepts the ids the scripts mint and refuses anything else', () => {
    expect(proxyVisitorId('Zx9_-abcdefghijklmnopqrs')).toBe('Zx9_-abcdefghijklmnopqrs');
    expect(proxyVisitorId('2b1e0c5e-8f2a-4c1d-9b7e-3f6a1d2c4b5a')).toBe('2b1e0c5e-8f2a-4c1d-9b7e-3f6a1d2c4b5a');
    expect(proxyVisitorId('short')).toBeNull();
    expect(proxyVisitorId('has spaces in it here')).toBeNull();
    expect(proxyVisitorId('x'.repeat(65))).toBeNull();
    expect(proxyVisitorId(null)).toBeNull();
  });
});
