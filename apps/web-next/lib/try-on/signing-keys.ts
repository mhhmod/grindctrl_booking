import 'server-only';
import { createHmac } from 'node:crypto';
import { coreCapabilitySecret } from '@/lib/security/capability-key';
import { resolveShopifyApp, type ShopifyAppCredentials } from '@/lib/shopify/app-registry';
import { getMessengerServiceClient } from '@/lib/messenger/db';
import { isSiteTenantKey } from '@/lib/tenancy/tenant-key';
import type { StorefrontContextClaims, VerifiedTryOnSession } from './storefront-context';
import { getPasteConnection, isPasteTrusted } from '@/lib/paste/store';
import { pasteCapabilitySecret, PASTE_APP_CLIENT_ID } from '@/lib/paste/signing';

/** Separate trust domains: a core demo token cannot become a billable shop
 * capability; an app secret cannot mint a platform-neutral public demo. */
export function resolveTryOnSessionKey(verify: (secret: string) => VerifiedTryOnSession | null) {
  const core = coreCapabilitySecret();
  const demo = core ? verify(core) : null;
  if (demo?.purpose === 'public-demo') return { app: { clientId: 'grindctrl-core', secret: core! }, value: demo };
  // A Shopify app secret never vouches for a WooCommerce site tenant.
  const platform = resolveShopifyApp((secret) => {
    const value = verify(secret);
    return value && value.platform === undefined ? value : null;
  });
  return platform && platform.value.purpose !== 'public-demo' ? platform : null;
}

/** Shopify app secrets only vouch for Shopify contexts. */
export function resolveShopifyStorefrontContext(
  verify: (secret: string) => StorefrontContextClaims | null,
) {
  return resolveShopifyApp((secret) => {
    const value = verify(secret);
    return value && value.platform === undefined ? value : null;
  });
}

const SITE_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** The WooCommerce storefront trust domain: one key per site and secret
 * version, derived from the core key under its own label. It is not the
 * pairing secret and not a Shopify app secret, so none of them can mint or
 * replay another's capabilities. Rotating the site secret retires it. */
export function wooTryOnKey(siteId: string, secretVersion: number): string | null {
  if (!SITE_UUID_RE.test(siteId) || !Number.isSafeInteger(secretVersion) || secretVersion < 1) return null;
  const core = coreCapabilitySecret();
  if (!core) return null;
  return createHmac('sha256', core)
    .update(`tryon:woo:${siteId}:v${secretVersion}`, 'utf8')
    .digest('base64url');
}

export const WOO_APP_CLIENT_ID = 'grindctrl-woo';

export type WooTryOnKey = {
  app: Pick<ShopifyAppCredentials, 'clientId' | 'secret'>;
  siteId: string;
};

/** Current key for a site, or null when the site has no connection or the
 * read fails (callers deny). A disconnected site still has a key so its
 * already-minted tokens verify; the active-tenant check denies spend. */
export async function wooTryOnKeyForSite(siteId: string): Promise<WooTryOnKey | null> {
  if (!SITE_UUID_RE.test(siteId)) return null;
  try {
    const { data, error } = await getMessengerServiceClient()
      .from('woo_site_connections')
      .select('secret_version')
      .eq('widget_site_id', siteId)
      .maybeSingle();
    const version = (data as { secret_version?: unknown } | null)?.secret_version;
    if (error || typeof version !== 'number') return null;
    const secret = wooTryOnKey(siteId, version);
    return secret ? { app: { clientId: WOO_APP_CLIENT_ID, secret }, siteId } : null;
  } catch {
    return null;
  }
}

/** Reads the unverified `shop` claim only to choose which site key to
 * verify with; the HMAC check that follows is what authenticates it. */
function unverifiedSiteId(token: string): string | null {
  if (!token || token.length > 4096) return null;
  const part = token.split('.')[1];
  if (!part) return null;
  try {
    const payload = JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as { shop?: unknown };
    return isSiteTenantKey(payload.shop) ? payload.shop.slice('site:'.length) : null;
  } catch {
    return null;
  }
}

/** Resolves the key for any try-on capability token: the sync Shopify and
 * core paths first, then the WooCommerce site named in the token. A Woo
 * result must carry the Woo platform and the site the key was derived for. */
export async function resolveAnyTryOnSessionKey(
  token: string,
  verify: (secret: string) => VerifiedTryOnSession | null,
) {
  const sync = resolveTryOnSessionKey(verify);
  if (sync) return sync;
  const siteId = unverifiedSiteId(token);
  if (!siteId) return null;
  const paste = await resolvePasteKey(siteId, verify);
  if (paste) return paste;
  const key = await wooTryOnKeyForSite(siteId);
  if (!key) return null;
  const value = verify(key.app.secret);
  if (!value || value.platform !== 'woocommerce' || value.shop !== `site:${siteId}`) return null;
  return { app: key.app, value };
}

/** Same, for a signed storefront context. */
export async function resolveAnyStorefrontContextKey(
  token: string,
  verify: (secret: string) => StorefrontContextClaims | null,
) {
  const shopify = resolveShopifyStorefrontContext(verify);
  if (shopify) return shopify;
  const siteId = unverifiedSiteId(token);
  if (!siteId) return null;
  const paste = await resolvePasteKey(siteId, verify);
  if (paste) return paste;
  const key = await wooTryOnKeyForSite(siteId);
  if (!key) return null;
  const value = verify(key.app.secret);
  if (!value || value.platform !== 'woocommerce' || value.shop !== `site:${siteId}`) return null;
  return { app: key.app, value };
}

async function resolvePasteKey<T extends StorefrontContextClaims | VerifiedTryOnSession>(
  siteId: string, verify: (secret: string) => T | null,
) {
  try {
    const secret = pasteCapabilitySecret(siteId);
    if (!secret) return null;
    const value = verify(secret);
    // Verify the HMAC before reading a connection; Woo tokens never add a
    // database dependency on the new optional paste migration.
    if (!value || value.shop !== `site:${siteId}` || !value.platform?.startsWith('paste-')) return null;
    const connection = await getPasteConnection(siteId);
    if (!isPasteTrusted(connection) || value.platform !== `paste-${connection.platform}`) return null;
    return { app: { clientId: PASTE_APP_CLIENT_ID, secret }, value };
  } catch { return null; }
}
