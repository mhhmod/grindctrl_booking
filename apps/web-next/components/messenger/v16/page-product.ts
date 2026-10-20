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
  if (!handle || !title || !/^\d{1,20}$/.test(variantId)) return null;
  const imageUrl = text(p.imageUrl, 2000);
  return {
    handle,
    title,
    imageUrl: /^https:\/\/[^\s"'<>]+$/.test(imageUrl) ? imageUrl : '',
    variantId,
    variantTitle: text(p.variantTitle, 120),
    priceMinor: typeof p.priceMinor === 'number' && Number.isInteger(p.priceMinor) && p.priceMinor >= 0 ? p.priceMinor : null,
    currency: typeof p.currency === 'string' && /^[A-Z]{3}$/.test(p.currency) ? p.currency : null,
    tryOn: p.tryOn === true,
  };
}
