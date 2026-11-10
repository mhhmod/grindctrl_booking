// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), fetch: vi.fn() }));
vi.mock('./store', () => ({ easyOrdersRpc: mocks.rpc }));
import { encryptToken } from '@/lib/shopify/token-crypto';
import { easyOrdersRequest, EASYORDERS_AUTH_HEADER, retryAfterSeconds } from './client';
import { connection } from './test-fixtures';

beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal('fetch', mocks.fetch);
  vi.stubEnv('SHOPIFY_TOKEN_ENC_KEY', Buffer.alloc(32, 7).toString('base64'));
  mocks.rpc.mockResolvedValue({ success: true, reset: Date.now() + 60000 });
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const c = () => connection({ api_key: encryptToken('merchant-key') });
describe('EasyOrders HTTP client', () => {
  it('uses only Api-Key, timeout, fixed host, no redirect or HTTP cache', async () => {
    mocks.fetch.mockResolvedValue(Response.json({ id: 1 }));
    expect(await easyOrdersRequest(c(), 'orders/short/1027')).toEqual({ ok: true, json: { id: 1 } });
    expect(EASYORDERS_AUTH_HEADER).toBe('Api-Key');
    expect(mocks.fetch).toHaveBeenCalledWith('https://api.easy-orders.net/api/v1/external-apps/orders/short/1027', expect.objectContaining({
      headers: { 'Api-Key': 'merchant-key', Accept: 'application/json' }, redirect: 'error', cache: 'no-store', signal: expect.any(AbortSignal),
    }));
    expect(mocks.rpc.mock.calls[0][0]).toBe('reserve_easyorders_request');
  });
  it('does not retry 429 and persists Retry-After before further calls', async () => {
    mocks.fetch.mockResolvedValue(new Response('', { status: 429, headers: { 'Retry-After': '120' } }));
    expect(await easyOrdersRequest(c(), 'products?page=1')).toEqual({ ok: false, reason: 'rate_limited', retryAfterSeconds: 120 });
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenLastCalledWith('cooldown_easyorders', expect.objectContaining({ p_seconds: 120 }));
    mocks.rpc.mockResolvedValue({ success: false, reset: Date.now() + 120000 });
    expect(await easyOrdersRequest(c(), 'orders/short/1027')).toMatchObject({ ok: false, reason: 'rate_limited' });
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });
  it.each([null, {}, { success: true }, { success: true, reset: 1, reason: 'timeout' }])('denies malformed/unavailable capacity %j', async (result) => {
    mocks.rpc.mockResolvedValue(result);
    expect(await easyOrdersRequest(c(), 'orders/short/1027')).toEqual({ ok: false, reason: 'unavailable' });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it('denies RPC failure and decrypt failure before fetch', async () => {
    mocks.rpc.mockRejectedValueOnce(new Error('db down'));
    expect(await easyOrdersRequest(c(), 'products')).toMatchObject({ ok: false });
    expect(await easyOrdersRequest(connection(), 'products')).toMatchObject({ ok: false });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it.each([404, 401, 500])('handles provider %s without exposing the response', async (status) => {
    mocks.fetch.mockResolvedValue(new Response('private provider error', { status }));
    expect(await easyOrdersRequest(c(), 'orders/short/1027')).toEqual({
      ok: false, reason: status === 404 ? 'not_found' : status === 401 ? 'unauthorized' : 'unavailable' });
  });
  it('spends the staged key budget only when verifying', async () => {
    mocks.fetch.mockResolvedValue(Response.json([]));
    await easyOrdersRequest(c(), 'products?limit=1', 'GET', { verify: true });
    expect(mocks.rpc).toHaveBeenCalledWith('reserve_easyorders_request', expect.objectContaining({ p_verify: true, p_cleanup: false }));
    await easyOrdersRequest(c(), 'products?limit=1');
    expect(mocks.rpc).toHaveBeenCalledWith('reserve_easyorders_request', expect.objectContaining({ p_verify: false }));
  });
  it('handles network timeout without retry', async () => {
    mocks.fetch.mockRejectedValue(new DOMException('timeout', 'TimeoutError'));
    expect(await easyOrdersRequest(c(), 'products')).toEqual({ ok: false, reason: 'unavailable' });
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });
  it('rejects oversized decoded bodies and malformed JSON', async () => {
    mocks.fetch.mockResolvedValueOnce(new Response('x'.repeat(512001))).mockResolvedValueOnce(new Response('not json'));
    expect(await easyOrdersRequest(c(), 'products')).toMatchObject({ ok: false });
    expect(await easyOrdersRequest(c(), 'products')).toMatchObject({ ok: false });
  });
  it('rejects paths outside the fixed contract', async () => {
    for (const path of ['https://attacker.test/', '../orders', '//attacker.test', 'orders/short/../../admin']) {
      expect(await easyOrdersRequest(c(), path)).toMatchObject({ ok: false });
    }
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it('parses seconds/date Retry-After defensively', () => {
    expect(retryAfterSeconds('120')).toBe(120);
    expect(retryAfterSeconds(new Date(180000).toUTCString(), 0)).toBe(180);
    for (const v of [null, '-1', 'bad', '0']) expect(retryAfterSeconds(v)).toBe(60);
  });
});
