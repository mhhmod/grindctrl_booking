import 'server-only';

import { cookies, headers } from 'next/headers';
import { localeFromAcceptLanguage } from '@/lib/landing/accept-language';
import {
  DEFAULT_SITE_LOCALE,
  isSiteLocale,
  SITE_LOCALE_COOKIE,
  type SiteLocale,
} from '@/lib/landing/landing-i18n';

/* The single place the visitor's language is decided, for every server-rendered
   page. Precedence, highest first:

     1. The gc-locale cookie — an explicit choice, and it must never be
        second-guessed. Someone who switched to English on an Arabic phone
        meant it.
     2. The Accept-Language header — what the browser says they read. This is
        what makes the site adapt on a first visit instead of defaulting
        everyone to English.
     3. DEFAULT_SITE_LOCALE.

   Detection is deliberately not the top of the list. Auto-switching with no way
   back strands anyone whose browser language differs from their reading
   preference, which is common for developers and for bilingual users. */
export async function getRequestLocale(): Promise<SiteLocale> {
  const [cookieStore, headerList] = await Promise.all([cookies(), headers()]);

  const cookieLocale = cookieStore.get(SITE_LOCALE_COOKIE)?.value;
  if (isSiteLocale(cookieLocale)) return cookieLocale;

  return (
    localeFromAcceptLanguage(headerList.get('accept-language')) ?? DEFAULT_SITE_LOCALE
  );
}
