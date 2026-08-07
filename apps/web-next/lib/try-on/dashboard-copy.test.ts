import { describe, expect, it } from 'vitest';
import { getTryOnDashboardCopy, type TryOnDashboardCopy } from '@/lib/try-on/dashboard-copy';

/* Types already guarantee both dictionaries satisfy the interface at build
   time. This catches the case types cannot: a dictionary assembled or spread
   at runtime that silently drops a key. */
describe('getTryOnDashboardCopy', () => {
  it('returns Arabic for ar and English for en', () => {
    expect(getTryOnDashboardCopy('ar').merchantShops).toBe('متاجر التجار');
    expect(getTryOnDashboardCopy('en').merchantShops).toBe('Merchant shops');
  });

  it('exposes the same key set in both languages', () => {
    const en = Object.keys(getTryOnDashboardCopy('en')).sort();
    const ar = Object.keys(getTryOnDashboardCopy('ar')).sort();
    expect(ar).toEqual(en);
  });

  /* The whole point of the module: no English may survive into the Arabic
     dictionary. Latin letters here mean somebody pasted the English value. */
  it('has no Latin letters anywhere in the Arabic dictionary', () => {
    const values = Object.values(getTryOnDashboardCopy('ar')) as string[];
    for (const value of values) {
      expect(value, `Latin text in Arabic copy: ${value}`).not.toMatch(/[A-Za-z]/);
    }
  });
});
