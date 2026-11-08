import 'server-only';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { Redis } from '@upstash/redis';
import { coreCapabilitySecret } from '@/lib/security/capability-key';
import { siteTenantKey } from '@/lib/tenancy/tenant-key';
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

export type SignatureResult = { ok: true } | { ok: false; code: 'bad_signature' | 'stale_signature' | 'replayed' | 'unavailable' };
export type ReplayClaim = (key: string, ttlSeconds: number) => Promise<boolean>;

async function claimReplay(key: string, ttlSeconds: number): Promise<boolean> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('replay_unavailable');
  const redis = new Redis({ url, token, retry: false, signal: AbortSignal.timeout(5000) });
  const result = await redis.set(key, '1', { nx: true, ex: ttlSeconds });
  if (result !== 'OK' && result !== null) throw new Error('replay_unavailable');
  return result === 'OK';
}

export async function verifyLiquidSignature(input: {
  connection: PasteConnection; claims: LiquidClaims; signature: string;
  /** Trusted network plus browser visitor id. Neither alone bypasses the
   * site-wide and network rate ceilings on the context endpoint. */
  visitor: string;
}, options: { nowSeconds?: number; claim?: ReplayClaim } = {}): Promise<SignatureResult> {
  const { connection: c, claims: p, signature } = input;
  if (c.platform !== 'shopify' || c.status !== 'active' || p.siteId !== c.widget_site_id
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
  const versions = [c.secret_version];
  if (c.previous_secret_version && c.previous_valid_until && Date.parse(c.previous_valid_until) > now * 1000) {
    versions.push(c.previous_secret_version);
  }
  let matched = false;
  for (const version of versions) {
    const secret = pasteLiquidSecret(p.siteId, version);
    if (!secret) return { ok: false, code: 'unavailable' };
    const expected = createHmac('sha256', secret).update(liquidSignedMessage(p), 'utf8').digest();
    matched = timingSafeEqual(expected, Buffer.from(signature, 'hex')) || matched;
  }
  if (!matched) return { ok: false, code: 'bad_signature' };
  // Do not include secret version: the same render must not earn another
  // mint during the overlap. Signature is omitted for the same reason.
  const digest = createHash('sha256').update(`${liquidSignedMessage(p)}\n${input.visitor}`).digest('hex');
  try {
    const claimed = await (options.claim ?? claimReplay)(`gc-paste:render:v1:${p.siteId}:${digest}`,
      PASTE_SIGNATURE_WINDOW_SECONDS + PASTE_CLOCK_SKEW_SECONDS + 1);
    return claimed ? { ok: true } : { ok: false, code: 'replayed' };
  } catch { return { ok: false, code: 'unavailable' }; }
}
