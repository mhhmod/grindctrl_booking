import { describe, expect, it } from 'vitest';
import { formatStorePrice, isSizeOption, parseStoreProduct, sizeChoices, variantName } from './store-product';

/* A fake product with two colours and four sizes (phase zero item 19). */
const RAW = {
  options: ['Colour', 'Size'],
  currency: 'EGP',
  variants: [
    ...['S', 'M', 'L', 'XL'].map((size, i) => ({ id: 100 + i, title: `Black / ${size}`, options: ['Black', size], available: size !== 'L', price: 325000 })),
    ...['S', 'M', 'L', 'XL'].map((size, i) => ({ id: 200 + i, title: `Sand / ${size}`, options: ['Sand', size], available: true, price: 335050 })),
  ],
};

describe('the store product in the sheet', () => {
  it('keeps what the loader sends, field by field', () => {
    const product = parseStoreProduct(RAW)!;
    expect(product.options).toEqual(['Colour', 'Size']);
    expect(product.currency).toBe('EGP');
    expect(product.variants).toHaveLength(8);
    expect(product.variants[2]).toEqual({ id: '102', title: 'Black / L', options: ['Black', 'L'], available: false, price: 325000 });
  });

  it('drops what it cannot trust', () => {
    expect(parseStoreProduct(null)).toBeNull();
    expect(parseStoreProduct({ variants: 'x' })).toBeNull();
    expect(parseStoreProduct({ variants: [{ id: 'javascript:1' }] })).toBeNull();
    const product = parseStoreProduct({
      options: ['Size', 7],
      currency: 'egp',
      variants: [{ id: 5, title: 'M', options: ['M'], available: 'yes', price: -1 }, { id: '1;2' }],
    })!;
    expect(product).toEqual({ options: ['Size'], currency: null, variants: [{ id: '5', title: 'M', options: ['M'], available: false, price: null }] });
  });

  it('offers the sizes of the colour that was tried, sold out ones included', () => {
    const product = parseStoreProduct(RAW)!;
    const tried = product.variants[1];
    const { index, variants } = sizeChoices(product, tried);
    expect(index).toBe(1);
    expect(variants.map((v) => v.options[1])).toEqual(['S', 'M', 'L', 'XL']);
    expect(variants.every((v) => v.options[0] === 'Black')).toBe(true);
    expect(variants.find((v) => v.options[1] === 'L')?.available).toBe(false);
  });

  it('knows a size by its name in English, Arabic and a few more', () => {
    for (const name of ['Size', 'Sizes', 'المقاس', 'مقاس', 'Taille', 'Größe']) expect(isSizeOption(name)).toBe(true);
    for (const name of ['Colour', 'Color', 'اللون', 'Length', 'Sizeable fit']) expect(isSizeOption(name)).toBe(false);
    const noSize = parseStoreProduct({ options: ['Colour'], variants: [{ id: 1, options: ['Black'] }] })!;
    expect(sizeChoices(noSize, noSize.variants[0])).toEqual({ index: -1, variants: [] });
  });

  it('names variants the way the boards do', () => {
    expect(variantName('Black / M', 'en')).toBe('Black, M');
    expect(variantName('أسود / M', 'ar')).toBe('أسود، M');
    expect(variantName('Default Title', 'en')).toBe('');
  });

  it('writes prices with Western digits, and cents only when there are some', () => {
    // Intl keeps the amount and the currency together with a no-break space.
    const price = (minor: number, currency: string, locale: 'en' | 'ar') =>
      formatStorePrice(minor, currency, locale).replace(/\u00a0/g, ' ');
    expect(price(325000, 'EGP', 'en')).toBe('EGP 3,250');
    expect(price(325000, 'EGP', 'ar')).toBe('3,250 ج.م');
    expect(price(32550, 'SAR', 'en')).toBe('SAR 325.50');
    expect(price(32550, 'SAR', 'ar')).toMatch(/^325\.50 /);
  });
});
