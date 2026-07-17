import { describe, expect, it } from 'vitest';
import { authorizeDashboardShop, normalizeShopDomain } from './shop-authorization';

describe('authorizeDashboardShop', () => {
  it('allows the global default without a shops record', () => {
    expect(authorizeDashboardShop('default', [])).toBe('default');
  });

  it('allows a normalized domain that exists in the installed shops records', () => {
    expect(
      authorizeDashboardShop(' Store-One.MyShopify.com ', ['store-one.myshopify.com']),
    ).toBe('store-one.myshopify.com');
  });

  it('rejects a valid but unknown Shopify domain', () => {
    expect(() =>
      authorizeDashboardShop('unknown.myshopify.com', ['known.myshopify.com']),
    ).toThrow('Unknown Shopify shop');
  });

  it('rejects malformed shop values', () => {
    expect(() => authorizeDashboardShop('https://known.myshopify.com', [])).toThrow(
      'Unknown Shopify shop',
    );
  });
});

describe('normalizeShopDomain', () => {
  it('rejects labels that start or end with a hyphen', () => {
    expect(normalizeShopDomain('-store.myshopify.com')).toBeNull();
    expect(normalizeShopDomain('store-.myshopify.com')).toBeNull();
  });
});
