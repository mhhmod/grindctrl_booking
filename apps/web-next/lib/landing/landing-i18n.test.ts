import { describe, expect, it } from 'vitest';
import { getLandingDictionary } from '@/lib/landing/landing-i18n';

/* The v15 landing moved its own copy into components/landing/story
   (story-strings.ts, covered by landing-story.test.tsx). What stays here is
   the site chrome every marketing page shares: header, phone menu, footer
   and the store password chip. The old hero, demo, proof and pricing-teaser
   keys went with the sections that used them, and so did their tests: the
   plan-name agreement check guarded a home-page pricing section that no
   longer exists, and /pricing keeps its own plan-name tests. The managed
   service guard moved with the hero (see landing-story.test.tsx) and is
   kept here for the chrome too. */

const en = getLandingDictionary('en');
const ar = getLandingDictionary('ar');

describe('landing dictionary', () => {
  it('has the same keys in both languages', () => {
    expect(Object.keys(ar).sort()).toEqual(Object.keys(en).sort());
  });

  it('labels the header, phone menu and footer in Arabic, not English', () => {
    const chrome = [
      'siteMainNav',
      'siteOpenMenu',
      'navTryOn',
      'navLiveStore',
      'navAiOps',
      'navProduct',
      'navResults',
      'navHowItWorks',
      'navPricing',
      'menuTheProduct',
      'menuAskStore',
      'signIn',
      'bookCall',
      'footerNav',
      'footerProduct',
      'footerLiveStore',
      'footerTryOnPage',
      'passwordLabel',
      'passwordCopy',
      'passwordCopied',
      'passwordCopyAria',
      'passwordCopiedAria',
    ] as const;
    for (const key of chrome) {
      expect(ar[key], `${key} is still Latin in Arabic: ${ar[key]}`).not.toMatch(/[A-Za-z]/);
      expect(en[key], `${key} is empty in English`).toBeTruthy();
    }
  });

  it.each([
    ['en', en],
    ['ar', ar],
  ] as const)('makes no approval-gated managed-service promise in the %s chrome', (_locale, dict) => {
    const text = JSON.stringify(dict);
    expect(text).not.toMatch(/Managed setup|set it up and keep it running|Done-for-you|نجهّز كل شيء ونبقيه يعمل|إعداد متكامل ننفّذه لك/i);
  });
});
