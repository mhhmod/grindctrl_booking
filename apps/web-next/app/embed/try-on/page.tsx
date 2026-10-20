import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import { cookies, headers } from 'next/headers';
import { toAppearanceTokens } from '@/lib/try-on/appearance';
import { pickMerchantCopy } from '@/lib/try-on/merchant-copy';
import { TryOnLocaleProvider } from '@/components/try-on/locale-provider';
import { TryOnDemo } from '@/components/try-on/try-on-demo';
import { TryOnSheet } from '@/components/try-on/sheet/try-on-sheet';
import { EmbedFrameBridge } from '@/components/try-on/embed-frame-bridge';
import { getTryOnSettings } from '@/lib/try-on/settings';
import { isAllowedGarmentUrl } from '@/lib/try-on/image-runner';
import { normalizeShopDomain } from '@/lib/shopify/shop-authorization';
import { storeFlags } from '@/lib/flags/store-flags';
import { getTypicalLookSeconds } from '@/lib/try-on/look-timing';
import { DEFAULT_ADDRESS_FORM } from '@/lib/try-on/sheet-copy';
import { localeFromAcceptLanguage } from '@/lib/landing/accept-language';
import {
  DEFAULT_TRYON_LOCALE,
  getDictionary,
  isTryOnLocale,
  TRYON_LOCALE_COOKIE,
  type TryOnLocale,
} from '@/lib/try-on/i18n';

export const metadata: Metadata = {
  title: 'Try-On | GRINDCTRL',
  robots: { index: false },
};

/* Bare try-on for embedding in an iframe (Shopify product pages).
   Query params: product=<handle> shop=<domain> locale=en|ar garment title
   variant, and in the v16 sheet sheet=1 variantTitle.
   Journey styling and theme come from tryon_settings (dashboard-editable).
   Height is reported to the parent via postMessage (EmbedFrameBridge). */
export default async function EmbedTryOnPage({
  searchParams,
}: {
  searchParams: Promise<{
    product?: string;
    shop?: string;
    locale?: string;
    garment?: string;
    title?: string;
    variant?: string;
    sheet?: string;
    variantTitle?: string;
  }>;
}) {
  const params = await searchParams;
  const productHandle = params.product?.trim() || '';
  const shop = normalizeShopDomain(params.shop);

  /* Store-product mode: the block passes the product's own image + title
     so customers try on the actual product, not the seeded demo garment. */
  const garmentOk = !!params.garment && isAllowedGarmentUrl(params.garment);
  /* Every embed handle belongs to the storefront. Seeded catalog products
     are reserved for the standalone demo page. */
  const shopProduct = productHandle
    ? {
        handle: productHandle,
        name:
          params.title?.trim() ||
          productHandle.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        imageUrl: garmentOk ? params.garment! : '',
      }
    : undefined;
  /* The v16 sheet only for a store whose v16_tryon flag is on; any other
     store keeps today's try-on even if a loader asks for the sheet. */
  const [settings, sheetOn] = await Promise.all([
    getTryOnSettings(shop),
    params.sheet === '1' && shop && shopProduct
      ? storeFlags({ shopDomain: shop }).then((flags) => flags.includes('v16_tryon'))
      : Promise.resolve(false),
  ]);
  const lookSeconds = sheetOn ? await getTypicalLookSeconds(shop) : null;

  /* Same fallback chain as app/try-on/page.tsx (the standalone demo): an
     explicit signal wins over a guess, and a shopper who set Arabic
     site-wide must not silently see English just because this one embed
     didn't get a ?locale= param from the theme block. The query param
     stays highest priority here -- it is the merchant's own deliberate
     per-block configuration, more specific than a browser-wide cookie. */
  const cookieLocale = (await cookies()).get(TRYON_LOCALE_COOKIE)?.value;
  const acceptLanguage = (await headers()).get('accept-language');
  const browserLocale: TryOnLocale = localeFromAcceptLanguage(acceptLanguage) ?? DEFAULT_TRYON_LOCALE;
  const initialLocale: TryOnLocale = isTryOnLocale(params.locale)
    ? params.locale
    : isTryOnLocale(cookieLocale)
      ? cookieLocale
      : browserLocale;
  const copy = getDictionary(initialLocale);
  /* Single source of truth: tryon_settings. Rendered server-side as a
     `light`/`dark` class so the panel never depends on next-themes or
     localStorage, which a third-party iframe may not have. */
  const themeClass = settings.widgetTheme === 'dark' ? 'dark' : 'light';

  /* Config → design tokens: shadcn primitives pick these up directly.
     Shared with the dashboard preview so both render the same shape from
     the same setting. See lib/try-on/appearance.ts for the radius policy. */
  const tokenOverrides = toAppearanceTokens(settings) as CSSProperties;

  /* The merchant's own strings follow the shopper's language, same rule the
     storefront config route uses. */
  const merchantCopy = pickMerchantCopy(settings, initialLocale);

  return (
    <TryOnLocaleProvider
      initialLocale={initialLocale}
      className={`${themeClass} min-h-dvh bg-background text-foreground`}
    >
      <EmbedFrameBridge />
      <main className={`gc-widget-surface ${sheetOn ? 'px-4 pb-6 pt-2 sm:px-8' : 'px-4 py-6 sm:px-6'}`} style={tokenOverrides}>
        {shopProduct && sheetOn ? (
          <div className="mx-auto w-full max-w-xl">
            <TryOnSheet
              product={shopProduct}
              variantId={params.variant}
              variantTitle={params.variantTitle?.trim().slice(0, 200) || undefined}
              shop={shop ?? undefined}
              lookSeconds={lookSeconds}
              // The store's Arabic address form arrives with N26; until then
              // the copy speaks to everyone.
              addressForm={DEFAULT_ADDRESS_FORM}
              loadingSteps={settings.loadingSteps ?? undefined}
              loadingStyle={settings.loadingStyle}
              result={{
                showDownload: settings.showDownload,
                showWhatsapp: settings.showWhatsapp,
                showAddToCart: settings.showAddToCart,
                showTryAgain: settings.showTryAgain,
                disclaimerText: merchantCopy.disclaimerText,
              }}
            />
          </div>
        ) : shopProduct ? (
          <TryOnDemo
            productId={productHandle}
            shop={shop ?? undefined}
            variantId={params.variant}
            shopProduct={shopProduct}
            overrides={{
              loadingSteps: settings.loadingSteps ?? undefined,
              loadingStyle: settings.loadingStyle,
              result: {
                showDownload: settings.showDownload,
                showWhatsapp: settings.showWhatsapp,
                showAddToCart: settings.showAddToCart,
                showTryAgain: settings.showTryAgain,
                disclaimerText: merchantCopy.disclaimerText,
              },
            }}
          />
        ) : (
          <section
            role="status"
            className="mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-xl items-center justify-center"
          >
            <div className="w-full rounded-2xl border bg-card p-6 text-center text-card-foreground sm:p-8">
              <h1 className="text-lg font-semibold tracking-tight">
                {copy.noProductTitle}
              </h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {copy.noProductDescription}
              </p>
            </div>
          </section>
        )}
      </main>
    </TryOnLocaleProvider>
  );
}
