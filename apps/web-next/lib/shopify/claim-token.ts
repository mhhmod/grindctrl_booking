import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/* Short-lived proof that someone opened this store's Shopify admin.
   Same construction as signShopperToken in lib/messenger/identity.ts —
   HS256 over base64url, no dependencies — because it is the same threat:
   a bearer string handed to a browser that must not be forgeable.

   It authorizes exactly one thing: adopting THIS shop's configuration
   into whichever workspace redeems it. It carries no account, no role,
   and nothing that survives its five minutes. */

const ISSUER = 'grindctrl-shop-claim';
export const CLAIM_TTL_SECONDS = 300;

const SHOP_RE = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;

interface ClaimPayload {
  iss: string;
  shop: string;
  iat: number;
  exp: number;
  jti: string;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function sign(secret: string, data: string): string {
  return createHmac('sha256', secret).update(data, 'utf8').digest('base64url');
}

export function signClaimToken(secret: string, shop: string): string {
  if (!SHOP_RE.test(shop)) throw new Error(`Refusing to mint a claim for "${shop}"`);
  const now = Math.floor(Date.now() / 1000);
  const payload: ClaimPayload = {
    iss: ISSUER,
    shop,
    iat: now,
    exp: now + CLAIM_TTL_SECONDS,
    // Distinct per mint, so one claim link is never mistaken for another.
    jti: randomBytes(12).toString('hex'),
  };
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

  let payload: ClaimPayload;
  try {
    payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  if (payload.iss !== ISSUER) return null;
  if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return null;
  // Re-validated on the way out: the shop decides which row gets adopted.
  if (typeof payload.shop !== 'string' || !SHOP_RE.test(payload.shop)) return null;

  return { shop: payload.shop };
}
