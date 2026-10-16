import { TRYON_LOCALES } from '@/lib/try-on/i18n';

/* The App Proxy config route (/apps/grindctrl/config) is unauthenticated
   and each uncached call costs about six Supabase queries, so answers are
   kept in memory for a minute. That minute used to apply to the Try it on
   button too: a store whose last look was just used kept showing the
   button, and one that just bought looks kept hiding it. So every path
   that changes a shop's looks, plan or install clears the shop's entries.

   The cache lives in this process. Production runs one Next.js server, so
   clearing here reaches every request; a second process would only fall
   back to the one-minute expiry. */
const CACHE_TTL_MS = 60_000;
const CACHE_MAX_ENTRIES = 200;
const responseCache = new Map<string, { expires: number; body: Record<string, unknown> }>();

export function proxyConfigCacheKey(shop: string | null, locale: string): string {
  return `${shop ?? 'default'}:${locale}`;
}

export function cachedProxyConfig(key: string): Record<string, unknown> | null {
  const hit = responseCache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expires) {
    responseCache.delete(key);
    return null;
  }
  // Refresh insertion order so the map itself acts as an LRU eviction queue.
  responseCache.delete(key);
  responseCache.set(key, hit);
  return hit.body;
}

export function storeProxyConfig(key: string, body: Record<string, unknown>): void {
  while (responseCache.size >= CACHE_MAX_ENTRIES) {
    const oldest = responseCache.keys().next().value;
    if (oldest === undefined) break;
    responseCache.delete(oldest);
  }
  responseCache.set(key, { expires: Date.now() + CACHE_TTL_MS, body });
}

/** Drop every cached config answer for a shop, in every language. */
export function invalidateProxyConfig(shop: string | null | undefined): void {
  if (!shop) return;
  for (const locale of TRYON_LOCALES) responseCache.delete(proxyConfigCacheKey(shop, locale));
}

/** Test seam: forget everything. */
export function clearProxyConfigCache(): void {
  responseCache.clear();
}
