import 'server-only';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { coreCapabilitySecret } from '@/lib/security/capability-key';
import { getMessengerServiceClient } from '@/lib/messenger/db';
import { isActiveTenant } from '@/lib/shopify/tokens';
import { invalidateProxyConfig } from '@/lib/shopify/proxy-config-cache';
import { validSpotSelector, type PickSpot, type SpotPosition } from './placement';

/* The one-time link that opens Pick a spot on a store (Pack B, B2).

   token = <row id>.<expiry ms>.<HMAC(id, expiry, store origin)>

   Created only by a dashboard action that checked the settings right. The
   signature binds the link to the store origin it was made for, so the
   routes can answer that origin (CORS) without a database read and answer
   nobody else. The row makes it single use: the first store tab that
   verifies claims it with a random value only that tab holds (a link copied
   out of the address bar by an analytics script is then useless), and Save
   consumes it in the same transaction that stores the spot. */

export const PICK_TTL_MS = 30 * 60 * 1000;
const TOKEN = /^([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.(\d{13})\.([A-Za-z0-9_-]{43})$/;
const CLAIM = /^[A-Za-z0-9_-]{32,128}$/;

export type PickPreset = { selector: string; position: SpotPosition };
export type PickCheck =
  | { ok: true; id: string; shop: string; preset: PickPreset | null }
  /** cors: the link was signed for this origin, so the store tab may read the refusal. */
  | { ok: false; cors: boolean };

function sign(id: string, expiry: string, origin: string): string {
  const secret = coreCapabilitySecret();
  if (!secret) throw new Error('pick signing unavailable');
  return createHmac('sha256', secret).update(`grindctrl:pick-spot:v1:${id}.${expiry}.${origin}`).digest('base64url');
}

export function isStoreOrigin(origin: unknown): origin is string {
  if (typeof origin !== 'string' || origin.length > 300) return false;
  try {
    const url = new URL(origin);
    return url.protocol === 'https:' && url.origin === origin && !url.username && !url.password;
  } catch {
    return false;
  }
}

export async function createPickToken(input: {
  shop: string;
  origin: string;
  createdBy: string;
  preset?: PickPreset | null;
  now?: number;
}): Promise<{ token: string; expiresAt: string }> {
  const now = input.now ?? Date.now();
  if (!input.shop || input.shop === 'default' || !input.createdBy || !isStoreOrigin(input.origin)) {
    throw new Error('invalid pick scope');
  }
  if (input.preset && !validSpotSelector(input.preset.selector)) throw new Error('invalid selector');
  const id = randomUUID();
  const expiry = String(now + PICK_TTL_MS);
  const token = `${id}.${expiry}.${sign(id, expiry, input.origin)}`;
  const expiresAt = new Date(Number(expiry)).toISOString();
  const { error } = await getMessengerServiceClient().from('tryon_pick_tokens').insert({
    id,
    shop: input.shop,
    origin: input.origin,
    created_by: input.createdBy,
    preset: input.preset ? { selector: input.preset.selector, position: input.preset.position } : null,
    expires_at: expiresAt,
  });
  if (error) throw new Error('pick storage unavailable');
  return { token, expiresAt };
}

/** Signature and expiry only: no database read. */
function readToken(token: unknown, origin: string, now: number): { id: string; live: boolean } | null {
  if (typeof token !== 'string' || !isStoreOrigin(origin)) return null;
  const match = TOKEN.exec(token);
  if (!match) return null;
  const [, id, expiry, mac] = match;
  const expected = Buffer.from(sign(id, expiry, origin));
  const actual = Buffer.from(mac);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  const exp = Number(expiry);
  return { id, live: exp > now && exp <= now + PICK_TTL_MS };
}

export function claimHash(claim: unknown): string | null {
  return typeof claim === 'string' && CLAIM.test(claim) ? createHash('sha256').update(claim).digest('hex') : null;
}

function parsePreset(value: unknown): PickPreset | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  return validSpotSelector(v.selector) && (v.position === 'before' || v.position === 'after')
    ? { selector: v.selector, position: v.position }
    : null;
}

/** Verify a store tab's link and claim it for that tab. Not consumed. */
export async function checkPickToken(token: unknown, origin: string, claim: unknown, now = Date.now()): Promise<PickCheck> {
  const read = readToken(token, origin, now);
  if (!read) return { ok: false, cors: false };
  const hash = claimHash(claim);
  if (!read.live || !hash) return { ok: false, cors: true };
  const { data, error } = await getMessengerServiceClient().rpc('claim_tryon_pick_token', {
    p_id: read.id, p_origin: origin, p_claim: hash,
  });
  if (error) throw new Error('pick storage unavailable');
  const row = data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
  const shop = row && typeof row.shop === 'string' ? row.shop : null;
  // A store that disconnected since the link was made can no longer be edited.
  if (!shop || !(await isActiveTenant(shop))) return { ok: false, cors: true };
  return { ok: true, id: read.id, shop, preset: parsePreset(row?.preset) };
}

/** Check the link again, then consume it and store the spot atomically. */
export async function savePickedSpot(
  token: unknown,
  origin: string,
  claim: unknown,
  spot: PickSpot,
): Promise<PickCheck> {
  const checked = await checkPickToken(token, origin, claim);
  if (!checked.ok) return checked;
  const { data, error } = await getMessengerServiceClient().rpc('save_tryon_picked_spot', {
    p_id: checked.id, p_shop: checked.shop, p_origin: origin, p_claim: claimHash(claim), p_spot: spot,
  });
  if (error) throw new Error('pick save unavailable');
  if (data !== true) return { ok: false, cors: true };
  invalidateProxyConfig(checked.shop);
  return checked;
}
