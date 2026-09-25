import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { TryOnLocaleProvider } from '@/components/try-on/locale-provider';
import { TryOnStudio } from '@/components/try-on/page/try-on-studio';
import { localeFromAcceptLanguage } from '@/lib/landing/accept-language';
import {
  DEFAULT_TRYON_LOCALE,
  isTryOnLocale,
  TRYON_LOCALE_COOKIE,
  type TryOnLocale,
} from '@/lib/try-on/i18n';

export const metadata: Metadata = {
  title: 'GrindCTRL Try-On: see it on you before you buy',
  description:
    'Pick a piece, add a photo and get your look. The same AI try-on runs inside a real Shopify store.',
};

export default async function TryOnPage() {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(TRYON_LOCALE_COOKIE)?.value;
  /* An explicit choice (cookie) wins; otherwise Arabic browsers get Arabic
     on first visit instead of having to find the toggle. Same q-value-ranked
     parser the rest of the site uses (lib/landing/accept-language.ts) rather
     than a local regex — the regex matched "ar" anywhere in the header, so
     "en-US,fr;q=0.9,ar;q=0.1" (English clearly preferred) landed a visitor on
     Arabic here while every other page correctly gave them English. */
  const acceptLanguage = (await headers()).get('accept-language');
  const browserLocale: TryOnLocale = localeFromAcceptLanguage(acceptLanguage) ?? DEFAULT_TRYON_LOCALE;
  const initialLocale: TryOnLocale = isTryOnLocale(cookieLocale)
    ? cookieLocale
    : browserLocale;

  return (
    <TryOnLocaleProvider
      initialLocale={initialLocale}
      className="gc-animated min-h-dvh overflow-x-clip bg-background text-foreground"
    >
      <TryOnStudio />
    </TryOnLocaleProvider>
  );
}
