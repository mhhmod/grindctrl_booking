import { describe, expect, it } from 'vitest';
import { plansForCurrency, resolveCurrency } from '@/lib/pricing/currency';

describe('resolveCurrency', () => {
  it('honours an explicit cookie over the detected country', () => {
    expect(resolveCurrency({ cookie: 'USD', country: 'EG' })).toBe('USD');
    expect(resolveCurrency({ cookie: 'EGP', country: 'US' })).toBe('EGP');
  });

  it('uses EGP for Egypt when no cookie is set', () => {
    expect(resolveCurrency({ cookie: null, country: 'EG' })).toBe('EGP');
  });

  it('uses USD for every other country', () => {
    expect(resolveCurrency({ cookie: null, country: 'US' })).toBe('USD');
    /* Arabic is not Egypt. A Saudi visitor reads the same Arabic page and must
       not be quoted in a currency they do not use. */
    expect(resolveCurrency({ cookie: null, country: 'SA' })).toBe('USD');
  });

  /* Every failure path lands on USD. A pricing page showing a currency the
     visitor did not expect is a bad guess; one that throws is an outage. */
  it('falls back to USD when nothing is known', () => {
    expect(resolveCurrency({ cookie: null, country: null })).toBe('USD');
  });

  it('ignores an unrecognised cookie rather than trusting it', () => {
    expect(resolveCurrency({ cookie: 'BTC', country: 'EG' })).toBe('EGP');
    expect(resolveCurrency({ cookie: '', country: null })).toBe('USD');
  });

  it('is case-insensitive about the country code', () => {
    expect(resolveCurrency({ cookie: null, country: 'eg' })).toBe('EGP');
  });
});

/* Mirrors production: one free plan, no EGP twin. The database enforces that
   with tryon_plans_one_active_free — an attempt to insert a second active free
   plan is rejected, which is how this rule was discovered. */
const ROWS = [
  { planKey: 'free-v1', currency: 'USD', isFree: true },
  { planKey: 'launch-v1', currency: 'USD', isFree: false },
  { planKey: 'dfy-v1', currency: 'USD', isFree: false },
  { planKey: 'launch-v1-egp', currency: 'EGP', isFree: false },
  { planKey: 'dfy-v1-egp', currency: 'EGP', isFree: false },
];

describe('plansForCurrency', () => {
  it('returns the paid rows in the active currency', () => {
    expect(plansForCurrency(ROWS, 'EGP').map((r) => r.planKey)).toEqual([
      'free-v1',
      'launch-v1-egp',
      'dfy-v1-egp',
    ]);
  });

  /* Zero costs the same in every currency, and there is only ever one free row.
     Dropping it by currency would leave the EGP page with no free tier. */
  it('keeps the free plan whatever currency is active', () => {
    expect(plansForCurrency(ROWS, 'EGP').map((r) => r.planKey)).toContain('free-v1');
    expect(plansForCurrency(ROWS, 'USD').map((r) => r.planKey)).toContain('free-v1');
  });

  it('never mixes paid currencies in one list', () => {
    const paid = plansForCurrency(ROWS, 'USD').filter((r) => !r.isFree);
    expect(new Set(paid.map((r) => r.currency))).toEqual(new Set(['USD']));
  });

  it('falls back to USD when the active currency has no paid rows', () => {
    const usdOnly = ROWS.filter((r) => r.currency === 'USD');

    expect(plansForCurrency(usdOnly, 'EGP').map((r) => r.planKey)).toEqual([
      'free-v1',
      'launch-v1',
      'dfy-v1',
    ]);
  });

  /* Packs carry no isFree field at all; undefined must read as paid. */
  it('treats rows without an isFree field as paid', () => {
    const packs = [
      { packKey: 'pack-lite-v1', currency: 'USD' },
      { packKey: 'pack-lite-v1-egp', currency: 'EGP' },
    ];

    expect(plansForCurrency(packs, 'EGP').map((p) => p.packKey)).toEqual([
      'pack-lite-v1-egp',
    ]);
  });

  it('returns nothing when there is nothing to return', () => {
    expect(plansForCurrency([], 'USD')).toEqual([]);
  });
});
