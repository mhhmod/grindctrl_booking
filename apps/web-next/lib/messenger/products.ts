import 'server-only';
import { fetchPublicPage } from '@/lib/paste/storefront-scan';
import { loadActiveWooConnection } from '@/lib/woo/active-connection';
import { getMessengerServiceClient } from './db';
import { loadPublicSite, type ResolvedPublicSite } from './public-api';
import { decideOrigin } from './origins';
import { parseProductContext, rankProducts, type ProductContext } from './product-context';
import type { MessengerSiteView } from './provisioning';

export const PRODUCT_LIMIT = 500;
export function productUrlTrusted(site: ResolvedPublicSite, url: URL): boolean {
  return decideOrigin({ origin: url.origin, patterns: site.patterns, security: {}, siteDomain: site.domain, pasteShopDomain: site.pasteShopDomain }).allowed;
}
type Platform = 'woocommerce' | 'shopify';
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

export function parseCataloguePage(raw: unknown, platform: Platform, base: string, trusted: (url: URL) => boolean): { products: ProductContext[]; count: number } {
  const rows = platform === 'woocommerce' ? raw : object(raw).products;
  if (!Array.isArray(rows)) throw new Error('Invalid catalogue response.');
  const products = rows.slice(0, PRODUCT_LIMIT).flatMap((value) => {
    const p = object(value), prices = object(p.prices);
    const variants = Array.isArray(p.variants) ? p.variants.map(object) : [];
    const attributes = Array.isArray(p.attributes) ? p.attributes.map(object) : [];
    const minor = prices.currency_minor_unit;
    const wooPrice = typeof prices.price === 'string' && /^\d{1,15}$/.test(prices.price) && Number.isInteger(minor) && Number(minor) >= 0 && Number(minor) <= 4
      ? (Number(prices.price) / 10 ** Number(minor)).toFixed(Number(minor)) : null;
    const available = platform === 'woocommerce' ? p.is_in_stock : variants.some((v) => v.available === true);
    const knownStock = platform === 'woocommerce' ? typeof p.is_in_stock === 'boolean' : variants.some((v) => typeof v.available === 'boolean');
    const product = parseProductContext({
      title: platform === 'woocommerce' ? p.name : p.title,
      url: platform === 'woocommerce' ? p.permalink : typeof p.handle === 'string' ? new URL(`/products/${encodeURIComponent(p.handle)}`, base).href : '',
      price: platform === 'woocommerce' ? wooPrice : variants[0]?.price,
      // products.json does not reliably supply currency; never guess it.
      currency: platform === 'woocommerce' ? prices.currency_code : p.currency,
      availability: knownStock ? available ? 'in_stock' : 'out_of_stock' : 'unknown',
      description: platform === 'woocommerce' ? p.short_description || p.description : p.body_html,
      sizes: platform === 'woocommerce' ? attributes.flatMap((a) => Array.isArray(a.terms) ? a.terms.map((t) => object(t).name) : []) : variants.map((v) => v.title),
    }, trusted);
    return product ? [product] : [];
  });
  return { products, count: rows.length };
}

export async function fetchCatalogue(platform: Platform, base: string, trusted: (url: URL) => boolean, options: Pick<Parameters<typeof fetchPublicPage>[1], 'transport' | 'lookup'> = {}): Promise<ProductContext[]> {
  const unique = new Map<string, ProductContext>();
  const perPage = platform === 'woocommerce' ? 100 : 250;
  // Page bound holds even if the provider repeats a full page forever.
  for (let page = 1; page <= PRODUCT_LIMIT / perPage; page++) {
    const path = platform === 'woocommerce' ? `/wp-json/wc/store/v1/products?per_page=100&page=${page}` : `/products.json?limit=250&page=${page}`;
    const url = new URL(path, base);
    if (!trusted(url)) throw new Error('Catalogue domain is not trusted.');
    const response = await fetchPublicPage(url.href, { ...options, accept: 'application/json', maxBytes: 2 * 1024 * 1024, timeoutMs: 10_000,
      allowedHost: (host) => trusted(new URL(`https://${host}/`)) });
    if ('failure' in response) throw new Error(`Catalogue fetch failed: ${response.failure}`);
    if (!response.contentType.includes('json') || response.body.length >= 2 * 1024 * 1024) throw new Error('Invalid or oversized catalogue response.');
    const parsed = parseCataloguePage(JSON.parse(response.body.toString('utf8')), platform, response.url, trusted);
    for (const p of parsed.products) if (unique.size < PRODUCT_LIMIT) unique.set(p.url, p);
    if (parsed.count < perPage || unique.size >= PRODUCT_LIMIT) break;
  }
  return [...unique.values()];
}

async function catalogueTarget(site: ResolvedPublicSite): Promise<{ platform: Platform; base: string } | null> {
  const woo = await loadActiveWooConnection(site.id);
  if (woo) return { platform: 'woocommerce', base: woo.homeUrl };
  if (site.pasteShopDomain || site.domain?.endsWith('.myshopify.com')) return { platform: 'shopify', base: `https://${site.pasteShopDomain || site.domain}` };
  const { data, error } = await getMessengerServiceClient().from('widget_domains').select('domain, platform_detected').eq('widget_site_id', site.id).order('created_at', { ascending: true }).limit(50);
  if (error) throw new Error('Catalogue domains unavailable.');
  for (const row of data ?? []) {
    if (row.platform_detected !== 'woocommerce' && row.platform_detected !== 'shopify') continue;
    const url = new URL(`https://${row.domain}/`);
    if (productUrlTrusted(site, url)) return { platform: row.platform_detected as Platform, base: url.href };
  }
  return null;
}

export async function syncSiteProducts(site: Pick<MessengerSiteView, 'id' | 'embed_key'>): Promise<{ count: number; skipped?: boolean }> {
  const resolved = await loadPublicSite(site.embed_key);
  if (!resolved || resolved.id !== site.id) throw new Error('Site unavailable.');
  const db = getMessengerServiceClient();
  const lease = new Date().toISOString();
  const claim = await db.from('widget_sites').update({ products_sync_attempted_at: lease }).eq('id', site.id)
    .or(`products_sync_attempted_at.is.null,products_sync_attempted_at.lt.${new Date(Date.now() - 300_000).toISOString()}`).select('id');
  if (claim.error) throw new Error('Catalogue sync unavailable.');
  if (!claim.data?.length) throw new Error('Catalogue sync is already running or was just attempted.');
  const target = await catalogueTarget(resolved);
  const products = target ? await fetchCatalogue(target.platform, target.base, (url) => productUrlTrusted(resolved, url)) : [];
  // One transaction: failed fetches leave the previous catalogue intact;
  // disconnected/unsupported sites lose stale product grounding on refresh.
  const saved = await db.rpc('messenger_replace_products', { p_site: site.id, p_lease: lease, p_products: products });
  if (saved.error) throw new Error('Catalogue could not be saved.');
  return { count: products.length, ...(!target ? { skipped: true } : {}) };
}

export async function getMatchingProducts(site: ResolvedPublicSite, query: string): Promise<ProductContext[]> {
  const { data, error } = await getMessengerServiceClient().from('messenger_knowledge').select('product_data').eq('widget_site_id', site.id).eq('source', 'product').eq('status', 'active').order('id').limit(PRODUCT_LIMIT);
  if (error) throw new Error('Product knowledge unavailable.');
  return rankProducts((data ?? []).flatMap((row) => {
    const p = parseProductContext(row.product_data, (url) => productUrlTrusted(site, url));
    return p ? [p] : [];
  }), query);
}

export async function refreshDueProducts(): Promise<{ processed: number; failed: number }> {
  // Leave an hour for cron jitter; otherwise a run seconds earlier than
  // yesterday can accidentally defer a daily refresh for another day.
  const cutoff = new Date(Date.now() - 23 * 60 * 60_000).toISOString();
  const { data, error } = await getMessengerServiceClient().from('widget_sites').select('id, embed_key').eq('status', 'active')
    .or(`products_sync_attempted_at.is.null,products_sync_attempted_at.lt.${cutoff}`).order('products_sync_attempted_at', { nullsFirst: true }).order('id').limit(3);
  if (error) throw new Error('Catalogue refresh unavailable.');
  let failed = 0;
  for (const site of data ?? []) try { await syncSiteProducts(site); } catch { failed++; }
  return { processed: data?.length ?? 0, failed };
}
