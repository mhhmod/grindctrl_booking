import type { Metadata } from 'next';
import { ShopifyAppShell } from '@/components/shopify/app-shell';
import { SHOPIFY_CLIENT_ID } from '@/lib/shopify/session-token';
import { DEFAULT_TRYON_LOCALE, getDir, isTryOnLocale, type TryOnLocale } from '@/lib/try-on/i18n';

export const metadata: Metadata = {
  title: 'GRINDCTRL',
  robots: { index: false },
};

/* Embedded Shopify admin (Next.js): App Bridge script + session-token
   authenticated app shell, with Try-On and Store Chat as separate tabs
   under one GRINDCTRL header. */
export default async function ShopifyAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ locale?: string }>;
}) {
  /* Shopify appends ?locale=<merchant admin language> when it frames the
     app. This is the merchant's language, not the shopper's: the storefront
     widget resolves the shopper's separately. */
  const params = await searchParams;
  const base = (params.locale ?? '').toLowerCase().split('-')[0];
  const locale: TryOnLocale = isTryOnLocale(base) ? base : DEFAULT_TRYON_LOCALE;

  return (
    <>
      <meta name="shopify-api-key" content={SHOPIFY_CLIENT_ID} />
      {/* Plain sync script: executes during HTML parse, before hydration.
          next/script beforeInteractive only works in the root layout. */}
      {/* eslint-disable-next-line @next/next/no-sync-scripts */}
      <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js" />
      <main dir={getDir(locale)} lang={locale} className="min-h-dvh bg-background text-foreground">
        <ShopifyAppShell locale={locale} />
      </main>
    </>
  );
}
