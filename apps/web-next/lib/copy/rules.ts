/* Copy rules the v16 boards rely on (phase zero item 32): no em dashes in
   any string a person can read, and Western digits in Arabic, the way the
   values beside the labels are already written. copy-scan.test.ts checks
   every shipped string against these in CI. */

import type { SiteLocale } from '@/lib/landing/landing-i18n';

// Built from code points, so the scan of this file finds no example of either.
const EM_DASH = String.fromCharCode(0x2014);
const ARABIC_LETTER = /[؀-ۿ]/;
const EASTERN_DIGIT = /[٠-٩۰-۹]/g;

export type CopyProblem = 'em_dash' | 'eastern_digits';

export function copyProblems(text: string): CopyProblem[] {
  const problems: CopyProblem[] = [];
  if (text.includes(EM_DASH)) problems.push('em_dash');
  if (ARABIC_LETTER.test(text) && new RegExp(EASTERN_DIGIT.source).test(text)) problems.push('eastern_digits');
  return problems;
}

/** Arabic-Indic and Persian digits as 0 to 9. */
export function toWesternDigits(text: string): string {
  return text.replace(EASTERN_DIGIT, (digit) => {
    const code = digit.charCodeAt(0);
    return String(code - (code >= 0x06f0 ? 0x06f0 : 0x0660));
  });
}

/** The locale to hand Intl for dates and numbers, so Arabic keeps Western
 *  digits whatever the browser's own locale is. */
export function intlLocale(locale: SiteLocale): string {
  return locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US';
}
