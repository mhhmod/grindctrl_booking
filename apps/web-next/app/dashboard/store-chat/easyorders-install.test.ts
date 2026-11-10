// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EasyOrdersConnection, EasyOrdersInstallState } from '@/lib/easyorders/types';
const mocks = vi.hoisted(() => ({
  auth: vi.fn(), access: vi.fn(), limit: vi.fn(), request: vi.fn(), sync: vi.fn(), after: vi.fn(), rpc: vi.fn(),
  db: { install: null as EasyOrdersInstallState | null, conn: null as EasyOrdersConnection | null },
}));
vi.mock('@clerk/nextjs/server', () => ({ auth: mocks.auth }));
vi.mock('next/server', () => ({ after: mocks.after }));
vi.mock('@/lib/messenger/provisioning', () => ({ requireSiteAccess: mocks.access, UnauthorizedError: class extends Error {} }));
vi.mock('@/lib/request-rate-limit', async (original) => ({ ...(await original<typeof import('@/lib/request-rate-limit')>()), requireMerchantRateLimit: mocks.limit }));
vi.mock('@/lib/easyorders/client', () => ({ easyOrdersRequest: mocks.request }));
vi.mock('@/lib/easyorders/products', () => ({ syncEasyOrdersProducts: mocks.sync }));
vi.mock('@/lib/easyorders/store', () => ({
  easyOrdersRpc: mocks.rpc,
  loadEasyOrdersConnection: async () => mocks.db.conn && { ...mocks.db.conn },
  loadEasyOrdersInstall: async () => mocks.db.install && { ...mocks.db.install },
}));
import { RoleNotAllowedError } from '@/lib/rbac/dashboard-policy';
import { RequestRateLimitError } from '@/lib/request-rate-limit';
import { hash, signInstallState } from '@/lib/easyorders/state';
import { SITE, USER, connection } from '@/lib/easyorders/test-fixtures';
import { cancelEasyOrdersInstall, confirmEasyOrdersInstall, inspectEasyOrdersInstall } from './easyorders-actions';

const STAGED_KEY = { ciphertext: 'staged', iv: 'iv', tag: 'tag' };
const minutes = (n: number) => new Date(Date.now() + n * 60_000).toISOString();
let state: string;
let nonceHash: string;

/* Mirrors the SQL contract (covered for real in easyorders-sql.test.ts):
   discard clears the staged key once; activate is creator-bound and a replay
   reports activated=false. */
function fakeRpc(name: string, args: Record<string, string>) {
  const { install: s, conn: c } = mocks.db;
  if (name === 'discard_easyorders_install') {
    if (!s || s.nonce_hash !== args.p_nonce || s.outcome) return false;
    Object.assign(s, { staged_key: null, staged_store_id: null, staged_expires_at: null,
      consumed_at: s.consumed_at ?? new Date().toISOString(), outcome: args.p_outcome });
    if (c?.status === 'pending_confirmation') c.status = 'pending';
    return true;
  }
  if (name === 'activate_easyorders_install') {
    if (!s || !c || s.nonce_hash !== args.p_nonce || s.created_by !== args.p_user) return { status: 'invalid' };
    if (s.outcome === 'active') return { status: 'active', activated: false, store_id: c.store_id, store_name: c.store_name };
    if (!s.staged_key || c.status !== 'pending_confirmation') return { status: 'invalid' };
    Object.assign(c, { status: 'active', api_key: s.staged_key, store_id: s.staged_store_id, store_name: args.p_store_name });
    Object.assign(s, { outcome: 'active', consumed_at: new Date().toISOString(), staged_key: null, staged_store_id: null, staged_expires_at: null });
    return { status: 'active', activated: true, store_id: c.store_id, store_name: c.store_name };
  }
  throw new Error(`unexpected rpc ${name}`);
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('GRINDCTRL_CAPABILITY_SECRET', 'x'.repeat(32));
  const signed = signInstallState(SITE, USER);
  state = signed.state; nonceHash = hash(signed.claims.nonce);
  mocks.db.conn = connection({ status: 'pending_confirmation', api_key: null, store_id: null });
  mocks.db.install = {
    widget_site_id: SITE, nonce_hash: nonceHash, created_by: USER, expires_at: minutes(10), consumed_at: null,
    staged_key: STAGED_KEY, staged_store_id: 'eo-store', staged_expires_at: minutes(15), outcome: null,
  };
  mocks.auth.mockResolvedValue({ userId: USER });
  mocks.access.mockResolvedValue({ id: SITE });
  mocks.rpc.mockImplementation(async (name, args) => fakeRpc(name, args));
  mocks.request.mockResolvedValue({ ok: true, json: { data: [], store_name: 'Mona Fashion' } });
  mocks.sync.mockResolvedValue(3);
});
afterEach(() => vi.unstubAllEnvs());
const runAfter = async () => { for (const [task] of mocks.after.mock.calls) await task(); };

describe('EasyOrders install confirmation (F03)', () => {
  it('shows the staged store for confirmation without connecting it', async () => {
    expect(await inspectEasyOrdersInstall(state)).toEqual({ status: 'pending_confirmation', storeId: 'eo-store' });
    expect(mocks.db.conn?.status).toBe('pending_confirmation');
    expect(mocks.request).not.toHaveBeenCalled();
    expect(mocks.limit).toHaveBeenCalledWith(`easyorders:${SITE}:${USER}`, 'read');
  });
  it('activates for the creator after verifying the key, and imports products once', async () => {
    expect(await confirmEasyOrdersInstall(state)).toEqual({ status: 'active', storeId: 'eo-store', storeName: 'Mona Fashion' });
    expect(mocks.request).toHaveBeenCalledWith(expect.objectContaining({ api_key: STAGED_KEY, widget_site_id: SITE }),
      'products?limit=1', 'GET', { verify: true });
    expect(mocks.access).toHaveBeenCalledWith(USER, SITE, 'store');
    expect(mocks.limit).toHaveBeenCalledWith(`easyorders:${SITE}:${USER}`, 'write');
    expect(mocks.db.conn).toMatchObject({ status: 'active', api_key: STAGED_KEY, store_id: 'eo-store' });
    await runAfter();
    expect(mocks.sync).toHaveBeenCalledTimes(1);
    expect(mocks.sync).toHaveBeenCalledWith(SITE);
  });
  it('a replayed return reports the connection without activating or importing again', async () => {
    await confirmEasyOrdersInstall(state);
    const again = await confirmEasyOrdersInstall(state);
    expect(again).toEqual({ status: 'active', storeId: 'eo-store', storeName: 'Mona Fashion' });
    expect(mocks.after).toHaveBeenCalledTimes(1);
    expect(mocks.request).toHaveBeenCalledTimes(1);
    expect(mocks.rpc.mock.calls.filter(([name]) => name === 'activate_easyorders_install')).toHaveLength(1);
  });
  it('a different signed-in user cannot activate, and the staged key is deleted', async () => {
    mocks.auth.mockResolvedValue({ userId: 'user_other_merchant' });
    expect(await confirmEasyOrdersInstall(state)).toEqual({ status: 'failed', reason: 'wrong_account' });
    expect(mocks.db.install).toMatchObject({ staged_key: null, outcome: 'rejected' });
    expect(mocks.db.conn).toMatchObject({ status: 'pending', api_key: null });
    expect(mocks.request).not.toHaveBeenCalled();
    expect(mocks.access).not.toHaveBeenCalled();
    // The creator cannot complete it afterwards either.
    mocks.auth.mockResolvedValue({ userId: USER });
    expect(await confirmEasyOrdersInstall(state)).toEqual({ status: 'failed', reason: 'cancelled' });
    expect(mocks.db.conn?.status).toBe('pending');
    expect(mocks.after).not.toHaveBeenCalled();
  });
  it('merely opening the return page as another user discards the staged key', async () => {
    mocks.auth.mockResolvedValue({ userId: 'user_other_merchant' });
    expect(await inspectEasyOrdersInstall(state)).toEqual({ status: 'failed', reason: 'wrong_account' });
    expect(mocks.db.install?.staged_key).toBeNull();
  });
  it('does nothing without a signed-in user', async () => {
    mocks.auth.mockResolvedValue({ userId: null });
    expect(await confirmEasyOrdersInstall(state)).toEqual({ status: 'failed', reason: 'signed_out' });
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.request).not.toHaveBeenCalled();
    expect(mocks.db.conn?.status).toBe('pending_confirmation');
  });
  it('discards expired staging instead of activating', async () => {
    mocks.db.install!.staged_expires_at = minutes(-1);
    expect(await confirmEasyOrdersInstall(state)).toEqual({ status: 'expired' });
    expect(mocks.db.install).toMatchObject({ staged_key: null, outcome: 'expired' });
    expect(mocks.request).not.toHaveBeenCalled();
    expect(mocks.after).not.toHaveBeenCalled();
    expect(await inspectEasyOrdersInstall(state)).toEqual({ status: 'expired' });
  });
  it('discards when the creator lost the site capability', async () => {
    mocks.access.mockRejectedValue(new RoleNotAllowedError('store'));
    expect(await confirmEasyOrdersInstall(state)).toEqual({ status: 'failed', reason: 'forbidden' });
    expect(mocks.db.install?.staged_key).toBeNull();
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it('keeps it pending when EasyOrders cannot be reached, and activates on retry', async () => {
    mocks.request.mockResolvedValueOnce({ ok: false, reason: 'unavailable' })
      .mockResolvedValueOnce({ ok: false, reason: 'rate_limited', retryAfterSeconds: 90 })
      .mockResolvedValueOnce({ ok: true, json: { unexpected: true } });
    expect(await confirmEasyOrdersInstall(state)).toEqual({ status: 'pending_confirmation', storeId: 'eo-store', reason: 'provider_unavailable' });
    expect(await confirmEasyOrdersInstall(state)).toEqual({ status: 'pending_confirmation', storeId: 'eo-store', reason: 'rate_limited', retryAfterSeconds: 90 });
    // An unrecognised response is not proof the key works.
    expect(await confirmEasyOrdersInstall(state)).toMatchObject({ status: 'pending_confirmation', reason: 'provider_unavailable' });
    expect(mocks.db.conn?.status).toBe('pending_confirmation');
    expect(mocks.db.install?.staged_key).toEqual(STAGED_KEY);
    expect(await confirmEasyOrdersInstall(state)).toMatchObject({ status: 'active' });
  });
  it('discards a key EasyOrders refuses', async () => {
    mocks.request.mockResolvedValue({ ok: false, reason: 'unauthorized' });
    expect(await confirmEasyOrdersInstall(state)).toEqual({ status: 'failed', reason: 'provider_rejected' });
    expect(mocks.db.install).toMatchObject({ staged_key: null, outcome: 'unverified' });
    expect(mocks.db.conn?.status).toBe('pending');
  });
  it('reports a link whose callback has not arrived yet as pending', async () => {
    Object.assign(mocks.db.install!, { staged_key: null, staged_store_id: null, staged_expires_at: null });
    mocks.db.conn!.status = 'pending';
    expect(await confirmEasyOrdersInstall(state)).toEqual({ status: 'pending_confirmation', storeId: null, reason: 'awaiting_callback' });
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it('rejects forged, superseded and malformed state', async () => {
    expect(await confirmEasyOrdersInstall(`${state.slice(0, -1)}0`)).toEqual({ status: 'failed', reason: 'invalid_link' });
    expect(await confirmEasyOrdersInstall('')).toEqual({ status: 'failed', reason: 'invalid_link' });
    mocks.db.install!.nonce_hash = 'f'.repeat(64);
    expect(await confirmEasyOrdersInstall(state)).toEqual({ status: 'failed', reason: 'invalid_link' });
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it('lets the creator refuse a store they did not expect', async () => {
    expect(await cancelEasyOrdersInstall(state)).toEqual({ status: 'failed', reason: 'cancelled' });
    expect(mocks.db.install).toMatchObject({ staged_key: null, outcome: 'rejected' });
    expect(await confirmEasyOrdersInstall(state)).toEqual({ status: 'failed', reason: 'cancelled' });
  });
  it('denies work when merchant rate enforcement is unavailable', async () => {
    mocks.limit.mockRejectedValue(new RequestRateLimitError(503, 30));
    expect(await confirmEasyOrdersInstall(state)).toEqual({ status: 'failed', reason: 'unavailable', retryAfterSeconds: 30 });
    expect(mocks.db.conn?.status).toBe('pending_confirmation');
  });
});
