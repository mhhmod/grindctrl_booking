/* The shopper's cart as Store Chat keeps it (N16's cart, phase zero item 10).

   The storefront loader reads Shopify's /cart.js and the panel posts it to
   POST /api/messenger/cart. Everything here comes from the shopper's
   browser, so it is checked and trimmed before it is kept, and it only
   ever informs a handoff rule: it never prices or changes anything. */

export interface CartLine {
  handle: string;
  variantId: string;
  title: string;
  quantity: number;
  priceMinor: number;
}

export interface ShopperCart {
  totalMinor: number;
  currency: string;
  items: CartLine[];
}

export const CART_MAX_LINES = 50;
/** One hundred million in minor units: well above any real cart. */
const MAX_MINOR = 100_000_000_00;
const MAX_QUANTITY = 10_000;

function wholeNumber(value: unknown, max: number): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max ? value : null;
}

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

/** A cart in the contract's shape, or null when it is not one. */
export function parseCart(raw: unknown): ShopperCart | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const source = raw as Record<string, unknown>;
  const totalMinor = wholeNumber(source.totalMinor, MAX_MINOR);
  const currency = typeof source.currency === 'string' ? source.currency.trim().toUpperCase() : '';
  if (totalMinor === null || !/^[A-Z]{3}$/.test(currency) || !Array.isArray(source.items)) return null;
  if (source.items.length > CART_MAX_LINES) return null;

  const items: CartLine[] = [];
  for (const entry of source.items) {
    if (!entry || typeof entry !== 'object') return null;
    const line = entry as Record<string, unknown>;
    const quantity = wholeNumber(line.quantity, MAX_QUANTITY);
    const priceMinor = wholeNumber(line.priceMinor, MAX_MINOR);
    const variantId =
      typeof line.variantId === 'number' && Number.isInteger(line.variantId)
        ? String(line.variantId)
        : text(line.variantId, 40);
    if (quantity === null || quantity === 0 || priceMinor === null || !/^\d{1,20}$/.test(variantId)) return null;
    items.push({
      handle: text(line.handle, 255).toLowerCase().replace(/[^a-z0-9\-_.؀-ۿ]/g, ''),
      variantId,
      title: text(line.title, 200),
      quantity,
      priceMinor,
    });
  }
  return { totalMinor, currency, items };
}
