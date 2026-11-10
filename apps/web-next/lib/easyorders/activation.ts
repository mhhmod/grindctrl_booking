import 'server-only';
import { requireSiteAccess, UnauthorizedError } from '@/lib/messenger/provisioning';
import { RoleNotAllowedError } from '@/lib/rbac/dashboard-policy';
import { easyOrdersRequest } from './client';
import { hash, STAGE_TTL_SECONDS, verifyInstallState, type InstallState } from './state';
import { easyOrdersRpc, loadEasyOrdersConnection, loadEasyOrdersInstall } from './store';
import type { EasyOrdersInstallResult, EasyOrdersInstallState } from './types';

/* The provider callback only stages a key (install.ts stageInstall). It turns
   into this site's connection here, and only for the Clerk user who created
   the link, who still owns the site, while the staged key is unexpired and
   after the provider accepted that key. Anyone else holding the link only
   ever destroys what it staged. */

type Outcome = 'rejected' | 'expired' | 'unverified';
type Activation = { status: 'active' | 'expired' | 'pending' | 'conflict' | 'invalid';
  activated?: boolean; store_id?: string | null; store_name?: string | null };

/** Signed state from the return URL. The callback window may have closed; the
 *  staged credential's own expiry, enforced in SQL, decides. */
export function readReturnState(state: unknown): InstallState | null {
  return verifyInstallState(state, Math.floor(Date.now() / 1000), STAGE_TTL_SECONDS);
}
async function discard(claims: InstallState, outcome: Outcome): Promise<void> {
  await easyOrdersRpc('discard_easyorders_install', { p_site: claims.siteId, p_nonce: hash(claims.nonce), p_outcome: outcome });
}

/** EasyOrders sent the approving browser back with no GRINDCTRL session.
 *  That browser cannot be the link's creator in this session, so whatever it
 *  approved is destroyed: a forwarded link never leaves a usable key for the
 *  creator to confirm later. A signed-out creator simply starts again. */
export function discardSignedOutInstall(claims: InstallState): Promise<void> {
  return discard(claims, 'rejected');
}
const failed = (reason: Extract<EasyOrdersInstallResult, { status: 'failed' }>['reason']): EasyOrdersInstallResult =>
  ({ status: 'failed', reason });

/** Identity and ownership gate shared by every return-page operation. */
async function gate(claims: InstallState, userId: string): Promise<EasyOrdersInstallResult | EasyOrdersInstallState> {
  if (claims.userId !== userId) {
    await discard(claims, 'rejected');
    return failed('wrong_account');
  }
  try {
    await requireSiteAccess(userId, claims.siteId, 'store');
  } catch (error) {
    if (!(error instanceof UnauthorizedError || error instanceof RoleNotAllowedError)) throw error;
    await discard(claims, 'rejected');
    return failed('forbidden');
  }
  const s = await loadEasyOrdersInstall(claims.siteId);
  // A newer link for the site supersedes this one.
  if (!s || s.nonce_hash !== hash(claims.nonce) || s.created_by !== userId) return failed('invalid_link');
  return s;
}
const isResult = (v: EasyOrdersInstallResult | EasyOrdersInstallState): v is EasyOrdersInstallResult => 'status' in v;
const expired = (at: string | null) => !at || Date.parse(at) <= Date.now();

async function activeResult(siteId: string): Promise<EasyOrdersInstallResult> {
  const c = await loadEasyOrdersConnection(siteId);
  return c?.status === 'active' && c.store_id
    ? { status: 'active', storeId: c.store_id, ...(c.store_name ? { storeName: c.store_name } : {}) }
    : failed('invalid_link');
}

/** What the return page shows. Read-only apart from discarding a staged key
 *  that a wrong account opened or that has expired. */
export async function inspectInstall(claims: InstallState, userId: string): Promise<EasyOrdersInstallResult> {
  const s = await gate(claims, userId);
  return isResult(s) ? s : describe(claims, s);
}
async function describe(claims: InstallState, s: EasyOrdersInstallState): Promise<EasyOrdersInstallResult> {
  if (s.outcome === 'active') return activeResult(claims.siteId);
  if (s.outcome === 'expired') return { status: 'expired' };
  if (s.outcome === 'rejected') return failed('cancelled');
  if (s.outcome === 'unverified') return failed('provider_rejected');
  if (s.consumed_at) return failed('invalid_link');
  if (!s.staged_key) return expired(s.expires_at) ? { status: 'expired' } : { status: 'pending_confirmation', storeId: null, reason: 'awaiting_callback' };
  if (expired(s.staged_expires_at)) {
    await discard(claims, 'expired');
    return { status: 'expired' };
  }
  return { status: 'pending_confirmation', storeId: s.staged_store_id };
}

/** Unknown envelopes are not proof the key works. A store name is recorded
 *  only when the provider states one. */
function verifiedStoreName(json: unknown): string | null | undefined {
  const envelope = json && typeof json === 'object' && !Array.isArray(json) ? json as Record<string, unknown> : null;
  const rows = Array.isArray(json) ? json : envelope?.data;
  if (!Array.isArray(rows)) return undefined;
  const store = envelope?.store && typeof envelope.store === 'object' ? (envelope.store as Record<string, unknown>).name : undefined;
  const name = typeof envelope?.store_name === 'string' ? envelope.store_name : typeof store === 'string' ? store : null;
  return name && /^[^\x00-\x1f\x7f]{1,200}$/.test(name.trim()) ? name.trim() : null;
}

/** `activated` is true only for the one call that made the connection live,
 *  so the caller schedules the first product import exactly once. */
export async function confirmInstall(claims: InstallState, userId: string):
  Promise<{ result: EasyOrdersInstallResult; activated: boolean }> {
  const done = (result: EasyOrdersInstallResult) => ({ result, activated: false });
  const s = await gate(claims, userId);
  if (isResult(s)) return done(s);
  // Replays, refusals, expiry and a callback that has not arrived yet.
  if (s.outcome || s.consumed_at || !s.staged_key || expired(s.staged_expires_at)) return done(await describe(claims, s));
  const c = await loadEasyOrdersConnection(claims.siteId);
  if (!c || c.status !== 'pending_confirmation') return done(failed('invalid_link'));

  // Never activate an unverified key. Unreachable provider: stay pending.
  const check = await easyOrdersRequest({ ...c, api_key: s.staged_key }, 'products?limit=1', 'GET', { verify: true });
  if (!check.ok) {
    if (check.reason === 'unauthorized') {
      await discard(claims, 'unverified');
      return done(failed('provider_rejected'));
    }
    return done({ status: 'pending_confirmation', storeId: s.staged_store_id,
      reason: check.reason === 'rate_limited' ? 'rate_limited' : 'provider_unavailable',
      ...(check.retryAfterSeconds ? { retryAfterSeconds: check.retryAfterSeconds } : {}) });
  }
  const storeName = verifiedStoreName(check.json);
  if (storeName === undefined) {
    return done({ status: 'pending_confirmation', storeId: s.staged_store_id, reason: 'provider_unavailable' });
  }

  const r = await easyOrdersRpc<Activation>('activate_easyorders_install', {
    p_site: claims.siteId, p_user: userId, p_nonce: hash(claims.nonce), p_store_name: storeName,
  });
  switch (r?.status) {
    case 'active':
      if (!r.store_id) return done(failed('unavailable'));
      return { result: { status: 'active', storeId: r.store_id, ...(r.store_name ? { storeName: r.store_name } : {}) },
        activated: r.activated === true };
    case 'expired': return done({ status: 'expired' });
    case 'pending': return done({ status: 'pending_confirmation', storeId: null, reason: 'awaiting_callback' });
    case 'conflict': return done(failed('store_already_connected'));
    default: return done(failed('invalid_link'));
  }
}

/** The creator refuses a staged store, for example one they did not expect. */
export async function cancelInstall(claims: InstallState, userId: string): Promise<EasyOrdersInstallResult> {
  const s = await gate(claims, userId);
  if (isResult(s)) return s;
  if (s.outcome === 'active') return activeResult(claims.siteId);
  if (!s.outcome) await discard(claims, 'rejected');
  return failed('cancelled');
}
