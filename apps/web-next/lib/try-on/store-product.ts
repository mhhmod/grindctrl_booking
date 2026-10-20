import { intlLocale } from '@/lib/copy/rules';
import type { TryOnLocale } from './i18n';

/* The product as the shopper's store page shows it (02-try-on.md,
   TryOn-Result; phase zero item 19): its options, its variants with their
   availability and price, in the shopper's language and currency. The
   loader reads the store's own product JSON and hands it to the sheet, so
   colour names are the store's translations and prices the presentment
   currency, with no new Shopify scope. It is display data only: the
   loader adds to the cart only a variant of this same product. */

export type StoreVariant = {
  id: string;
  /** "Black / M"; "Default Title" for a product without variants. */
  title: string;
  /** One value per option, in the product's option order. */
  options: string[];
  available: boolean;
  /** In the currency's minor units, as Shopify gives it. */
  price: number | null;
};

export type StoreProduct = {
  options: string[];
  variants: StoreVariant[];
  currency: string | null;
};

const MAX_VARIANTS = 250;
const MAX_TEXT = 120;

function text(value: unknown, max = MAX_TEXT): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;
}

/** The loader's message, checked field by field; null when unusable. */
export function parseStoreProduct(raw: unknown): StoreProduct | null {
  if (!raw || typeof raw !== 'object') return null;
  const input = raw as { options?: unknown; variants?: unknown; currency?: unknown };
  if (!Array.isArray(input.variants)) return null;
  const options = Array.isArray(input.options)
    ? input.options.slice(0, 3).map((name) => text(name, 60)).filter((name): name is string => !!name)
    : [];
  const variants: StoreVariant[] = [];
  for (const entry of input.variants.slice(0, MAX_VARIANTS)) {
    if (!entry || typeof entry !== 'object') continue;
    const v = entry as Record<string, unknown>;
    const id = typeof v.id === 'number' || typeof v.id === 'string' ? String(v.id) : '';
    if (!/^\d{1,20}$/.test(id)) continue;
    const values = Array.isArray(v.options) ? v.options.slice(0, 3).map((value) => text(value, 60) ?? '') : [];
    variants.push({
      id,
      title: text(v.title) ?? '',
      options: values,
      available: v.available === true,
      price: typeof v.price === 'number' && Number.isInteger(v.price) && v.price >= 0 ? v.price : null,
    });
  }
  if (!variants.length) return null;
  const currency = typeof input.currency === 'string' && /^[A-Z]{3}$/.test(input.currency) ? input.currency : null;
  return { options, variants, currency };
}

/** Options a shopper changes without a new look: a size does not change
 *  the picture. Matched on the store's own option name. */
export function isSizeOption(name: string): boolean {
  return /\bsizes?\b|مقاس|المقاس|taille|größe|talla|maat|beden/i.test(name);
}

/** The sizes a shopper can pick for the look they have: every variant that
 *  keeps the other options as tried, in the store's order. Empty when the
 *  product has no size option. */
export function sizeChoices(product: StoreProduct, tried: StoreVariant): { index: number; variants: StoreVariant[] } {
  const index = product.options.findIndex(isSizeOption);
  if (index < 0) return { index, variants: [] };
  const variants = product.variants.filter((variant) =>
    variant.options.every((value, i) => i === index || value === tried.options[i]),
  );
  return { index, variants };
}

/** "Black, M" in English, "أسود، M" in Arabic; nothing for the default variant. */
export function variantName(title: string, locale: TryOnLocale): string {
  const trimmed = title.trim().slice(0, 80);
  if (!trimmed || trimmed === 'Default Title') return '';
  return trimmed.split(' / ').join(locale === 'ar' ? '، ' : ', ');
}

/** "EGP 3,250" or "3,250 ج.م", with Western digits and cents only when there are some. */
export function formatStorePrice(minor: number, currency: string, locale: TryOnLocale): string {
  const amount = minor / 100;
  const formatted = new Intl.NumberFormat(intlLocale(locale), {
    style: 'currency',
    currency,
    minimumFractionDigits: minor % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
  // Drop the direction marks Intl adds, and the full stop after an Arabic currency abbreviation.
  const clean = formatted.replace(/[‎‏؜]/g, '').trim();
  return locale === 'ar' ? clean.replace(/\.$/, '') : clean;
}
