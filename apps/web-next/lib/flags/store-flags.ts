import 'server-only';

import { getMessengerServiceClient } from '@/lib/messenger/db';

/* Per-store feature flags (v16 handoff, 09-backend-contracts.md).

   Every new v16 feature appears only when its flag is on for that store and
   its contract answers. A store is a Shopify shop, or a Store Chat site on
   another website. Flags live in supabase/20261016_store_flags.sql, are read
   only here, cached for 60 seconds like the App Proxy config, and flipped
   only by the platform operator.

   Reads fail closed: a store whose flags cannot be read has none on. */

/** Every flag the code knows, with the contract it belongs to. A row for a
 *  name not listed here is ignored, so a typo can never switch anything on. */
export const STORE_FLAGS = {
  n23_after_hours: { code: 'N23', title: 'The assistant answers after hours' },
  n24_assistant_down: { code: 'N24', title: 'The assistant-down fallback' },
  n25_handoff_rules: { code: 'N25', title: 'Extra handoff rules and topic tags' },
  n8_unanswered_questions: { code: 'N8', title: 'Questions the assistant could not answer' },
  n5_preview_mode: { code: 'N5', title: 'Preview before going live, with free test looks' },
  n6_holdout: { code: 'N6', title: 'The 50/50 holdout' },
  n38_async_jobs: { code: 'N38', title: 'Looks made after the answer, with real stages' },
  /* Screen flags turn a redesigned surface on for one store
     (supabase/20261017_store_flags_screens.sql admits the v16_ names). */
  v16_dashboard: { code: 'V16', title: 'The v16 dashboard shell and pages' },
  v16_tryon: { code: 'V16', title: 'The v16 try-on for shoppers (needs the theme extension deployed)' },
} as const;

export type StoreFlag = keyof typeof STORE_FLAGS;

export type FlagStore = { shopDomain: string } | { widgetSiteId: string };

const STORE_FLAG_NAMES = Object.keys(STORE_FLAGS) as StoreFlag[];
const CACHE_TTL_MS = 60_000;
const SHOP_DOMAIN_RE = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const cache = new Map<string, { flags: StoreFlag[]; expiresAt: number }>();

export function isStoreFlag(value: unknown): value is StoreFlag {
  return typeof value === 'string' && (STORE_FLAG_NAMES as string[]).includes(value);
}

/** A Store Chat site on a Shopify store is that shop; any other site is
 *  keyed by its own id. */
export function flagStoreForSite(site: { id: string; domain: string | null }): FlagStore {
  const domain = site.domain?.trim().toLowerCase() ?? '';
  return SHOP_DOMAIN_RE.test(domain) ? { shopDomain: domain } : { widgetSiteId: site.id };
}

function validStore(store: FlagStore): FlagStore | null {
  if ('shopDomain' in store) {
    const shopDomain = store.shopDomain.trim().toLowerCase();
    return SHOP_DOMAIN_RE.test(shopDomain) ? { shopDomain } : null;
  }
  return UUID_RE.test(store.widgetSiteId) ? { widgetSiteId: store.widgetSiteId.toLowerCase() } : null;
}

function cacheKey(store: FlagStore): string {
  return 'shopDomain' in store ? `shop:${store.shopDomain}` : `site:${store.widgetSiteId}`;
}

function keyColumn(store: FlagStore): ['shop_domain' | 'widget_site_id', string] {
  return 'shopDomain' in store ? ['shop_domain', store.shopDomain] : ['widget_site_id', store.widgetSiteId];
}

function isMissingTable(error: { code?: string; message?: string }): boolean {
  const message = error.message ?? '';
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    (message.includes('store_flags') && /does not exist|schema cache/.test(message))
  );
}

/** The flags on for this store, in a stable order. Never throws. */
export async function storeFlags(store: FlagStore, now: number = Date.now()): Promise<StoreFlag[]> {
  const valid = validStore(store);
  if (!valid) return [];
  const key = cacheKey(valid);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) return cached.flags;

  try {
    const [column, value] = keyColumn(valid);
    const { data, error } = await getMessengerServiceClient()
      .from('store_flags')
      .select('flag')
      .eq(column, value)
      .eq('enabled', true);
    if (error) {
      /* Until the owner applies the table, every store simply has no flags.
         That answer is cached like any other; a passing database error is
         not, so the next read can recover. */
      if (isMissingTable(error)) cache.set(key, { flags: [], expiresAt: now + CACHE_TTL_MS });
      return [];
    }
    const on = new Set((data ?? []).map((row: { flag?: unknown }) => row.flag));
    const flags = STORE_FLAG_NAMES.filter((flag) => on.has(flag));
    cache.set(key, { flags, expiresAt: now + CACHE_TTL_MS });
    return flags;
  } catch {
    return [];
  }
}

export async function isStoreFlagOn(store: FlagStore, flag: StoreFlag, now: number = Date.now()): Promise<boolean> {
  return (await storeFlags(store, now)).includes(flag);
}

/** Writes one flag. Callers must have checked the platform operator first;
 *  setStoreFlag in app/dashboard/flags/actions.ts is the only one. */
export async function writeStoreFlag(
  store: FlagStore,
  flag: StoreFlag,
  enabled: boolean,
  updatedBy: string,
): Promise<void> {
  const valid = validStore(store);
  if (!valid || !isStoreFlag(flag)) throw new Error('Unknown store or flag.');
  const [column, value] = keyColumn(valid);
  const { error } = await getMessengerServiceClient()
    .from('store_flags')
    .upsert(
      { [column]: value, flag, enabled, updated_by: updatedBy, updated_at: new Date().toISOString() },
      { onConflict: `${column},flag` },
    );
  invalidateStoreFlags(valid);
  if (error) throw new Error(`store_flags write failed: ${error.message}`);
}

/** True when the store is one this app knows: an installed or past Shopify
 *  shop, or an existing Store Chat site. A flag for anything else is refused. */
export async function storeExists(store: FlagStore): Promise<boolean> {
  const valid = validStore(store);
  if (!valid) return false;
  const supabase = getMessengerServiceClient();
  if ('widgetSiteId' in valid) {
    const site = await supabase.from('widget_sites').select('id').eq('id', valid.widgetSiteId).maybeSingle();
    return !site.error && Boolean(site.data);
  }
  const shop = await supabase
    .from('tryon_shops')
    .select('shop_domain')
    .eq('shop_domain', valid.shopDomain)
    .maybeSingle();
  if (!shop.error && shop.data) return true;
  const site = await supabase
    .from('widget_sites')
    .select('id')
    .eq('domain', valid.shopDomain)
    .limit(1)
    .maybeSingle();
  return !site.error && Boolean(site.data);
}

/** Every known flag with its state, for the operator's card. */
export async function storeFlagRows(store: FlagStore): Promise<
  Array<{ flag: StoreFlag; code: string; title: string; enabled: boolean }>
> {
  const on = await storeFlags(store);
  return STORE_FLAG_NAMES.map((flag) => ({ flag, ...STORE_FLAGS[flag], enabled: on.includes(flag) }));
}

export function invalidateStoreFlags(store: FlagStore): void {
  const valid = validStore(store);
  if (valid) cache.delete(cacheKey(valid));
}

/** Test seam. */
export function clearStoreFlagCache(): void {
  cache.clear();
}
