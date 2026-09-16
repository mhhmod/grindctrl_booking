import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { LandingLocaleProvider } from '@/components/landing/landing-locale';
import { RoiPageContent } from '@/components/roi/roi-page-content';
import { getRequestLocale } from '@/lib/auth/locale';
import { regionFromAcceptLanguage } from '@/lib/landing/accept-language';
import { CURRENCY_COOKIE, resolveCurrency } from '@/lib/pricing/currency';
import { clientIpFromHeader, countryFromIp, countryFromIpApi } from '@/lib/pricing/geo';

export const metadata: Metadata = {
  title: 'GrindCTRL ROI Calculator',
  description:
    'Estimate the potential revenue and gross-margin impact of GrindCTRL AI Try-On using your own store numbers. Every assumption stays visible and editable.',
};

export default async function RoiPage() {
  const [cookieStore, headerList] = await Promise.all([cookies(), headers()]);

  /* Same central resolver as every other page (see app/pricing/page.tsx). */
  const initialLocale = await getRequestLocale();

  /* Same currency resolver as /pricing. The calculator has no catalog to
     filter, only results to format, so the geo lookup is reused for its
     default guess without plansForCurrency's fallback logic. */
  const clientIp = clientIpFromHeader(headerList.get('x-forwarded-for'));
  const country =
    (await countryFromIp(clientIp)) ??
    (await countryFromIpApi(clientIp)) ??
    regionFromAcceptLanguage(headerList.get('accept-language'));

  const initialCurrency = resolveCurrency({
    cookie: cookieStore.get(CURRENCY_COOKIE)?.value ?? null,
    country,
  });

  return (
    <LandingLocaleProvider
      initialLocale={initialLocale}
      className="gc-landing-root gc-animated min-h-dvh overflow-x-hidden bg-background text-foreground"
    >
      <RoiPageContent initialCurrency={initialCurrency} />
    </LandingLocaleProvider>
  );
}
