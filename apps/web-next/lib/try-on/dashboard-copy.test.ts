import { describe, expect, it } from 'vitest';
import {
  getTryOnDashboardCopy,
  planStatusLabel,
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
     dictionary. Latin letters here mean somebody pasted the English value.

     Some entries are functions, because Arabic and English put an interpolated
     value in different places in the sentence. Those are called with numbers
     for every parameter, so anything Latin in the result came from the
     sentence frame — which is the part being guarded — and not from the
     caller's data. */
  const LATIN_ALLOWED = new Set<keyof TryOnDashboardCopy>(['paymentReferencePlaceholder']);

  it('has no Latin letters anywhere in the Arabic dictionary', () => {
    for (const [key, value] of Object.entries(getTryOnDashboardCopy('ar'))) {
      if (LATIN_ALLOWED.has(key as keyof TryOnDashboardCopy)) continue;
      const rendered =
        typeof value === 'function'
          ? (value as (...args: number[]) => string)(
              ...Array.from({ length: value.length }, (_, i) => i + 1),
            )
          : (value as string);
      expect(rendered, `Latin text in Arabic copy at ${key}: ${rendered}`).not.toMatch(/[A-Za-z]/);
    }
  });

  /* The one allowed exception, kept narrow: Instapay is a product name, so it
     stays Latin, but nothing else in that example may. */
  it('allows only the brand name in the Arabic payment reference example', () => {
    const example = getTryOnDashboardCopy('ar').paymentReferencePlaceholder;
    expect(example).toContain('Instapay');
    expect(example.replace('Instapay', '')).not.toMatch(/[A-Za-z]/);
  });

  /* Arabic agrees a noun with its count in five different ways, so a day
     count assembled as `${n} days` is wrong for most values of n. */
  it('counts days correctly in Arabic', () => {
    const ar = getTryOnDashboardCopy('ar');
    expect(ar.bannerRenewalDue(1)).toContain('يوم واحد');
    expect(ar.bannerRenewalDue(2)).toContain('يومين');
    expect(ar.bannerRenewalDue(5)).toContain('5 أيام');
    expect(ar.bannerRenewalDue(15)).toContain('15 يوماً');
    /* Reachable, not theoretical: daysRemaining is clamped at 0 and a
       subscription on its final day still routes to a day-count banner.
       'يوماً' contains 'يوم', so the bare form has to be asserted by
       excluding the suffixed one. */
    expect(ar.bannerRenewalDue(0)).toContain('0 يوم');
    expect(ar.bannerRenewalDue(0)).not.toContain('يوماً');
    expect(ar.bannerRenewalDue(100)).toContain('100 يوم');
    expect(ar.bannerRenewalDue(100)).not.toContain('يوماً');
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

/* The plan badge prints tryon_subscriptions.status raw, the same expression
   shape statusLabel guards for shops and jobs. A different enum, so a
   different mapping, and the same reason it cannot be caught by a source
   scan. */
describe('planStatusLabel', () => {
  const known = ['active', 'grace', 'expired', 'cancelled', 'none'];

  it('translates every subscription status in both languages', () => {
    const en = getTryOnDashboardCopy('en');
    const ar = getTryOnDashboardCopy('ar');
    for (const status of known) {
      expect(planStatusLabel(en, status), `English ${status}`).not.toBe(status);
      expect(planStatusLabel(ar, status), `Arabic ${status}`).not.toMatch(/[A-Za-z]/);
    }
  });

  it('falls back to the raw value for an unknown status', () => {
    expect(planStatusLabel(getTryOnDashboardCopy('ar'), 'paused')).toBe('paused');
  });
});
