import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { LandingLocaleProvider } from '@/components/landing/landing-locale';
import { PricingPageContent } from '@/components/pricing/pricing-page-content';
import { getRequestLocale } from '@/lib/auth/locale';
import { CURRENCY_COOKIE, plansForCurrency, resolveCurrency } from '@/lib/pricing/currency';
import { clientIpFromHeader, countryFromIp } from '@/lib/pricing/geo';
import { listPublicPlanCatalog } from '@/lib/try-on/public-catalog';

export const metadata: Metadata = {
  title: 'GrindCTRL AI Try-On Pricing',
  description:
    'Compare GrindCTRL AI Try-On plans, monthly render credits, premium setup, and top-up packs for Shopify stores.',
};

export default async function PricingPage() {
  const [cookieStore, headerList, catalog] = await Promise.all([
    cookies(),
    headers(),
    listPublicPlanCatalog(),
  ]);

  /* Same central resolver as every other page, so the pricing page adapts to
     the browser's language on a first visit instead of defaulting to English. */
  const initialLocale = await getRequestLocale();

  /* Currency is resolved on the server because the price has to be right in the
     first paint — a page that renders USD and then swaps to EGP is worse than
     one that guesses once. Detection is inert until the GeoLite2 database is
     supplied (see lib/pricing/geo.ts), and returns null until then, so this
     resolves to USD unless the visitor has chosen otherwise. */
  const country = await countryFromIp(
    clientIpFromHeader(headerList.get('x-forwarded-for')),
  );
  const currency = resolveCurrency({
    cookie: cookieStore.get(CURRENCY_COOKIE)?.value ?? null,
    country,
  });

  /* plansForCurrency falls back to the USD rows when the active currency has
     none, which is the state until EGP rows are added. Filtering without that
     fallback would render an Egyptian visitor a pricing page with no plans. */
  const catalogInCurrency = {
    plans: plansForCurrency(catalog.plans, currency),
    packs: plansForCurrency(catalog.packs, currency),
  };

  return (
    <LandingLocaleProvider
      initialLocale={initialLocale}
      className="gc-landing-root gc-animated min-h-dvh overflow-x-hidden bg-background text-foreground"
    >
      <PricingPageContent catalog={catalogInCurrency} currency={currency} />
    </LandingLocaleProvider>
  );
}
