import { DEFAULT_SITE_LOCALE, SITE_LOCALE_COOKIE, type SiteLocale } from './landing-i18n';

const SITE_LOCALE_CHANGED = 'gc:site-locale-changed';

/** Cookie remains the server/client source of truth; the event only tells
 * persistent client surfaces to read its new value after an explicit choice. */
export function readSiteLocale(fallback: SiteLocale = DEFAULT_SITE_LOCALE): SiteLocale {
  if (typeof document === 'undefined') return fallback;
  const match = document.cookie.match(new RegExp(`(?:^|; )${SITE_LOCALE_COOKIE}=([^;]*)`));
  return match?.[1] === 'ar' || match?.[1] === 'en' ? match[1] : fallback;
}

export function persistSiteLocale(locale: SiteLocale): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${SITE_LOCALE_COOKIE}=${locale};path=/;max-age=31536000;samesite=lax`;
  window.dispatchEvent(new Event(SITE_LOCALE_CHANGED));
}

export function subscribeSiteLocale(listener: () => void): () => void {
  window.addEventListener(SITE_LOCALE_CHANGED, listener);
  return () => window.removeEventListener(SITE_LOCALE_CHANGED, listener);
}
