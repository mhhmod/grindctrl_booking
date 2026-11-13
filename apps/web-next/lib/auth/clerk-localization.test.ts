import { describe, expect, it } from 'vitest';
import { arSA, enUS } from '@clerk/localizations';
import { clerkLocalization } from './clerk-localization';

/* Item 4: Google first, said as an action in both languages. */
describe('clerkLocalization', () => {
  it('says "Continue with Google" as an action in both languages', () => {
    expect(clerkLocalization('en').socialButtonsBlockButton).toBe('Continue with {{provider|titleize}}');
    expect(clerkLocalization('ar').socialButtonsBlockButton).toBe('المتابعة باستخدام {{provider|titleize}}');
  });

  it('keeps the rest of Clerk’s own copy for each language', () => {
    expect(clerkLocalization('ar').signUp).toBe(arSA.signUp);
    expect(clerkLocalization('en').signIn).toBe(enUS.signIn);
    expect(clerkLocalization('ar').locale).toBe(arSA.locale);
  });
});
