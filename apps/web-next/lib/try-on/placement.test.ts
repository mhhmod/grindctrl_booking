// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parsePlacement, parseSpot, publicPlacement, validSpotSelector } from './placement';

const spot = { selector: 'form[action*="cart"]', position: 'after', label: 'Add to cart', pathHint: '/products/dress' };

describe('spot selector grammar', () => {
  it.each([
    '#ProductInfo',
    'form[action*="cart"]',
    'button[name="add"]',
    'div[data-product-form]',
    'div[data-block="buy buttons"]',
    'div.product__info.grid > button.btn',
    '#main div.price',
    'a > b > c > d > e',
  ])('accepts %s', (selector) => expect(validSpotSelector(selector)).toBe(true));

  it.each([
    ['empty', ''],
    ['too long', 'div.' + 'a'.repeat(300)],
    ['six levels', 'a > b > c > d > e > f'],
    ['six levels by descendant', 'a b c d e f'],
    ['a quote that breaks out', 'a[title="x"] , script'],
    ['single quotes', "a[href='x']"],
    ['an unterminated quote', 'a[title="x]'],
    ['javascript:', 'a[href*="javascript:alert"]'],
    ['a selector list', 'a,b'],
    ['a pseudo class', 'a:hover'],
    ['an escape', 'a\\:b'],
    ['markup', 'a<b'],
    ['a dangling combinator', 'div >'],
    ['a sibling combinator', 'a + b'],
    ['leading space', ' div'],
    ['not a string', 42],
  ])('rejects %s', (_, selector) => expect(validSpotSelector(selector)).toBe(false));
});

describe('spots and placements', () => {
  it('keeps a valid spot and normalises its label', () => {
    expect(parseSpot({ ...spot, label: '  Add   to cart ' })).toEqual(spot);
    expect(parseSpot({ ...spot, label: 'أضف للسلة' })?.label).toBe('أضف للسلة');
  });
  it.each([
    { ...spot, position: 'inside' },
    { ...spot, label: 'x'.repeat(61) },
    { ...spot, label: '<img>' },
    { ...spot, pathHint: 'https://evil.example/' },
    { ...spot, pathHint: '//evil.example' },
    { ...spot, pathHint: '/products/dress?x=1' },
    { ...spot, pathHint: '/a b' },
    { ...spot, selector: 'a:hover' },
  ])('rejects spot %#', (value) => expect(parseSpot(value)).toBeNull());

  it('requires a spot for spot placement and keeps a saved one under other modes', () => {
    expect(parsePlacement({ placement: 'spot' })).toBeNull();
    expect(parsePlacement({ placement: 'auto', spot })).toEqual({ placement: 'auto', spot });
    expect(parsePlacement({ placement: 'floating', spot: null })).toEqual({ placement: 'floating' });
    expect(parsePlacement({ placement: 'sideways' })).toBeNull();
    expect(parsePlacement({ placement: 'auto', spot: { selector: 'a:hover' } })).toBeNull();
  });

  it('gives storefronts the selector and position only, and only while the spot is in use', () => {
    expect(publicPlacement({ placement: 'spot', spot: spot as never })).toEqual({ placement: 'spot', spot: { selector: spot.selector, position: 'after' } });
    expect(publicPlacement({ placement: 'auto', spot: spot as never })).toEqual({ placement: 'auto' });
    expect(publicPlacement({ placement: 'floating' })).toEqual({ placement: 'floating' });
  });
});
