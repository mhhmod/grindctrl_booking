/* Shoppers who arrive from Instagram, Facebook or TikTok are inside that
   app's own browser, where the camera often cannot open (02-try-on.md,
   TryOn-More). The sheet says so, leads with a photo from the gallery, and
   offers the store's page in the phone's own browser, with the piece and
   the variant carried in the link. */

export type InAppBrowser = {
  app: 'Instagram' | 'Facebook' | 'TikTok';
  os: 'ios' | 'android' | 'other';
};

/** The query flag the loader reads to open the try-on again on arrival. */
export const REOPEN_PARAM = 'gc_tryon';

export function detectInAppBrowser(userAgent: string): InAppBrowser | null {
  const ua = userAgent || '';
  const app = /Instagram/i.test(ua)
    ? 'Instagram'
    : /FBAN|FBAV|FB_IAB|FBIOS|FB4A/.test(ua)
      ? 'Facebook'
      : /musical_ly|BytedanceWebview|TikTok|trill_/i.test(ua)
        ? 'TikTok'
        : null;
  if (!app) return null;
  const os = /iPhone|iPad|iPod/i.test(ua) ? 'ios' : /Android/i.test(ua) ? 'android' : 'other';
  return { app, os };
}

const HANDLE_RE = /^[\p{L}\p{N}][\p{L}\p{N}_-]{0,254}$/u;

/** The store's own page for this piece and variant, which reopens the
 *  try-on there. The store's address comes from the page that holds the
 *  sheet, else its permanent Shopify domain; null when neither is usable. */
export function storePageUrl({
  referrer,
  shop,
  handle,
  variantId,
}: {
  referrer: string;
  shop?: string;
  handle: string;
  variantId?: string;
}): string | null {
  if (!HANDLE_RE.test(handle)) return null;
  let origin: string | null = null;
  try {
    const from = new URL(referrer);
    if (from.protocol === 'https:') origin = from.origin;
  } catch {
    // No usable referrer: fall back to the shop's own domain.
  }
  if (!origin && shop && /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop)) origin = `https://${shop}`;
  if (!origin) return null;
  const url = new URL(`/products/${encodeURIComponent(handle)}`, origin);
  if (variantId && /^\d{1,20}$/.test(variantId)) url.searchParams.set('variant', variantId);
  url.searchParams.set(REOPEN_PARAM, '1');
  return url.toString();
}

/** Android opens an intent link in Chrome, falling back to the plain link. */
export function androidIntentUrl(url: string): string {
  const target = new URL(url);
  return `intent://${target.host}${target.pathname}${target.search}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`;
}
