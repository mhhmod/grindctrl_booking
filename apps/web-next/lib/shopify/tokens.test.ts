// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { acquireShopToken, getShopToken, hasShopOrderAccess, setShopTokenClientForTests } from './tokens';
import { encryptToken } from './token-crypto';

const shop = 'demo.myshopify.com';
const rows = new Map<string, Record<string, unknown>>();
const rpc = vi.fn();
const from = vi.fn();
const exchange = vi.fn();
let filters: Record<string, unknown>;
let pendingLease: string | null;
function db() {
  from.mockImplementation((table: string) => {
    expect(table).toBe('shopify_installations'); // Never read domain-only legacy credentials.
    filters = {};
    const query = {
      select: () => query,
      eq: (field: string, value: unknown) => { filters[field] = value; return query; },
      limit: async () => ({ data: [...rows.values()].filter(r => Object.entries(filters).every(([k,v]) => r[k] === v)), error: null }),
    };
    return query;
  });
  rpc.mockImplementation(async (_name, args) => {
    const key = `${args.p_shop}:${args.p_app}`;
    const row = rows.get(key) ?? { id: args.p_app, shop_domain: args.p_shop, app_client_id: args.p_app, status: 'reauthorization_required', scopes: '' };
    if (args.p_operation === 'acquire') {
      if (pendingLease) return { data: null, error: null };
      pendingLease = args.p_lease;
      return { data: { ...row }, error: null };
    }
    if (pendingLease !== args.p_lease) return { data: null, error: { message: 'lease lost' } };
    if (args.p_operation === 'commit') rows.set(key, { ...row, ...args.p_payload, status: 'active' });
    if (args.p_operation === 'reauthorize') rows.set(key, { ...row, status: 'reauthorization_required' });
    pendingLease = null;
    return { data: { ok: true }, error: null };
  });
  return { from, rpc } as unknown as SupabaseClient;
}
function seed(app: string, extra: Record<string, unknown> = {}) {
  const e = encryptToken(`access-${app}`);
  rows.set(`${shop}:${app}`, {
    id: app, shop_domain: shop, app_client_id: app, status: 'active', scopes: 'read_products,read_orders,write_app_proxy',
    access_token_ciphertext: e.ciphertext, token_iv: e.iv, token_tag: e.tag,
    access_expires_at: null, refresh_expires_at: null, ...extra,
  });
}
beforeEach(() => {
  vi.resetAllMocks(); rows.clear(); pendingLease = null;
  vi.stubEnv('SHOPIFY_APPS', JSON.stringify([{ clientId: 'app-a', secret: 'secret-a' }, { clientId: 'app-b', secret: 'secret-b' }]));
  vi.stubEnv('SHOPIFY_API_KEY', ''); vi.stubEnv('SHOPIFY_API_SECRET', '');
  vi.stubEnv('SHOPIFY_TOKEN_ENC_KEY', Buffer.alloc(32, 7).toString('base64'));
  setShopTokenClientForTests(db());
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); setShopTokenClientForTests(null); });

describe('installation-scoped credentials', () => {
  it('keeps two app credentials independent and denies ambiguous lookup', async () => {
    seed('app-a'); seed('app-b');
    expect(await getShopToken(shop)).toBeNull();
    expect((await getShopToken(shop, 'app-a'))?.accessToken).toBe('access-app-a');
    expect((await getShopToken(shop, 'app-b'))?.accessToken).toBe('access-app-b');
    expect(await getShopToken(shop, 'unknown-app')).toBeNull();
  });
  it('supports a sole active installation without assuming legacy token ownership', async () => {
    expect(await getShopToken(shop)).toBeNull();
    seed('app-a');
    expect((await getShopToken(shop))?.appClientId).toBe('app-a');
    expect(await hasShopOrderAccess(shop)).toBe(true);
  });
  it('rejects invalid domains without touching storage', async () => {
    expect(await getShopToken('evil.example', 'app-a')).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });
  it('never reads another application when the requested one is inactive', async () => {
    seed('app-a', { status: 'uninstalled' }); seed('app-b');
    expect(await getShopToken(shop, 'app-a')).toBeNull();
  });
  it('stores encrypted tokens and response-defined expiry metadata for the selected app only', async () => {
    seed('app-b');
    exchange.mockResolvedValue({ access_token: 'new-a', refresh_token: 'refresh-a', expires_in: 700,
      refresh_token_expires_in: 1400, scope: 'read_products' });
    const before = Date.now();
    await acquireShopToken({ shopDomain: shop, appClientId: 'app-a', exchange });
    const saved = rows.get(`${shop}:app-a`)!;
    expect(JSON.stringify(saved)).not.toContain('new-a');
    expect(JSON.stringify(saved)).not.toContain('refresh-a');
    expect(Date.parse(saved.access_expires_at as string)).toBeGreaterThanOrEqual(before + 700000);
    expect((await getShopToken(shop, 'app-b'))?.accessToken).toBe('access-app-b');
  });
  it('does not call the provider while another acquisition or refresh owns the lease', async () => {
    pendingLease = 'other-process';
    await expect(acquireShopToken({ shopDomain: shop, appClientId: 'app-a', exchange })).rejects.toMatchObject({ code: 'busy' });
    expect(exchange).not.toHaveBeenCalled();
  });
  it('fails closed on malformed expiring token response and requires fresh authorization', async () => {
    exchange.mockResolvedValue({ access_token: 'secret', scope: 'read_products' });
    await expect(acquireShopToken({ shopDomain: shop, appClientId: 'app-a', exchange })).rejects.toMatchObject({ code: 'exchange_failed' });
    expect(rows.get(`${shop}:app-a`)?.status).toBe('reauthorization_required');
  });
  it('rotates access AND refresh credentials using the matching app secret', async () => {
    const refresh = encryptToken('old-refresh');
    seed('app-b', { access_expires_at: new Date(Date.now() - 1000).toISOString(),
      refresh_expires_at: new Date(Date.now() + 60000).toISOString(), refresh_token_ciphertext: refresh.ciphertext,
      refresh_token_iv: refresh.iv, refresh_token_tag: refresh.tag });
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ access_token: 'new-access',
      refresh_token: 'new-refresh', expires_in: 3600, refresh_token_expires_in: 8000, scope: 'read_products' })));
    vi.stubGlobal('fetch', fetchMock);
    expect((await getShopToken(shop, 'app-b'))?.accessToken).toBe('new-access');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ client_id: 'app-b', client_secret: 'secret-b',
      grant_type: 'refresh_token', refresh_token: 'old-refresh' });
    expect(rows.get(`${shop}:app-a`)).toBeUndefined();
    expect(JSON.stringify(rows.get(`${shop}:app-b`))).not.toContain('new-refresh');
  });
  it('does not retry a failed refresh or leak provider details', async () => {
    const refresh = encryptToken('old-refresh');
    seed('app-a', { access_expires_at: new Date(Date.now() - 1000).toISOString(),
      refresh_expires_at: new Date(Date.now() + 60000).toISOString(), refresh_token_ciphertext: refresh.ciphertext,
      refresh_token_iv: refresh.iv, refresh_token_tag: refresh.tag });
    const fetchMock = vi.fn().mockRejectedValue(new Error('provider secret detail'));
    vi.stubGlobal('fetch', fetchMock);
    expect(await getShopToken(shop, 'app-a')).toBeNull();
    expect(await getShopToken(shop, 'app-a')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(rows.get(`${shop}:app-a`)?.status).toBe('reauthorization_required');
  });
});
