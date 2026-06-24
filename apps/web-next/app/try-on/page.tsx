import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { TryOnLocaleProvider } from '@/components/try-on/locale-provider';
import { TryOnPageContent } from '@/components/try-on/try-on-page-content';
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
  const initialLocale: TryOnLocale = isTryOnLocale(cookieLocale)
    ? cookieLocale
    : DEFAULT_TRYON_LOCALE;

  return (
    <TryOnLocaleProvider
      initialLocale={initialLocale}
      className="gc-animated min-h-screen bg-background text-foreground"
    >
      <TryOnPageContent />
    </TryOnLocaleProvider>
  );
}
