import { describe, expect, it } from 'vitest';
import { getPanelCopy } from '../i18n';
import { v16StatusLine } from './status-line';
import { parsePageProduct } from './page-product';

const en = getPanelCopy('en');
const ar = getPanelCopy('ar');
const open = { open: true, opensAt: null, closesAt: '22:00' };
const closed = { open: false, opensAt: '10:00', closesAt: null };

describe('the v16 header status (Chat-Home)', () => {
  it('names both halves while the assistant answers and the team is in', () => {
    expect(v16StatusLine({ aiEnabled: true, available: true, afterHours: false, team: open }, en, 'en')).toEqual({
      text: 'Assistant answers now · team here until 10 pm',
      live: true,
    });
  });

  it('keeps the assistant half after hours only when it really answers (N23)', () => {
    expect(v16StatusLine({ aiEnabled: true, available: false, afterHours: true, team: closed }, en, 'en')).toEqual({
      text: 'Assistant answers now · team away until 10 am',
      live: true,
    });
    expect(v16StatusLine({ aiEnabled: true, available: false, afterHours: false, team: closed }, en, 'en')).toEqual({
      text: 'Team away until 10 am',
      live: false,
    });
  });

  it('shows only the team half when the assistant is off, lit while the team is in', () => {
    expect(v16StatusLine({ aiEnabled: false, available: true, afterHours: false, team: open }, en, 'en')).toEqual({
      text: 'Team here until 10 pm',
      live: true,
    });
  });

  it('speaks Arabic with Western digits', () => {
    const line = v16StatusLine({ aiEnabled: true, available: true, afterHours: false, team: open }, ar, 'ar');
    expect(line.text.startsWith(ar.assistantNow)).toBe(true);
    expect(line.text).toMatch(/10/);
    expect(line.text).not.toMatch(/[٠-٩]/);
  });
});

describe("the piece on the page (You're viewing)", () => {
  it('keeps what the loader sends, field by field', () => {
    expect(
      parsePageProduct({
        handle: 'layla-abaya',
        title: 'Layla Embroidered Abaya',
        imageUrl: 'https://cdn.shopify.com/s/files/layla.jpg',
        variantId: '456',
        variantTitle: 'Black / M',
        priceMinor: 325000,
        currency: 'EGP',
        tryOn: true,
      }),
    ).toEqual({
      handle: 'layla-abaya',
      title: 'Layla Embroidered Abaya',
      imageUrl: 'https://cdn.shopify.com/s/files/layla.jpg',
      variantId: '456',
      variantTitle: 'Black / M',
      priceMinor: 325000,
      currency: 'EGP',
      tryOn: true,
    });
  });

  it('drops what it cannot trust', () => {
    expect(parsePageProduct(null)).toBeNull();
    expect(parsePageProduct({ handle: 'x', title: 'X', variantId: 'abc' })).toBeNull();
    expect(
      parsePageProduct({ handle: 'x', title: 'X', variantId: '1', imageUrl: 'javascript:alert(1)', priceMinor: -5, currency: 'egp', tryOn: 'yes' }),
    ).toMatchObject({ imageUrl: '', priceMinor: null, currency: null, tryOn: false });
  });
});
