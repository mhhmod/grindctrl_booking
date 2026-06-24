import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { LandingLocaleProvider } from '@/components/landing/landing-locale';
import { SiteLanding } from '@/components/landing/site-landing';
import {
  DEFAULT_SITE_LOCALE,
  isSiteLocale,
  SITE_LOCALE_COOKIE,
  type SiteLocale,
} from '@/lib/landing/landing-i18n';

export const metadata: Metadata = {
  title: 'GRINDCTRL — Done-for-you AI automation',
  description:
    'GrindCTRL builds, runs, and maintains your AI automations across support, leads, files, and voice, while you control everything from one dashboard.',
};

export default async function LandingPage() {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(SITE_LOCALE_COOKIE)?.value;
  const initialLocale: SiteLocale = isSiteLocale(cookieLocale) ? cookieLocale : DEFAULT_SITE_LOCALE;

  return (
    <LandingLocaleProvider
      initialLocale={initialLocale}
      className="gc-landing-root gc-animated min-h-dvh overflow-x-hidden bg-background text-foreground"
    >
      <SiteLanding />
    </LandingLocaleProvider>
  );
}
