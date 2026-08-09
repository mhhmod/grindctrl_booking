import { describe, expect, it } from 'vitest';
import { getPricingCopy } from '@/components/pricing/pricing-copy';
import { getLandingDictionary } from '@/lib/landing/landing-i18n';

describe('Arabic landing dictionary', () => {
  /* pricingPlanNames is typed Record<string, string>, so an English value
     satisfies the type perfectly. That is exactly how 'Free', 'Launch' and
     'Done-for-you' sat in the Arabic dictionary unnoticed — the compiler could
     never have caught it. A content assertion is the only thing that can. */
  it('names the plans in Arabic, not English', () => {
    const ar = getLandingDictionary('ar');

    for (const [key, name] of Object.entries(ar.pricingPlanNames)) {
      expect(name, `plan ${key} is still Latin: ${name}`).not.toMatch(/[A-Za-z]/);
    }
  });

  it('names the same plans in both languages', () => {
    const en = getLandingDictionary('en');
    const ar = getLandingDictionary('ar');

    expect(Object.keys(ar.pricingPlanNames).sort()).toEqual(
      Object.keys(en.pricingPlanNames).sort(),
    );
  });

  it('keeps the English names in English', () => {
    const en = getLandingDictionary('en');

    expect(en.pricingPlanNames['free-v1']).toBe('Free');
    expect(en.pricingPlanNames['launch-v1']).toBe('Launch');
    expect(en.pricingPlanNames['dfy-v1']).toBe('Done-for-you');
  });
});

/* Two copy sources name the same three plans: this dictionary feeds the pricing
   section on the home page, pricing-copy.ts feeds the /pricing page. They were
   already out of step once — landing had English while pricing had Arabic — and
   fixing that by hand introduced a second Arabic name for one plan.

   One plan with two names is worse than one plan in the wrong language, because
   nobody notices it. This is the guard. */
describe('the two plan-name sources agree', () => {
  for (const locale of ['en', 'ar'] as const) {
    it(`names every plan identically in ${locale}`, () => {
      const landing = getLandingDictionary(locale).pricingPlanNames;
      const pricing = getPricingCopy(locale).plans;

      for (const key of Object.keys(landing)) {
        expect(
          pricing[key]?.name,
          `plan ${key} is "${landing[key]}" on the home page but "${pricing[key]?.name}" on /pricing`,
        ).toBe(landing[key]);
      }
    });
  }
});
