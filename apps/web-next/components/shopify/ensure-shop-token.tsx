'use client';

import { useEffect } from 'react';
import { getShopifySessionToken } from '@/lib/shopify/app-bridge-client';

/** Ensures this shop has a stored Admin API token via Shopify's token-
 *  exchange grant, using the App Bridge session token already available in
 *  the embedded admin -- no redirect. Shared by the automatic effect and any
 *  future manual retry, same shape as auto-claim.tsx's startShopifyClaim. */
export async function ensureShopToken(): Promise<void> {
  const token = await getShopifySessionToken();
  await fetch('/api/shopify/session-bootstrap', {
    headers: { authorization: `Bearer ${token}` },
  });
}

export function EnsureShopToken(): null {
  useEffect(() => {
    void ensureShopToken().catch(() => {
      // App Bridge may not be ready yet, or the exchange failed transiently.
      // The next embedded-admin page load retries automatically -- same
      // tolerance as the sibling AutoClaim effect.
    });
  }, []);

  return null;
}
