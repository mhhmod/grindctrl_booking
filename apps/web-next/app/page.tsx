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
import { listPublicPlanCatalog } from '@/lib/try-on/public-catalog';

export const metadata: Metadata = {
  title: 'GRINDCTRL | AI systems for online stores',
  description:
    'Managed AI for online stores, starting with virtual try-on for Shopify and extending to support, lead capture, and operations automation, in English and Arabic.',
};

export default async function LandingPage() {
  const [cookieStore, catalog] = await Promise.all([
    cookies(),
    listPublicPlanCatalog(),
  ]);
  const cookieLocale = cookieStore.get(SITE_LOCALE_COOKIE)?.value;
  const initialLocale: SiteLocale = isSiteLocale(cookieLocale) ? cookieLocale : DEFAULT_SITE_LOCALE;

  return (
    <LandingLocaleProvider
      initialLocale={initialLocale}
      className="gc-landing-root gc-animated min-h-dvh overflow-x-hidden bg-background text-foreground"
    >
      <SiteLanding plans={catalog.plans} />
    </LandingLocaleProvider>
  );
}
