import { describe, expect, it } from 'vitest';
import { copyProblems } from '@/lib/copy/rules';
import { DEFAULT_ADDRESS_FORM, getSheetCopy, isArabicAddressForm, type SheetCopy } from './sheet-copy';

/* The sheet's copy (02-try-on.md) in English and in each Arabic address
   form a store can choose (N26). */
const FORMS = ['women', 'men', 'everyone'] as const;

function strings(copy: SheetCopy): string[] {
  const { variantLine, photoTime, secondsLeft, privacyBody, makingSteps, lookAlt, addToCart, soldOutOption, inAppNote, linkCopied, readyIn, ...lines } = copy;
  return [
    inAppNote('Instagram'),
    linkCopied('TikTok'),
    ...[1, 2, 7, 14].map(readyIn),
    variantLine('Black · M'),
    lookAlt('Layla Embroidered Abaya'),
    addToCart('Black, M'),
    addToCart(''),
    soldOutOption('L'),
    ...[5, 20].map(photoTime),
    ...[1, 2, 7, 12].map(secondsLeft),
    ...privacyBody,
    ...makingSteps,
    ...Object.values(lines),
  ];
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
    expect([1, 2, 7, 12].map(ar.secondsLeft)).toEqual([
      'تبقّت ثانية واحدة تقريباً',
      'تبقّت ثانيتان تقريباً',
      'تبقّت 7 ثوانٍ تقريباً',
      'تبقّت 12 ثانية تقريباً',
    ]);
    expect([1, 12].map(getSheetCopy('en').secondsLeft)).toEqual(['About 1 second left', 'About 12 seconds left']);
    expect([2, 7, 14].map(getSheetCopy('ar', 'women').readyIn)).toEqual([
      'إطلالتكِ جاهزة، جُهّزت في ثانيتين',
      'إطلالتكِ جاهزة، جُهّزت في 7 ثوانٍ',
      'إطلالتكِ جاهزة، جُهّزت في 14 ثانية',
    ]);
    expect(getSheetCopy('en').readyIn(14)).toBe('Your look is ready, made in 14 seconds');
  });

  it('gives every form every line', () => {
    const keys = Object.keys(getSheetCopy('en')).sort();
    for (const form of FORMS) expect(Object.keys(getSheetCopy('ar', form)).sort()).toEqual(keys);
  });
});
