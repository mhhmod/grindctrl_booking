import 'server-only';
import { fetchPublicPage, findPasswordForm } from '@/lib/paste/storefront-scan';
import { parseProductsStatus, type ProductsOutcome, type ProductsStatus } from './products-status';
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

/** A catalogue that could not be read, with the reason the merchant is told. */
export class CatalogueReadError extends Error {
  constructor(readonly outcome: Exclude<ProductsOutcome, 'ok'>, message: string) { super(message); this.name = 'CatalogueReadError'; }
}

function isPasswordPage(response: { url: string; contentType: string; body: Buffer }): boolean {
  if (new URL(response.url).pathname.replace(/\/+$/, '') === '/password') return true;
  return response.contentType.includes('html') && findPasswordForm(response.body.toString('utf8')) !== null;
}

/** What an HTTP status that is not the catalogue means for the merchant. */
function statusOutcome(status: number | undefined): Exclude<ProductsOutcome, 'ok'> {
  if (status === 429) return 'rate_limited';
  return status === 404 || status === 410 ? 'not_found' : 'unreachable';
}

/** The statuses a Shopify storefront serves its password page with besides
 *  200, the same three scanShopStorefront reads. */
const PASSWORD_PAGE_STATUSES = [401, 403] as const;

type CatalogueFetchOptions = Pick<Parameters<typeof fetchPublicPage>[1], 'transport' | 'lookup' | 'allowedHost'>;

/** Whether the store's own home page is its password page. Asked once, only
 *  after the catalogue answered with a status that explains nothing, so "we
 *  couldn't reach your store" is never said of a store that is simply closed. */
async function storefrontBehindPassword(base: string, options: CatalogueFetchOptions): Promise<boolean> {
  const home = await fetchPublicPage(new URL('/', base).href, { ...options, accept: 'text/html', maxBytes: 512 * 1024, timeoutMs: 5_000,
    passStatuses: PASSWORD_PAGE_STATUSES });
  return !('failure' in home) && isPasswordPage(home);
}

export async function fetchCatalogue(platform: Platform, base: string, trusted: (url: URL) => boolean, options: Pick<Parameters<typeof fetchPublicPage>[1], 'transport' | 'lookup'> = {}): Promise<ProductContext[]> {
  const unique = new Map<string, ProductContext>();
  const perPage = platform === 'woocommerce' ? 100 : 250;
  const read: CatalogueFetchOptions = { ...options, allowedHost: (host) => trusted(new URL(`https://${host}/`)) };
  /** A status the catalogue answered with that is not its products. */
  const refused = async (status: number | undefined, page: number): Promise<CatalogueReadError> => {
    const outcome = statusOutcome(status);
    return outcome === 'unreachable' && platform === 'shopify' && page === 1 && await storefrontBehindPassword(base, read)
      ? new CatalogueReadError('password_page', 'Catalogue is behind the store password page.')
      : new CatalogueReadError(outcome, 'Catalogue fetch failed: status');
  };
  // Page bound holds even if the provider repeats a full page forever.
  for (let page = 1; page <= PRODUCT_LIMIT / perPage; page++) {
    const path = platform === 'woocommerce' ? `/wp-json/wc/store/v1/products?per_page=100&page=${page}` : `/products.json?limit=250&page=${page}`;
    const url = new URL(path, base);
    if (!trusted(url)) throw new CatalogueReadError('unreachable', 'Catalogue domain is not trusted.');
    const response = await fetchPublicPage(url.href, { ...read, accept: 'application/json', maxBytes: 2 * 1024 * 1024, timeoutMs: 10_000,
      // A closed Shopify store may answer 401 or 403 with its password page:
      // read it, or the real reason is lost and it reads as an outage.
      passStatuses: platform === 'shopify' ? PASSWORD_PAGE_STATUSES : undefined });
    if ('failure' in response) {
      if (response.failure === 'status') throw await refused(response.status, page);
      // A closed Shopify store redirects a JSON request for /password to itself.
      if (response.failure === 'too_many_redirects' && (await refused(undefined, page)).outcome === 'password_page') {
        throw new CatalogueReadError('password_page', 'Catalogue is behind the store password page.');
      }
      throw new CatalogueReadError('unreachable', `Catalogue fetch failed: ${response.failure}`);
    }
    // A password-protected Shopify store answers /products.json with its password page.
    if (isPasswordPage(response)) throw new CatalogueReadError('password_page', 'Catalogue is behind the store password page.');
    if (response.status < 200 || response.status > 299) throw await refused(response.status, page);
    if (!response.contentType.includes('json') || response.body.length >= 2 * 1024 * 1024) throw new CatalogueReadError('not_found', 'Invalid or oversized catalogue response.');
    let parsed: ReturnType<typeof parseCataloguePage>;
    try { parsed = parseCataloguePage(JSON.parse(response.body.toString('utf8')), platform, response.url, trusted); }
    catch { throw new CatalogueReadError('not_found', 'Invalid catalogue response.'); }
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

/** Informational: a failed write (the column not migrated yet) never fails the refresh. */
async function recordProductsStatus(siteId: string, lease: string, status: ProductsStatus | null): Promise<void> {
  const saved = await getMessengerServiceClient().from('widget_sites').update({ products_sync_result: status })
    .eq('id', siteId).eq('products_sync_attempted_at', lease);
  if (saved.error) console.error('[products] refresh outcome not recorded', { site: siteId, code: saved.error.code });
}

/** What the last refresh found for this store, or null when none is recorded
 *  (a website without a catalogue, a store not refreshed yet, or the column
 *  not migrated yet). Never throws: What it knows must still load. */
export async function readProductsStatus(siteId: string): Promise<ProductsStatus | null> {
  const read = await getMessengerServiceClient().from('widget_sites').select('products_sync_result').eq('id', siteId).maybeSingle();
  if (read.error) return null;
  return parseProductsStatus((read.data as { products_sync_result?: unknown } | null)?.products_sync_result);
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
  let products: ProductContext[] = [];
  if (target) {
    try {
      products = await fetchCatalogue(target.platform, target.base, (url) => productUrlTrusted(resolved, url));
    } catch (error) {
      // The previous catalogue stays; the merchant is told why it is not refreshing.
      await recordProductsStatus(site.id, lease, { outcome: error instanceof CatalogueReadError ? error.outcome : 'unreachable', count: 0, at: lease });
      throw error;
    }
  }
  // One transaction: failed fetches leave the previous catalogue intact;
  // disconnected/unsupported sites lose stale product grounding on refresh.
  const saved = await db.rpc('messenger_replace_products', { p_site: site.id, p_lease: lease, p_products: products });
  if (saved.error) throw new Error('Catalogue could not be saved.');
  await recordProductsStatus(site.id, lease, target ? { outcome: 'ok', count: products.length, at: lease } : null);
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
