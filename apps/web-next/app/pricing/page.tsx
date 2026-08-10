import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { LandingLocaleProvider } from '@/components/landing/landing-locale';
import { PricingPageContent } from '@/components/pricing/pricing-page-content';
import { getRequestLocale } from '@/lib/auth/locale';
import { regionFromAcceptLanguage } from '@/lib/landing/accept-language';
import { CURRENCY_COOKIE, plansForCurrency, resolveCurrency } from '@/lib/pricing/currency';
import { clientIpFromHeader, countryFromIp, countryFromIpApi } from '@/lib/pricing/geo';
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
     one that guesses once.

     Two country signals, strongest first. The IP lookup is accurate but inert
     until the GeoLite2 database is on the server (see lib/pricing/geo.ts). The
     region subtag of Accept-Language — the EG in ar-EG — is weaker, because it
     describes how the device is configured rather than where it is, but it
     needs no database and works today. Without the fallback, currency would
     not adapt at all until that file exists. */
  const clientIp = clientIpFromHeader(headerList.get('x-forwarded-for'));

  /* Local database first — it sees no third party and costs no network call.
     Remote lookup second, because most browsers send a bare "ar" or "en" with
     no region, so the header alone could not place an Egyptian visitor at all.
     Header region last, as a free hint when both are unavailable. */
  const country =
    (await countryFromIp(clientIp)) ??
    (await countryFromIpApi(clientIp)) ??
    regionFromAcceptLanguage(headerList.get('accept-language'));

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
