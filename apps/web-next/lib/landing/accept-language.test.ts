import { describe, expect, it } from 'vitest';
import {
  localeFromAcceptLanguage,
  regionFromAcceptLanguage,
} from '@/lib/landing/accept-language';

describe('localeFromAcceptLanguage', () => {
  it('picks Arabic for an Arabic browser', () => {
    expect(localeFromAcceptLanguage('ar-EG,ar;q=0.9,en-US;q=0.8,en;q=0.7')).toBe('ar');
  });

  it('picks English for an English browser', () => {
    expect(localeFromAcceptLanguage('en-US,en;q=0.9')).toBe('en');
  });

  /* Quality values, not document order, decide preference. A browser listing
     en first with a lower q genuinely prefers Arabic. */
  it('respects q-values over ordering', () => {
    expect(localeFromAcceptLanguage('en;q=0.5,ar;q=0.9')).toBe('ar');
  });

  it('treats a tag with no q as q=1', () => {
    expect(localeFromAcceptLanguage('ar,en;q=0.9')).toBe('ar');
    expect(localeFromAcceptLanguage('en,ar;q=0.9')).toBe('en');
  });

  it('matches on the primary subtag, so any Arabic region counts', () => {
    expect(localeFromAcceptLanguage('ar-SA')).toBe('ar');
    expect(localeFromAcceptLanguage('ar-MA')).toBe('ar');
  });

  /* Returning null rather than guessing lets the caller fall back to its own
     default. A French speaker should get the default, not whichever of our two
     languages happens to sort first. */
  it('returns null when no supported language is offered', () => {
    expect(localeFromAcceptLanguage('fr-FR,fr;q=0.9,de;q=0.8')).toBeNull();
  });

  it('skips unsupported languages to find a supported one', () => {
    expect(localeFromAcceptLanguage('fr-FR,ar;q=0.8')).toBe('ar');
  });

  it('returns null for a missing, empty or wildcard header', () => {
    expect(localeFromAcceptLanguage(null)).toBeNull();
    expect(localeFromAcceptLanguage('')).toBeNull();
    expect(localeFromAcceptLanguage('   ')).toBeNull();
    expect(localeFromAcceptLanguage('*')).toBeNull();
  });

  it('does not throw on malformed input', () => {
    expect(localeFromAcceptLanguage(';;;')).toBeNull();
    expect(localeFromAcceptLanguage('ar;q=notanumber')).toBe('ar');
    expect(localeFromAcceptLanguage('ar;q=')).toBe('ar');
  });
});

/* A weaker country signal than a GeoIP lookup, but one that needs no database,
   no account and no network call — and it is the only signal available until
   the GeoLite2 file is on the server. */
describe('regionFromAcceptLanguage', () => {
  it('reads the region subtag', () => {
    expect(regionFromAcceptLanguage('ar-EG,ar;q=0.9')).toBe('EG');
    expect(regionFromAcceptLanguage('en-US,en;q=0.9')).toBe('US');
  });

  it('uppercases the region regardless of how it was sent', () => {
    expect(regionFromAcceptLanguage('ar-eg')).toBe('EG');
  });

  it('takes the region from the highest-ranked tag that has one', () => {
    /* ar has no region and outranks ar-EG, but a preference without a country
       tells us nothing about currency, so keep looking. */
    expect(regionFromAcceptLanguage('ar,ar-EG;q=0.9,en-US;q=0.8')).toBe('EG');
  });

  it('returns null when no tag carries a region', () => {
    expect(regionFromAcceptLanguage('ar,en')).toBeNull();
    expect(regionFromAcceptLanguage(null)).toBeNull();
    expect(regionFromAcceptLanguage('')).toBeNull();
  });

  /* Script subtags are four letters and are not countries. */
  it('ignores script subtags', () => {
    expect(regionFromAcceptLanguage('zh-Hans')).toBeNull();
    expect(regionFromAcceptLanguage('zh-Hans-CN')).toBe('CN');
  });
});
