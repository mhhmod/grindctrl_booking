import 'server-only';

import { adminGraphql } from './admin';
import { getShopToken } from './tokens';

/** Null means the owner could not be verified. Claim redemption must treat
 *  every null result as a denial, whether the token is absent, Shopify is
 *  unavailable, or the shop has no contact email. */
export async function getShopOwnerEmail(shopDomain: string): Promise<string | null> {
  const stored = await getShopToken(shopDomain);
  if (!stored) return null;

  try {
    const data = await adminGraphql<{ shop: { email: string | null } }>({
      shopDomain,
      accessToken: stored.accessToken,
      query: `query ShopOwnerEmail { shop { email } }`,
    });
    return data.shop.email ?? null;
  } catch {
    return null;
  }
}
