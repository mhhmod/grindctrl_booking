import { describe, expect, it } from 'vitest';
import { localeFromAcceptLanguage } from '@/lib/landing/accept-language';

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
