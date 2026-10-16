import {
  clientIp,
  proxyShopMintRatelimit,
  proxyShopReadRatelimit,
  proxyVisitorRatelimit,
  publicApiRatelimit,
} from '@/lib/ratelimit';
import { requireRateLimit } from '@/lib/request-rate-limit';

/* Rate limit keys for the Shopify App Proxy routes (/apps/grindctrl/*).

   Those requests reach us from Shopify's servers, so the network address
   is Shopify's egress, shared by every shopper of every store: keyed by
   address, a handful of shoppers anywhere at once exhausted one bucket and
   Try it on failed with "could not be verified". So a signed proxy request
   is keyed by the shop Shopify signed plus the anonymous visitor id the
   storefront script sends, with a ceiling per shop that a visitor cannot
   escape by changing ids. Only a request that is NOT signed (a browser
   calling us directly) keeps the address key. Phase zero item 3. */

export type ProxyRoute = 'config' | 'try-on-context' | 'messenger-identity';

const ROUTE_PREFIX: Record<ProxyRoute, string> = {
  config: 'pc',
  'try-on-context': 'tc',
  'messenger-identity': 'mi',
};

/* Minting a try-on context costs product resolution and an entitlement
   read; the other two are cheap reads. */
const SHOP_CEILING: Record<ProxyRoute, typeof proxyShopReadRatelimit> = {
  config: proxyShopReadRatelimit,
  'try-on-context': proxyShopMintRatelimit,
  'messenger-identity': proxyShopReadRatelimit,
};

const VISITOR_ID_RE = /^[A-Za-z0-9_-]{16,64}$/;

/** The script's anonymous visitor id, or null when absent or malformed. */
export function proxyVisitorId(value: string | null | undefined): string | null {
  return value && VISITOR_ID_RE.test(value) ? value : null;
}

export type ProxyRateLimitKeys =
  | { kind: 'signed'; visitor: string | null; shop: string }
  | { kind: 'direct'; address: string };

/** Pure key function, exported for tests. */
export function proxyRateLimitKeys(input: {
  route: ProxyRoute;
  /** The shop from a VERIFIED proxy signature, or null when unsigned. */
  signedShop: string | null;
  visitorId: string | null;
  address: string | null;
}): ProxyRateLimitKeys {
  const prefix = ROUTE_PREFIX[input.route];
  if (!input.signedShop) {
    // The same key as before visitor ids, so direct callers keep their budget.
    return { kind: 'direct', address: `${prefix}:${input.address ?? 'unknown'}` };
  }
  return {
    kind: 'signed',
    visitor: input.visitorId ? `${prefix}:${input.signedShop}:${input.visitorId}` : null,
    shop: `${prefix}:${input.signedShop}`,
  };
}

/** Throws RequestRateLimitError (429, or 503 when enforcement is down). */
export async function requireProxyRateLimit(
  request: Request,
  input: { route: ProxyRoute; signedShop: string | null; visitorId: string | null },
): Promise<void> {
  const keys = proxyRateLimitKeys({ ...input, address: clientIp(request) });
  if (keys.kind === 'direct') {
    await requireRateLimit(publicApiRatelimit, keys.address);
    return;
  }
  // A script deployed before visitor ids existed sends none; the shop's
  // ceiling still applies to it.
  if (keys.visitor) await requireRateLimit(proxyVisitorRatelimit, keys.visitor);
  await requireRateLimit(SHOP_CEILING[input.route], keys.shop);
}
