/** Public link helpers. Client IDs select UI only and never grant API access. */
function themeLink(shop: string, block: string, product: boolean, appClientId?: string): string {
  const clientId = appClientId ?? (typeof document !== 'undefined'
    ? document.querySelector('meta[name="shopify-api-key"]')?.getAttribute('content') : null);
  if (!clientId) return `/api/shopify/theme-link?${new URLSearchParams({ shop, block, mode: product ? 'product' : 'embed' })}`;
  const base = `https://${shop}/admin/themes/current/editor`;
  return product
    ? `${base}?template=product&addAppBlockId=${encodeURIComponent(clientId)}/${encodeURIComponent(block)}&target=mainSection`
    : `${base}?context=apps&activateAppId=${encodeURIComponent(clientId)}/${encodeURIComponent(block)}`;
}
export function appEmbedActivationUrl(shop: string, block: string, appClientId?: string): string {
  return themeLink(shop, block, false, appClientId);
}
export function productBlockAddUrl(shop: string, block: string, appClientId?: string): string {
  return themeLink(shop, block, true, appClientId);
}

export function shopifyAdminAppUrl(shop: string): string {
  return `/api/shopify/admin-link?${new URLSearchParams({ shop })}`;
}
