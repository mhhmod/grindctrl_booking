import 'server-only';

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { normalizeShopDomain } from './shop-authorization';

/* Short-lived proof that someone opened this store's Shopify admin.
   Same construction as signShopperToken in lib/messenger/identity.ts —
   HS256 over base64url, no dependencies — because it is the same threat:
   a bearer string handed to a browser that must not be forgeable.

   It authorizes exactly one thing: adopting THIS shop's configuration
   into whichever workspace redeems it. It carries no account, no role,
   and nothing that survives its five minutes. */

const ISSUER = 'grindctrl-shop-claim';
export const CLAIM_TTL_SECONDS = 300;

interface ClaimPayload {
  iss: string;
  shop: string;
  iat: number;
  exp: number;
  jti: string;
}

function b64url(input: string): string {
  return Buffer.from(input).toString('base64url');
}

function sign(secret: string, data: string): string {
  return createHmac('sha256', secret).update(data, 'utf8').digest('base64url');
}

export function signClaimToken(secret: string, rawShop: string): string {
  // A missing SHOPIFY_API_SECRET at runtime must fail loudly here, not mint
  // a token both sides would happily verify with "" as the key.
  if (!secret) throw new Error('Refusing to mint a claim token without a secret');

  // Single source of truth for "which store is this": authorizeDashboardShop
  // (shop-authorization.ts) uses the same normalizer, so a claim can never
  // name a shop the rest of the app would refuse to recognize.
  const shop = normalizeShopDomain(rawShop);
  if (!shop) throw new Error(`Refusing to mint a claim for "${rawShop}"`);

  const now = Math.floor(Date.now() / 1000);
  const payload: ClaimPayload = {
    iss: ISSUER,
    shop,
    iat: now,
    exp: now + CLAIM_TTL_SECONDS,
    // Distinct per mint so the redeemer can BURN this claim after
    // redemption (single-use) — not merely so two links look different.
    // Nothing consumes jti yet; that consumer is the next piece, not dead
    // code left over from here.
    jti: randomBytes(12).toString('hex'),
  };
  // The header is never parsed on verify: alg is hardcoded to HS256 (above
  // and below) and the header bytes are covered by the signature, so there
  // is no alg-confusion surface — e.g. an attacker swapping in "none" or
  // RS256 — for this format to defend against.
  const body = `${b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${b64url(JSON.stringify(payload))}`;
  return `${body}.${sign(secret, body)}`;
}

export function verifyClaimToken(secret: string, token: string): { shop: string } | null {
  if (!secret || !token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const expected = Buffer.from(sign(secret, `${parts[0]}.${parts[1]}`));
  const actual = Buffer.from(parts[2]);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (typeof payload !== 'object' || payload === null) return null;

  // The app secret also signs signShopperToken (12-hour messenger sessions
  // handed to storefront visitors) and Shopify's own session tokens. `iss`
  // is the only thing separating those domains from an ownership transfer —
  // a valid HMAC alone is not proof this token means "claim this store".
  if (payload.iss !== ISSUER) return null;

  // Zero clock skew tolerance, deliberately: this is a 5-minute token
  // minted and redeemed within one request flow, not a session crossing a
  // real client clock — identity.ts allows 30s and session-token.ts allows
  // 5s for exactly that reason, and neither applies here.
  if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) return null;
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;

  // Canonical-form check, not a normalization: a signature is proof of the
  // secret, not proof of the shop, so reject anything the mint side would
  // not have emitted verbatim rather than silently coercing it.
  if (typeof payload.shop !== 'string') return null;
  const normalized = normalizeShopDomain(payload.shop);
  if (!normalized || normalized !== payload.shop) return null;

  // Return the normalized value, not payload.shop: they are provably equal
  // here, but returning the raw field is what would turn a future canonical
  // -check regression into an attacker-controlled shop identity flowing out
  // of this function, instead of a rejected token.
  return { shop: normalized };
}
