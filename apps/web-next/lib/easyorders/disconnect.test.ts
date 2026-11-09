// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), load: vi.fn(), fetch: vi.fn() }));
vi.mock('./store', () => ({ easyOrdersRpc: mocks.rpc, loadEasyOrdersConnection: mocks.load }));
import { encryptToken } from '@/lib/shopify/token-crypto';
import { disconnectEasyOrdersConnection } from './disconnect';
import { connection, SITE, TOKEN } from './test-fixtures';
beforeEach(() => {
  vi.resetAllMocks(); vi.stubGlobal('fetch', mocks.fetch);
  vi.stubEnv('SHOPIFY_TOKEN_ENC_KEY', Buffer.alloc(32, 7).toString('base64'));
  mocks.load.mockResolvedValue(connection({ api_key: encryptToken('merchant-key') }));
  mocks.rpc.mockImplementation(async (name: string) => name === 'reserve_easyorders_request'
    ? { success: true, reset: Date.now() + 60000 } : true);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe('EasyOrders disconnect', () => {
  it('deletes both original URLs sequentially, then clears the stored key', async () => {
    mocks.fetch.mockImplementation(async () => new Response(null, { status: 204 }));
    await disconnectEasyOrdersConnection(SITE);
    const calls = mocks.fetch.mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls.map(([url]) => new URL(url).searchParams.get('url'))).toEqual([
      `https://grindctrl.cloud/api/easyorders/webhook/${TOKEN}?event=order-created`,
      `https://grindctrl.cloud/api/easyorders/webhook/${TOKEN}?event=order-status-update`,
    ]);
    expect(calls.every(([, options]) => options.method === 'DELETE')).toBe(true);
    expect(mocks.rpc.mock.calls[0][0]).toBe('begin_easyorders_disconnect');
    expect(mocks.rpc.mock.calls.at(-1)?.[0]).toBe('finish_easyorders_disconnect');
  });
  it.each([429, 401, 500])('retains credentials on cleanup failure %s without retry storms', async (status) => {
    mocks.fetch.mockResolvedValue(new Response('', { status }));
    await expect(disconnectEasyOrdersConnection(SITE)).rejects.toThrow();
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    expect(mocks.rpc.mock.calls.map(([name]) => name)).not.toContain('finish_easyorders_disconnect');
  });
  it('retains the key if the second removal fails, and accepts already deleted webhooks', async () => {
    mocks.fetch.mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(new Response('', { status: 500 }));
    await expect(disconnectEasyOrdersConnection(SITE)).rejects.toThrow();
    expect(mocks.rpc.mock.calls.map(([name]) => name)).not.toContain('finish_easyorders_disconnect');
    mocks.fetch.mockResolvedValueOnce(new Response('', { status: 404 })).mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(disconnectEasyOrdersConnection(SITE)).resolves.toBeUndefined();
  });
  it('handles pending and absent/disconnected connections without network', async () => {
    mocks.load.mockResolvedValueOnce(connection({ status: 'pending', api_key: null })).mockResolvedValueOnce(null)
      .mockResolvedValueOnce(connection({ status: 'disconnected', api_key: null }));
    await disconnectEasyOrdersConnection(SITE); await disconnectEasyOrdersConnection(SITE); await disconnectEasyOrdersConnection(SITE);
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
  });
});
