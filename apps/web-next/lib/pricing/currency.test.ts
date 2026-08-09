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

const ROWS = [
  { planKey: 'launch-v1', currency: 'USD' },
  { planKey: 'dfy-v1', currency: 'USD' },
  { planKey: 'launch-v1-egp', currency: 'EGP' },
  { planKey: 'dfy-v1-egp', currency: 'EGP' },
];

describe('plansForCurrency', () => {
  it('returns only rows in the active currency', () => {
    expect(plansForCurrency(ROWS, 'EGP').map((r) => r.planKey)).toEqual([
      'launch-v1-egp',
      'dfy-v1-egp',
    ]);
  });

  it('never mixes currencies in one list', () => {
    const currencies = new Set(plansForCurrency(ROWS, 'USD').map((r) => r.currency));
    expect(currencies).toEqual(new Set(['USD']));
  });

  /* The state this ships in until the EGP rows exist. Without this fallback an
     Egyptian visitor would get an empty pricing page rather than a USD one. */
  it('falls back to USD rows when the active currency has none', () => {
    const usdOnly = ROWS.filter((r) => r.currency === 'USD');

    expect(plansForCurrency(usdOnly, 'EGP').map((r) => r.planKey)).toEqual([
      'launch-v1',
      'dfy-v1',
    ]);
  });

  it('returns nothing when there is nothing to return', () => {
    expect(plansForCurrency([], 'USD')).toEqual([]);
  });
});
