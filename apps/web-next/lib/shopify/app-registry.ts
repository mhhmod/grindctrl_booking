import 'server-only';

/* Multiple legitimate Shopify registrations can share this backend:
   a merchant-specific Custom integration and a future approved Public app,
   each with its own client ID and secret. This registry is not a public
   distribution or review bypass. Every route that verifies something Shopify (or
   we, on Shopify's behalf) signed must check it against the RIGHT app's
   secret, not just the one legacy pair.

   SHOPIFY_APPS carries the additional apps as JSON:
     '[{"clientId":"...","secret":"..."},{"clientId":"...","secret":"..."}]'
   SHOPIFY_API_KEY/SHOPIFY_API_SECRET stay supported as a fallback entry so
   existing single-app deployments need no change. Duplicate client ids
   (fallback pair reappearing inside SHOPIFY_APPS) resolve to one entry. */

export type ShopifyAppCredentials = { clientId: string; secret: string; distribution?: 'custom' | 'public'; tokenMode?: 'expiring' | 'non-expiring' };

/** Every configured Shopify app, fallback pair included. Recomputed on
 *  every call (env vars are a handful of cheap reads + a short JSON.parse)
 *  rather than cached, so tests that stub different env vars per case never
 *  need to know about or reset a module-level cache. */
export function getConfiguredShopifyApps(): ShopifyAppCredentials[] {
  const apps: ShopifyAppCredentials[] = [];
  const seen = new Set<string>();

  const raw = process.env.SHOPIFY_APPS?.trim();
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const entry of parsed) {
          if (
            entry &&
            typeof entry === 'object' &&
            typeof (entry as Record<string, unknown>).clientId === 'string' &&
            typeof (entry as Record<string, unknown>).secret === 'string'
          ) {
            const clientId = (entry as Record<string, string>).clientId.trim();
            const secret = (entry as Record<string, string>).secret.trim();
            if (clientId && secret && seen.has(clientId) && apps.find(app => app.clientId === clientId)?.secret !== secret) {
              console.error('[shopify] conflicting app registration; refusing configuration');
              return [];
            }
            if (clientId && secret && !seen.has(clientId)) {
              seen.add(clientId);
              const record = entry as Record<string, unknown>;
              // Expiring is the default. Non-expiring is an explicit custom-only opt-in.
              if (record.tokenMode === 'non-expiring' && record.distribution !== 'custom') continue;
              apps.push({ clientId, secret,
                ...(record.distribution === 'custom' || record.distribution === 'public' ? { distribution: record.distribution } : {}),
                ...(record.tokenMode === 'expiring' || record.tokenMode === 'non-expiring' ? { tokenMode: record.tokenMode } : {}),
              });
            }
          }
        }
      } else {
        console.error('[shopify] SHOPIFY_APPS must be a JSON array; ignoring it');
      }
    } catch {
      console.error('[shopify] SHOPIFY_APPS is not valid JSON; ignoring it');
    }
  }

  const fallbackId = process.env.SHOPIFY_API_KEY?.trim();
  const fallbackSecret = process.env.SHOPIFY_API_SECRET?.trim();
  if (fallbackId && fallbackSecret && seen.has(fallbackId) && apps.find(app => app.clientId === fallbackId)?.secret !== fallbackSecret) return [];
  if (fallbackId && fallbackSecret && !seen.has(fallbackId)) {
    seen.add(fallbackId);
    apps.push({ clientId: fallbackId, secret: fallbackSecret });
  }

  if (new Set(apps.map(app => app.secret)).size !== apps.length) {
    console.error('[shopify] app secrets must be distinct; refusing configuration');
    return [];
  }
  return apps;
}

export function findShopifyAppByClientId(clientId: string): ShopifyAppCredentials | null {
  return getConfiguredShopifyApps().find((app) => app.clientId === clientId) ?? null;
}

/** Compatibility-only initializer when no signed app context exists.
 *  Preserve single-app configuration; never guess among registrations.
 *  Core demo and claim capabilities use the independent core key. */
export function primaryShopifyApp(): ShopifyAppCredentials | null {
  const apps = getConfiguredShopifyApps();
  return apps.length === 1 ? apps[0] : null;
}

/** Tries `verify` against every configured app's secret and
 *  returns the sole verified match. `verify` must be a pure
 *  function of the secret (a signature/HMAC check or similar) — safe to
 *  call once per configured app, since the app count is small and fixed. */
export function resolveShopifyApp<T>(
  verify: (secret: string) => T | null | undefined | false,
): { app: ShopifyAppCredentials; value: T } | null {
  let matched: { app: ShopifyAppCredentials; value: T } | null = null;
  for (const app of getConfiguredShopifyApps()) {
    const value = verify(app.secret);
    if (value) {
      if (matched) return null; // Shared secrets cannot establish app provenance.
      matched = { app, value: value as T };
    }
  }
  return matched;
}
