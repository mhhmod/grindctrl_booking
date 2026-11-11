/* The piece on the store page the shopper is looking at (Chat-Home,
   "You're viewing"), handed over by the loader from the store's own
   product JSON. Display data only, checked field by field. */

export type PageProduct = {
  handle: string;
  title: string;
  imageUrl: string;
  variantId: string;
  variantTitle: string;
  priceMinor: number | null;
  currency: string | null;
  price?: string;
  url?: string;
  description?: string;
  availability?: string;
  sizes?: string[];
  /** The store's try-on button is on the page. */
  tryOn: boolean;
};

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export function parsePageProduct(raw: unknown): PageProduct | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  const handle = text(p.handle, 255);
  const title = text(p.title, 200);
  const variantId = text(p.variantId, 20);
  // A website product without numeric variants (any stack but Shopify and WooCommerce) sends none.
  if (!handle || !title || (variantId !== '' && !/^\d{1,20}$/.test(variantId))) return null;
  const imageUrl = text(p.imageUrl, 2000);
  return {
    handle,
    title,
    imageUrl: /^https:\/\/[^\s"'<>]+$/.test(imageUrl) ? imageUrl : '',
    variantId,
    variantTitle: text(p.variantTitle, 120),
    priceMinor: typeof p.priceMinor === 'number' && Number.isInteger(p.priceMinor) && p.priceMinor >= 0 ? p.priceMinor : null,
    currency: typeof p.currency === 'string' && /^[A-Z]{3}$/.test(p.currency) ? p.currency : null,
    ...(typeof p.price === 'string' && /^\d{1,12}(?:\.\d{1,4})?$/.test(p.price) ? { price: p.price } : {}),
    tryOn: p.tryOn === true,
    ...(typeof p.url === 'string' ? { url: text(p.url, 2000) } : {}),
    ...(typeof p.description === 'string' ? { description: text(p.description, 600) } : {}),
    ...(typeof p.availability === 'string' ? { availability: text(p.availability, 30) } : {}),
    ...(Array.isArray(p.sizes) ? { sizes: p.sizes.slice(0, 30).map((v) => text(v, 80)) } : {}),
  };
}

export function pageProductHint(product: PageProduct | null) {
  if (!product) return undefined;
  const digits = product.currency ? new Intl.NumberFormat('en', { style: 'currency', currency: product.currency }).resolvedOptions().maximumFractionDigits ?? 2 : 2;
  return { title: product.title, url: product.url, description: product.description, availability: product.availability,
    sizes: product.sizes, currency: product.currency, price: product.price ?? (product.priceMinor == null || !product.currency ? null : (product.priceMinor / 10 ** digits).toFixed(digits)) };
}
