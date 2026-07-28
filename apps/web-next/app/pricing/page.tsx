import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { LandingLocaleProvider } from '@/components/landing/landing-locale';
import { PricingPageContent } from '@/components/pricing/pricing-page-content';
import {
  DEFAULT_SITE_LOCALE,
  isSiteLocale,
  SITE_LOCALE_COOKIE,
  type SiteLocale,
} from '@/lib/landing/landing-i18n';
import { listPublicPlanCatalog } from '@/lib/try-on/public-catalog';

export const metadata: Metadata = {
  title: 'GrindCTRL AI Try-On Pricing',
  description:
    'Compare GrindCTRL AI Try-On plans, monthly render credits, premium setup, and top-up packs for Shopify stores.',
};

export default async function PricingPage() {
  const [cookieStore, catalog] = await Promise.all([
    cookies(),
    listPublicPlanCatalog(),
  ]);
  const cookieLocale = cookieStore.get(SITE_LOCALE_COOKIE)?.value;
  const initialLocale: SiteLocale = isSiteLocale(cookieLocale)
    ? cookieLocale
    : DEFAULT_SITE_LOCALE;

  return (
    <LandingLocaleProvider
      initialLocale={initialLocale}
      className="gc-landing-root gc-animated min-h-dvh overflow-x-hidden bg-background text-foreground"
    >
      <PricingPageContent catalog={catalog} />
    </LandingLocaleProvider>
  );
}
