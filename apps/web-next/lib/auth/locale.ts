import 'server-only';

import { cookies } from 'next/headers';
import {
  DEFAULT_SITE_LOCALE,
  isSiteLocale,
  SITE_LOCALE_COOKIE,
  type SiteLocale,
} from '@/lib/landing/landing-i18n';

/* One place to resolve the visitor's language for server-rendered pages that
   are not the landing page. Same cookie as the landing and pricing pages, so
   a choice made there carries into sign-in, sign-up, and onboarding. */
export async function getRequestLocale(): Promise<SiteLocale> {
  const cookieStore = await cookies();
  const value = cookieStore.get(SITE_LOCALE_COOKIE)?.value;
  return isSiteLocale(value) ? value : DEFAULT_SITE_LOCALE;
}
