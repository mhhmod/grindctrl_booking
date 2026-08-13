import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { TryOnLocaleProvider } from '@/components/try-on/locale-provider';
import { TryOnPageContent } from '@/components/try-on/try-on-page-content';
import { localeFromAcceptLanguage } from '@/lib/landing/accept-language';
import {
  DEFAULT_TRYON_LOCALE,
  isTryOnLocale,
  TRYON_LOCALE_COOKIE,
  type TryOnLocale,
} from '@/lib/try-on/i18n';

export const metadata: Metadata = {
  title: 'Try-On Agent — GRINDCTRL',
  description:
    'Upload your photo and preview how a product looks on you. Powered by GrindCTRL AI visual sales tools.',
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
      className="gc-animated min-h-screen bg-background text-foreground"
    >
      <TryOnPageContent />
    </TryOnLocaleProvider>
  );
}
