import 'server-only';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { coreCapabilitySecret } from '@/lib/security/capability-key';
import { siteTenantKey } from '@/lib/tenancy/tenant-key';
import { pasteRedis, scriptCount } from './redis';
import type { PasteConnection } from './types';

export const PASTE_SIGNATURE_WINDOW_SECONDS = 15 * 60;
export const PASTE_CLOCK_SKEW_SECONDS = 30;
export const PASTE_APP_CLIENT_ID = 'grindctrl-paste';

function derive(siteId: string, version: number, purpose: 'liquid' | 'capability'): string | null {
  try { siteTenantKey(siteId); } catch { return null; }
  if (!Number.isSafeInteger(version) || version < 1) return null;
  const core = coreCapabilitySecret();
  return core ? createHmac('sha256', core).update(`paste:${purpose}:${siteId}:v${version}`, 'utf8').digest('base64url') : null;
}

/** Only the Liquid derived secret appears in the owner-generated snippet.
 * It cannot sign a storefront capability, Woo request or another site. */
export function pasteLiquidSecret(siteId: string, version: number): string | null { return derive(siteId, version, 'liquid'); }
export function pasteCapabilitySecret(siteId: string): string | null { return derive(siteId, 1, 'capability'); }

export type LiquidClaims = {
  siteId: string;
  shopDomain: string;
  productId: string;
  variantId: string;
  issuedAt: string;
  customerId: string;
};

/** ASCII fields only; no escaping, whitespace or trailing newline. Empty
 * customer id is the final empty field, so the anonymous string ends in |.
 * v1 is the protocol version, independent of the rotated secret version. */
export function liquidSignedMessage(input: LiquidClaims): string {
  return ['gc-paste-v1', input.siteId, input.shopDomain, input.productId, input.variantId, input.issuedAt, input.customerId].join('|');
}

/** True when `signature` (64 lowercase hex) is the Liquid MAC of `claims`
 *  under the connection's current secret, or its previous one during the
 *  rotation overlap. Null when no secret can be derived. Checks the MAC
 *  only: callers validate the claims themselves. */
export function liquidMacMatches(connection: PasteConnection, claims: LiquidClaims, signature: string, nowSeconds: number): boolean | null {
  if (!/^[a-f0-9]{64}$/.test(signature)) return false;
  const versions = [connection.secret_version];
  if (connection.previous_secret_version && connection.previous_valid_until
    && Date.parse(connection.previous_valid_until) > nowSeconds * 1000) {
    versions.push(connection.previous_secret_version);
  }
  let matched = false;
  for (const version of versions) {
    const secret = pasteLiquidSecret(claims.siteId, version);
    if (!secret) return null;
    const expected = createHmac('sha256', secret).update(liquidSignedMessage(claims), 'utf8').digest();
    matched = timingSafeEqual(expected, Buffer.from(signature, 'hex')) || matched;
  }
  return matched;
}

export type SignatureResult ={ ok: true } | { ok: false; code: 'bad_signature' | 'stale_signature' | 'replayed' | 'unavailable' };
/** Counts one more use of `key`, expiring it `ttlSeconds` after the first,
 *  and resolves with the count. Rejects when the count is unknown. */
export type RenderUseCounter = (key: string, ttlSeconds: number) => Promise<number>;

/** Shopper sessions one signed render may mint within its freshness window.
 *  A shopper needs one or two (prewarm, then a tap after the context aged
 *  out); a page served from the store's cache to several shoppers runs out
 *  and the loader fetches a fresh render. */
export const PASTE_RENDER_MAX_SESSIONS = 3;

const COUNT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], tonumber(ARGV[1])) end
return count`;

const countRenderUse: RenderUseCounter = async (key, ttlSeconds) =>
  scriptCount(await pasteRedis().eval(COUNT_SCRIPT, [key], [String(ttlSeconds)]));

export async function verifyLiquidSignature(input: {
  connection: PasteConnection; claims: LiquidClaims; signature: string;
}, options: { nowSeconds?: number; count?: RenderUseCounter } = {}): Promise<SignatureResult> {
  const { connection: c, claims: p, signature } = input;
  // A pending connection is verified too: a valid render is the second
  // proof factor (record_paste_shop_render). It is never proof of theme
  // control by itself; the storefront fetch in shop-proof.ts is.
  if (c.platform !== 'shopify' || c.status === 'disconnected' || c.app_installed || p.siteId !== c.widget_site_id
    || p.shopDomain !== c.shop_domain || !/^[1-9]\d{0,19}$/.test(p.productId)
    || !/^[1-9]\d{0,19}$/.test(p.variantId) || !/^\d{1,12}$/.test(p.issuedAt)
    || (p.customerId !== '' && !/^[1-9]\d{0,19}$/.test(p.customerId)) || !/^[a-f0-9]{64}$/.test(signature)) {
    return { ok: false, code: 'bad_signature' };
  }
  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  const issuedAt = Number(p.issuedAt);
  if (issuedAt > now + PASTE_CLOCK_SKEW_SECONDS || now - issuedAt > PASTE_SIGNATURE_WINDOW_SECONDS) {
    return { ok: false, code: 'stale_signature' };
  }
  const matched = liquidMacMatches(c, p, signature, now);
  if (matched === null) return { ok: false, code: 'unavailable' };
  if (!matched) return { ok: false, code: 'bad_signature' };
  // The render itself is the replay key: nothing the caller chooses (visitor
  // id, network) is in it, so rotating those earns no extra session. Secret
  // version and signature are left out too, so the same render cannot mint
  // again under the rotation overlap.
  const digest = createHash('sha256').update(liquidSignedMessage(p)).digest('hex');
  try {
    const uses = await (options.count ?? countRenderUse)(`gc-paste:render:v2:${p.siteId}:${digest}`,
      PASTE_SIGNATURE_WINDOW_SECONDS + PASTE_CLOCK_SKEW_SECONDS + 1);
    if (!Number.isSafeInteger(uses) || uses < 1) return { ok: false, code: 'unavailable' };
    return uses <= PASTE_RENDER_MAX_SESSIONS ? { ok: true } : { ok: false, code: 'replayed' };
  } catch { return { ok: false, code: 'unavailable' }; }
}
