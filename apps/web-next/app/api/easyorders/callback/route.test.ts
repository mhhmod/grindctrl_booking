// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), load: vi.fn(), access: vi.fn(), sync: vi.fn() }));
vi.mock('@/lib/easyorders/store', () => ({ easyOrdersRpc: mocks.rpc, loadEasyOrdersConnection: mocks.load }));
vi.mock('@/lib/messenger/provisioning', () => ({ requireSiteAccess: mocks.access, UnauthorizedError: class extends Error {} }));
vi.mock('@/lib/easyorders/products', () => ({ syncEasyOrdersProducts: mocks.sync }));
import { signInstallState } from '@/lib/easyorders/state';
import { createInstallLink } from '@/lib/easyorders/install';
import { decryptToken } from '@/lib/shopify/token-crypto';
import { SITE, USER, connection } from '@/lib/easyorders/test-fixtures';
import { UnauthorizedError } from '@/lib/messenger/provisioning';
import { POST } from './route';

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('GRINDCTRL_CAPABILITY_SECRET', 'x'.repeat(32));
  vi.stubEnv('SHOPIFY_TOKEN_ENC_KEY', Buffer.alloc(32, 7).toString('base64'));
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://grindctrl.cloud');
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('unexpected network'); }));
  mocks.load.mockResolvedValue(connection({ status: 'pending', api_key: null }));
  mocks.access.mockResolvedValue({ id: SITE }); mocks.rpc.mockResolvedValue(true);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
const request = (state: string, body: unknown = { api_key: 'merchant-key', store_id: 'eo-store' }) => new Request(
  `https://grindctrl.cloud/api/easyorders/callback?state=${encodeURIComponent(state)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
describe('EasyOrders install contract and callback', () => {
  it('places signed state in callback_url; passes distinct webhook URLs and read-only permissions', async () => {
    const url = new URL(await createInstallLink(SITE, USER));
    expect(url.origin).toBe('https://app.easy-orders.net');
    const params = new URLSearchParams(url.hash.split('?')[1]);
    expect(params.get('permissions')).toBe('orders:read,products:read');
    const callback = new URL(params.get('callback_url')!);
    expect(callback.pathname).toBe('/api/easyorders/callback');
    expect(callback.searchParams.get('state')).toBeTruthy();
    const orders = new URL(params.get('orders_webhook')!);
    const statuses = new URL(params.get('order_status_webhook')!);
    expect(orders.pathname).toMatch(/^\/api\/easyorders\/webhook\/[a-f0-9]{64}$/);
    expect(orders.pathname).toBe(statuses.pathname);
    expect(orders.toString()).not.toBe(statuses.toString());
    expect(mocks.rpc).toHaveBeenCalledWith('begin_easyorders_install', expect.objectContaining({ p_site: SITE, p_user: USER }));
    // The consenting browser returns to our dashboard with the same signed state.
    const redirect = new URL(params.get('redirect_url')!);
    expect(redirect.origin).toBe('https://grindctrl.cloud');
    expect(redirect.pathname).toBe('/connect/easyorders');
    expect(redirect.searchParams.get('state')).toBe(callback.searchParams.get('state'));
  });
  it('only stages the signed site/user key, encrypted, and ignores body-supplied identities', async () => {
    const { state } = signInstallState(SITE, USER);
    const response = await POST(request(state, { api_key: 'merchant-key', store_id: 'eo-store', site_id: 'victim', user_id: 'attacker' }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(mocks.access).toHaveBeenCalledWith(USER, SITE, 'store');
    const args = mocks.rpc.mock.calls.find(([name]) => name === 'stage_easyorders_install')![1];
    expect(args).toMatchObject({ p_site: SITE, p_user: USER, p_store: 'eo-store' });
    expect(args.p_key).not.toBe('merchant-key');
    expect(decryptToken(args.p_key)).toBe('merchant-key');
    expect(response.headers.get('cache-control')).toBe('no-store');
    // Whoever approved in EasyOrders may not be the link's creator: no
    // activation, product import or provider call happens here.
    expect(mocks.rpc.mock.calls.map(([name]) => name)).toEqual(['stage_easyorders_install']);
    expect(mocks.sync).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('rejects replay using the atomic persisted nonce result', async () => {
    let consumed = false;
    mocks.rpc.mockImplementation(async () => { const accepted = !consumed; consumed = true; return accepted; });
    const { state } = signInstallState(SITE, USER);
    expect((await POST(request(state))).status).toBe(200);
    expect((await POST(request(state))).status).toBe(400);
  });
  it('rejects forgery and expiry before storage writes', async () => {
    const { state } = signInstallState(SITE, USER, 1000);
    expect((await POST(request(state))).status).toBe(400);
    const fresh = signInstallState(SITE, USER).state;
    expect((await POST(request(`${fresh.slice(0, -1)}g`))).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('rechecks ownership and fails closed when revoked', async () => {
    mocks.access.mockRejectedValue(new UnauthorizedError());
    expect((await POST(request(signInstallState(SITE, USER).state))).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each([{}, null, [], { api_key: 'bad\nkey', store_id: 's' }, { api_key: 'key', store_id: {} }])('rejects malformed callback %j', async (body) => {
    expect((await POST(request(signInstallState(SITE, USER).state, body))).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('rejects oversized/duplicate-state input and returns 503 for storage failure', async () => {
    const state = signInstallState(SITE, USER).state;
    expect((await POST(request(state, { api_key: 'x'.repeat(9000) }))).status).toBe(400);
    const duplicated = new Request(`${request(state).url}&state=x`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    expect((await POST(duplicated)).status).toBe(400);
    mocks.rpc.mockRejectedValue(new Error('db'));
    expect((await POST(request(state))).status).toBe(503);
  });
  it('requires disconnect before replacing an active install', async () => {
    mocks.rpc.mockResolvedValue(false);
    await expect(createInstallLink(SITE, USER)).rejects.toThrow('connection_conflict');
  });
});
