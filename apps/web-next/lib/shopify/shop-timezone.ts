import 'server-only';

import { adminGraphql } from './admin';
import { getShopToken } from './tokens';

/* The store's own time zone, from the Admin API (v16 phase zero item 7).
   Opening hours default to it instead of UTC. Cached for an hour per shop;
   never throws, since a missing suggestion only means the picker starts
   where it always did. */

const QUERY = `query GrindctrlShopTimezone { shop { ianaTimezone } }`;
const TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, { timezone: string | null; expiresAt: number }>();

function knownZone(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return value;
  } catch {
    return null;
  }
}

export async function getShopTimezone(shop: string, now: number = Date.now()): Promise<string | null> {
  const cached = cache.get(shop);
  if (cached && cached.expiresAt > now) return cached.timezone;
  try {
    const token = await getShopToken(shop);
    if (!token) return null;
    const data = await adminGraphql<{ shop: { ianaTimezone: string | null } }>({
      shopDomain: shop,
      accessToken: token.accessToken,
      query: QUERY,
    });
    const timezone = knownZone(data.shop.ianaTimezone);
    cache.set(shop, { timezone, expiresAt: now + TTL_MS });
    return timezone;
  } catch {
    return null;
  }
}

/** Test seam. */
export function clearShopTimezoneCache(): void {
  cache.clear();
}
