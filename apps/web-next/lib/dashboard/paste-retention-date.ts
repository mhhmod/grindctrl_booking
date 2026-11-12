import type { SiteLocale } from '@/lib/landing/landing-i18n';

/** Dashboard language, Gregorian dates and Latin digits in both directions.
 * UTC keeps the server and client on the same displayed calendar day. */
export function pasteRetentionDate(iso: string | null | undefined, locale: SiteLocale): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale, {
    calendar: 'gregory', numberingSystem: 'latn', timeZone: 'UTC',
    year: 'numeric', month: 'long', day: 'numeric',
  }).format(date);
}
