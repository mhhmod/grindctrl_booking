import { describe, expect, it } from 'vitest';
import {
  getTryOnDashboardCopy,
  statusLabel,
  type TryOnDashboardCopy,
} from '@/lib/try-on/dashboard-copy';

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

/* A unit glued to a number reads as part of the value, not as copy, so it
   survives review and never reaches a dictionary on its own. The suffix has
   to live in the dictionary for the no-Latin sweep above to see it at all;
   this asserts the specific case directly. */
describe('units glued to numbers', () => {
  it('gives the seconds suffix a non-Latin form in Arabic', () => {
    expect(getTryOnDashboardCopy('ar').secondsSuffix).not.toMatch(/[A-Za-z]/);
    expect(getTryOnDashboardCopy('en').secondsSuffix).toBe('s');
  });
});

/* Status badges print a database value. The source scan that guards the page
   cannot catch these — they are expressions, not literals — so the mapping is
   only as good as this test. */
describe('statusLabel', () => {
  /* tryon_shops.status: the TryOnShopStatus union. tryon_jobs.status: the
     values its CHECK constraint permits, plus the declared-but-rejected
     'queued'. */
  const known = ['installed', 'uninstalled', 'queued', 'processing', 'completed', 'failed'];

  it('translates every known status in both languages', () => {
    const en = getTryOnDashboardCopy('en');
    const ar = getTryOnDashboardCopy('ar');
    for (const status of known) {
      expect(statusLabel(en, status), `English ${status}`).not.toBe(status);
      expect(statusLabel(ar, status), `Arabic ${status}`).not.toMatch(/[A-Za-z]/);
    }
  });

  it('maps a shop state and a job state to the expected words', () => {
    expect(statusLabel(getTryOnDashboardCopy('en'), 'installed')).toBe('Installed');
    expect(statusLabel(getTryOnDashboardCopy('ar'), 'installed')).toBe('مثبَّت');
    expect(statusLabel(getTryOnDashboardCopy('en'), 'completed')).toBe('Completed');
    expect(statusLabel(getTryOnDashboardCopy('ar'), 'completed')).toBe('مكتمل');
  });

  /* A status we have not mapped must stay readable. A blank badge hides that
     the row has a state at all. */
  it('falls back to the raw value for an unknown status', () => {
    expect(statusLabel(getTryOnDashboardCopy('ar'), 'refunded')).toBe('refunded');
    expect(statusLabel(getTryOnDashboardCopy('en'), 'refunded')).toBe('refunded');
    expect(statusLabel(getTryOnDashboardCopy('ar'), '')).toBe('');
  });
});
