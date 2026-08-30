'use client';

declare global {
  interface Window {
    shopify?: { idToken(): Promise<string> };
  }
}

/** App Bridge's script tag loads synchronously but not instantly relative to
 *  React mounting; poll up to 5s rather than assume it's ready immediately. */
export async function getShopifySessionToken(): Promise<string> {
  for (let i = 0; i < 50 && !window.shopify; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!window.shopify) throw new Error('App Bridge not ready');
  return window.shopify.idToken();
}
