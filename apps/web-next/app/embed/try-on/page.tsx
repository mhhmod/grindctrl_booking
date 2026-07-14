import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import { TryOnLocaleProvider } from '@/components/try-on/locale-provider';
import { TryOnDemo } from '@/components/try-on/try-on-demo';
import { EmbedFrameBridge } from '@/components/try-on/embed-frame-bridge';
import { getTryOnSettings } from '@/lib/try-on/settings';
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
   Query params: product=<id> shop=<domain> locale=en|ar theme=light|dark
   Journey styling comes from tryon_settings (dashboard-editable).
   Height is reported to the parent via postMessage (EmbedFrameBridge). */
export default async function EmbedTryOnPage({
  searchParams,
}: {
  searchParams: Promise<{
    product?: string;
    shop?: string;
    locale?: string;
    theme?: string;
    garment?: string;
    title?: string;
  }>;
}) {
  const params = await searchParams;

  /* Store-product mode: the block passes the product's own image + title
     so customers try on the actual product, not the seeded demo garment. */
  let garmentHost = '';
  try {
    garmentHost = params.garment ? new URL(params.garment).hostname : '';
  } catch {
    garmentHost = '';
  }
  const shopProduct =
    params.product && params.title && params.garment && garmentHost === 'cdn.shopify.com'
      ? { handle: params.product, name: params.title, imageUrl: params.garment }
      : undefined;
  const settings = await getTryOnSettings(params.shop);

  const initialLocale: TryOnLocale = isTryOnLocale(params.locale)
    ? params.locale
    : DEFAULT_TRYON_LOCALE;
  /* Explicit param wins; otherwise the dashboard-configured theme. */
  const theme =
    params.theme === 'dark' || params.theme === 'light' ? params.theme : settings.widgetTheme;

  /* Config → design tokens: shadcn primitives pick these up directly. */
  const tokenOverrides = {
    '--primary': settings.accentBg,
    '--primary-foreground': settings.accentFg,
    '--radius': `${Math.min(settings.radiusPx, 24)}px`,
  } as CSSProperties;

  return (
    <TryOnLocaleProvider
      initialLocale={initialLocale}
      className="min-h-dvh bg-background text-foreground"
    >
      <EmbedFrameBridge theme={theme} />
      <main className="px-4 py-6 sm:px-6" style={tokenOverrides}>
        <TryOnDemo
          productId={params.product}
          shopProduct={shopProduct}
          overrides={{ loadingSteps: settings.loadingSteps ?? undefined }}
        />
      </main>
    </TryOnLocaleProvider>
  );
}
