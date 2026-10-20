import { describe, expect, it } from 'vitest';
import { copyProblems } from '@/lib/copy/rules';
import { DEFAULT_ADDRESS_FORM, getSheetCopy, isArabicAddressForm, type SheetCopy } from './sheet-copy';

/* The sheet's copy (02-try-on.md) in English and in each Arabic address
   form a store can choose (N26). */
const FORMS = ['women', 'men', 'everyone'] as const;

function strings(copy: SheetCopy): string[] {
  const { variantLine, photoTime, privacyBody, ...lines } = copy;
  return [variantLine('Black · M'), photoTime(5), photoTime(20), ...privacyBody, ...Object.values(lines)];
}

describe('the try-on sheet copy', () => {
  it('speaks to everyone until a store chooses', () => {
    expect(DEFAULT_ADDRESS_FORM).toBe('everyone');
    expect(getSheetCopy('ar')).toBe(getSheetCopy('ar', 'everyone'));
    expect(isArabicAddressForm('women')).toBe(true);
    expect(isArabicAddressForm('ladies')).toBe(false);
  });

  it.each(FORMS)('keeps the Arabic %s form in that form', (form) => {
    const copy = getSheetCopy('ar', form);
    const text = strings(copy).join(' ');
    // The feminine pronoun and imperative endings belong to the women form only.
    if (form === 'women') expect(text).toContain('كِ');
    else expect(text).not.toContain('كِ');
    if (form === 'women') expect(copy.agreeAndTry).toBe('وافقي وجربيها عليكِ');
    if (form === 'men') expect(copy.agreeAndTry).toBe('وافق وجربها عليك');
    if (form === 'everyone') expect(copy.agreeAndTry).toBe('موافقة وتجربة القطعة');
  });

  it.each([getSheetCopy('en'), ...FORMS.map((form) => getSheetCopy('ar', form))])(
    'has no em dash or Eastern digit (%#)',
    (copy) => {
      for (const text of strings(copy)) expect(copyProblems(text), text).toEqual([]);
    },
  );

  it('counts seconds the way Arabic does', () => {
    const ar = getSheetCopy('ar');
    expect(ar.photoTime(5)).toBe('يستغرق الأمر حوالي 5 ثوانٍ.');
    expect(ar.photoTime(10)).toBe('يستغرق الأمر حوالي 10 ثوانٍ.');
    expect(ar.photoTime(20)).toBe('يستغرق الأمر حوالي 20 ثانية.');
    expect(getSheetCopy('en').photoTime(20)).toBe('It takes about 20 seconds.');
  });

  it('gives every form every line', () => {
    const keys = Object.keys(getSheetCopy('en')).sort();
    for (const form of FORMS) expect(Object.keys(getSheetCopy('ar', form)).sort()).toEqual(keys);
  });
});
