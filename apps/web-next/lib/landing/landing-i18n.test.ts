import { describe, expect, it } from 'vitest';
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
