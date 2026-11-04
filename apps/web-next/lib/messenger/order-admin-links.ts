/* Where the team opens an order or a customer in the store's own admin.
   Pure and client-safe: the Inbox column and the order providers share it. */

export type AdminLinkTarget =
  | { kind: 'shopify'; shopDomain: string }
  | { kind: 'woocommerce'; homeUrl: string };

export function adminLinkTarget(input: {
  shopDomain: string | null;
  wooHomeUrl?: string | null;
}): AdminLinkTarget | null {
  if (input.shopDomain && /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(input.shopDomain)) {
    return { kind: 'shopify', shopDomain: input.shopDomain };
  }
  if (input.wooHomeUrl) return { kind: 'woocommerce', homeUrl: input.wooHomeUrl };
  return null;
}

function wooBase(homeUrl: string): string | null {
  try {
    const url = new URL(homeUrl);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    return `${url.origin}${url.pathname.replace(/\/+$/, '')}/wp-admin`;
  } catch {
    return null;
  }
}

/** `ref` is the platform's own order id when the card carries one. The
 *  WooCommerce post.php address also reaches the order on HPOS stores, which
 *  redirect it to their order screen. */
export function adminOrderUrl(target: AdminLinkTarget | null, order: { name: string; ref?: string }): string | null {
  if (!target) return null;
  if (target.kind === 'shopify') {
    const store = target.shopDomain.replace(/\.myshopify\.com$/, '');
    return `https://admin.shopify.com/store/${store}/orders?query=${encodeURIComponent(order.name)}`;
  }
  const base = wooBase(target.homeUrl);
  return base && order.ref && /^\d{1,15}$/.test(order.ref) ? `${base}/post.php?post=${order.ref}&action=edit` : null;
}

export function adminCustomerUrl(target: AdminLinkTarget | null, customerId: string | null): string | null {
  if (!target || !customerId || !/^\d{1,20}$/.test(customerId)) return null;
  if (target.kind === 'shopify') {
    return `https://admin.shopify.com/store/${target.shopDomain.replace(/\.myshopify\.com$/, '')}/customers/${customerId}`;
  }
  const base = wooBase(target.homeUrl);
  return base ? `${base}/user-edit.php?user_id=${customerId}` : null;
}
