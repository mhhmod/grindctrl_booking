'use client';

import { getShopifySessionToken } from '@/lib/shopify/app-bridge-client';
import type { ShopifyAppPricingPresentation } from '@/lib/shopify/app-pricing';

export type ShopifyBootstrap = {
  ok: true;
  appClientId: string;
  appPricing: ShopifyAppPricingPresentation | null;
};

/** Ensures this shop has a stored Admin API token via Shopify's token-
 *  exchange grant, using the App Bridge session token already available in
 *  the embedded admin -- no redirect. Called directly from app-shell.tsx,
 *  which awaits it (success or failure) before mounting AutoClaim -- that
 *  ordering is what actually matters, see app-shell.tsx's comment. A
 *  failure here (App Bridge not ready yet, a transient network issue) is
 *  swallowed by the caller; the next embedded-admin page load retries
 *  automatically, same tolerance the sibling claim flow already has. */
export async function ensureShopToken(): Promise<ShopifyBootstrap> {
  const token = await getShopifySessionToken();
  const response = await fetch('/api/shopify/session-bootstrap', {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error('Shopify bootstrap failed');
  return response.json() as Promise<ShopifyBootstrap>;
}
