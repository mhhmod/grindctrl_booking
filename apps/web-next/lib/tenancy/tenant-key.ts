import { normalizeShopDomain } from '@/lib/shopify/shop-authorization';

const SITE_TENANT_PREFIX = 'site:';
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type TenantPlatform = 'shopify' | 'site';

/** Build the reserved, canonical tenant key for a widget site. */
export function siteTenantKey(siteId: string): string {
  const normalizedSiteId = siteId.trim().toLowerCase();
  if (!UUID_PATTERN.test(normalizedSiteId)) {
    throw new TypeError('Invalid widget site id');
  }
  return `${SITE_TENANT_PREFIX}${normalizedSiteId}`;
}

/** True only for an already-canonical site tenant key. */
export function isSiteTenantKey(key: unknown): key is string {
  return typeof key === 'string'
    && key.startsWith(SITE_TENANT_PREFIX)
    && UUID_PATTERN.test(key.slice(SITE_TENANT_PREFIX.length));
}

/** Normalize either supported tenant namespace without widening Shopify's
 * SSRF boundary. */
export function normalizeTenantKey(input: unknown): string | null {
  const shopDomain = normalizeShopDomain(input);
  if (shopDomain) return shopDomain;
  if (typeof input !== 'string') return null;

  const candidate = input.trim().toLowerCase();
  return isSiteTenantKey(candidate) ? candidate : null;
}

/** Identify the namespace encoded by a tenant key. Site keys deliberately do
 * not guess whether the persisted connection is WooCommerce or WordPress. */
export function tenantPlatform(key: unknown): TenantPlatform | null {
  const normalized = normalizeTenantKey(key);
  if (!normalized) return null;
  return isSiteTenantKey(normalized) ? 'site' : 'shopify';
}
