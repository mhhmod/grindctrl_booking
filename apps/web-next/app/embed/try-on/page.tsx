import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import { TryOnLocaleProvider } from '@/components/try-on/locale-provider';
import { TryOnDemo } from '@/components/try-on/try-on-demo';
import { EmbedFrameBridge } from '@/components/try-on/embed-frame-bridge';
import { getTryOnSettings } from '@/lib/try-on/settings';
import { getProduct } from '@/lib/try-on/products';
import { isAllowedGarmentUrl } from '@/lib/try-on/image-runner';
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
  const garmentOk = !!params.garment && isAllowedGarmentUrl(params.garment);
  /* Never show the seeded demo garment for a store product: even when an
     old cached block script omits garment/title, a non-catalog handle
     renders as the store's product (name prettified from the handle). */
  const isStoreProduct = !!params.product && !getProduct(params.product);
  const shopProduct = isStoreProduct
    ? {
        handle: params.product!,
        name:
          params.title ||
          params.product!.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        imageUrl: garmentOk ? params.garment! : '',
      }
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
          overrides={{
            loadingSteps: settings.loadingSteps ?? undefined,
            loadingStyle: settings.loadingStyle,
            result: {
              showDownload: settings.showDownload,
              showWhatsapp: settings.showWhatsapp,
              showAddToCart: settings.showAddToCart,
              showTryAgain: settings.showTryAgain,
              disclaimerText: settings.disclaimerText,
            },
          }}
        />
      </main>
    </TryOnLocaleProvider>
  );
}
