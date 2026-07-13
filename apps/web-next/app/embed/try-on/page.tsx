import type { Metadata } from 'next';
import { TryOnLocaleProvider } from '@/components/try-on/locale-provider';
import { TryOnDemo } from '@/components/try-on/try-on-demo';
import { EmbedFrameBridge } from '@/components/try-on/embed-frame-bridge';
import {
  DEFAULT_TRYON_LOCALE,
  isTryOnLocale,
  type TryOnLocale,
} from '@/lib/try-on/i18n';

export const metadata: Metadata = {
  title: 'Try-On — GRINDCTRL',
  robots: { index: false },
};

/* Bare try-on for embedding in an iframe (Shopify product pages).
   Query params: product=<id> locale=en|ar theme=light|dark
   Height is reported to the parent via postMessage (EmbedFrameBridge). */
export default async function EmbedTryOnPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string; locale?: string; theme?: string }>;
}) {
  const params = await searchParams;
  const initialLocale: TryOnLocale = isTryOnLocale(params.locale)
    ? params.locale
    : DEFAULT_TRYON_LOCALE;
  /* Merchant storefronts are overwhelmingly light; embeds default to light. */
  const theme = params.theme === 'dark' ? 'dark' : 'light';

  return (
    <TryOnLocaleProvider
      initialLocale={initialLocale}
      className="min-h-dvh bg-background text-foreground"
    >
      <EmbedFrameBridge theme={theme} />
      <main className="px-4 py-6 sm:px-6">
        <TryOnDemo productId={params.product} />
      </main>
    </TryOnLocaleProvider>
  );
}
