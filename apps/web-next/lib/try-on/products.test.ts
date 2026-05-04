import { describe, it, expect } from 'vitest';
import { getProduct, getDefaultProduct, DEFAULT_PRODUCT_ID } from './products';

describe('try-on products', () => {
  it('returns the default product', () => {
    const product = getDefaultProduct();
    expect(product).toBeDefined();
    expect(product.id).toBe(DEFAULT_PRODUCT_ID);
    expect(product.name).toBe('Premium Ringer Tee');
    expect(product.category).toBe('t-shirt');
  });

  it('looks up a valid product by ID', () => {
    const product = getProduct('premium-ringer-tee');
    expect(product).toBeDefined();
    expect(product?.name).toBe('Premium Ringer Tee');
  });

  it('returns undefined for unknown product', () => {
    const product = getProduct('non-existent');
    expect(product).toBeUndefined();
  });

  it('has required product fields', () => {
    const product = getDefaultProduct();
    expect(product.imageUrl).toBeTruthy();
    expect(product.details.length).toBeGreaterThan(0);
  });
});
