import 'server-only';

/* Multiple Shopify apps in play: today's single custom app
   (SHOPIFY_API_KEY/SHOPIFY_API_SECRET, one pair per shopify.app.toml) plus
   any number of additional per-store custom apps, each with its own
   client id and secret. Every route that verifies something Shopify (or
   we, on Shopify's behalf) signed must check it against the RIGHT app's
   secret, not just the one legacy pair.

   SHOPIFY_APPS carries the additional apps as JSON:
     '[{"clientId":"...","secret":"..."},{"clientId":"...","secret":"..."}]'
   SHOPIFY_API_KEY/SHOPIFY_API_SECRET stay supported as a fallback entry so
   existing single-app deployments need no change. Duplicate client ids
   (fallback pair reappearing inside SHOPIFY_APPS) resolve to one entry. */

export type ShopifyAppCredentials = { clientId: string; secret: string };

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
            if (clientId && secret && !seen.has(clientId)) {
              seen.add(clientId);
              apps.push({ clientId, secret });
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
  if (fallbackId && fallbackSecret && !seen.has(fallbackId)) {
    seen.add(fallbackId);
    apps.push({ clientId: fallbackId, secret: fallbackSecret });
  }

  return apps;
}

export function findShopifyAppByClientId(clientId: string): ShopifyAppCredentials | null {
  return getConfiguredShopifyApps().find((app) => app.clientId === clientId) ?? null;
}

/** The app used for capabilities that carry no cryptographic signal of
 *  which app they belong to (the public try-on demo, the legacy
 *  compatibility bridge, and the store-claim handoff token): the first
 *  configured app, so a single-app deployment behaves exactly as before. */
export function primaryShopifyApp(): ShopifyAppCredentials | null {
  return getConfiguredShopifyApps()[0] ?? null;
}

/** Tries `verify` against every configured app's secret, in order, and
 *  returns the first app whose secret it accepts. `verify` must be a pure
 *  function of the secret (a signature/HMAC check or similar) — safe to
 *  call once per configured app, since the app count is small and fixed. */
export function resolveShopifyApp<T>(
  verify: (secret: string) => T | null | undefined | false,
): { app: ShopifyAppCredentials; value: T } | null {
  for (const app of getConfiguredShopifyApps()) {
    const value = verify(app.secret);
    if (value) return { app, value: value as T };
  }
  return null;
}
