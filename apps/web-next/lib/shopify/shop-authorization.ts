export const DEFAULT_TRY_ON_SHOP = 'default';

const SHOP_DOMAIN_PATTERN =
  /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.myshopify\.com$/;

export function normalizeShopDomain(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const domain = value.trim().toLowerCase();
  return SHOP_DOMAIN_PATTERN.test(domain) ? domain : null;
}

export function authorizeDashboardShop(
  selectedShop: unknown,
  installedShopDomains: readonly string[],
): string {
  if (selectedShop === DEFAULT_TRY_ON_SHOP) return DEFAULT_TRY_ON_SHOP;

  const domain = normalizeShopDomain(selectedShop);
  if (!domain || !installedShopDomains.includes(domain)) {
    throw new Error('Unknown Shopify shop');
  }

  return domain;
}
