import 'server-only';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { coreCapabilitySecret } from '@/lib/security/capability-key';
import { siteTenantKey } from '@/lib/tenancy/tenant-key';

export const STATE_TTL_SECONDS = 600;
/** Matches the SQL staging window in stage_easyorders_install. */
export const STAGE_TTL_SECONDS = 900;
export const hash = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');
export const newToken = () => randomBytes(32).toString('hex');
export type InstallState = { siteId: string; userId: string; nonce: string; exp: number };

// Same purpose-separated HMAC derivation as Woo site-secret and paste signing.
function signingKey(): Buffer {
  const core = coreCapabilitySecret();
  if (!core) throw new Error('capability_unavailable');
  return createHmac('sha256', core).update('easyorders:install-state:v1').digest();
}
export function signInstallState(siteId: string, userId: string, now = Math.floor(Date.now() / 1000)) {
  siteTenantKey(siteId);
  if (!userId || userId.length > 256) throw new Error('invalid_user');
  const claims: InstallState = { siteId, userId, nonce: newToken(), exp: now + STATE_TTL_SECONDS };
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  return { claims, state: `${payload}.${createHmac('sha256', signingKey()).update(payload).digest('hex')}` };
}
/** `graceSeconds` lets the dashboard return accept a link whose callback
 *  window closed but whose staged credential may still be awaiting
 *  confirmation; the database expiry stays authoritative. */
export function verifyInstallState(state: unknown, now = Math.floor(Date.now() / 1000), graceSeconds = 0): InstallState | null {
  if (typeof state !== 'string' || state.length > 2048) return null;
  const [payload, mac, extra] = state.split('.');
  if (!payload || !mac || extra !== undefined || !/^[a-f0-9]{64}$/.test(mac)) return null;
  const expected = createHmac('sha256', signingKey()).update(payload).digest();
  if (!timingSafeEqual(expected, Buffer.from(mac, 'hex'))) return null;
  try {
    const c = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as InstallState;
    siteTenantKey(c.siteId);
    if (typeof c.userId !== 'string' || !c.userId || c.userId.length > 256 || !/^[a-f0-9]{64}$/.test(c.nonce)
      || !Number.isSafeInteger(c.exp) || c.exp + graceSeconds <= now || c.exp > now + STATE_TTL_SECONDS) return null;
    return c;
  } catch { return null; }
}
