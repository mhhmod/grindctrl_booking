// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  load: vi.fn(), rpc: vi.fn(), ipLimit: vi.fn(), connectionLimit: vi.fn(),
  claims: new Map<string, number>(), redisDown: false,
  ip: { configured: true, limit: (id: string) => mocks.ipLimit(id) },
  connection: { configured: true, limit: (id: string) => mocks.connectionLimit(id) },
}));
vi.mock('@/lib/easyorders/store', async (original) => ({
  ...(await original<typeof import('@/lib/easyorders/store')>()), connectionByWebhookToken: mocks.load, easyOrdersRpc: mocks.rpc,
}));
vi.mock('@/lib/ratelimit', async (original) => ({
  ...(await original<typeof import('@/lib/ratelimit')>()),
  easyOrdersWebhookIpRatelimit: mocks.ip, easyOrdersWebhookConnectionRatelimit: mocks.connection,
}));
// In-memory SET NX EX with the real key builders.
vi.mock('@/lib/easyorders/webhook-guard', async (original) => ({
  ...(await original<typeof import('@/lib/easyorders/webhook-guard')>()),
  claimWindow: vi.fn(async (key: string) => {
    if (mocks.redisDown) throw new Error('redis down');
    if (mocks.claims.has(key)) return false;
    mocks.claims.set(key, 1); return true;
  }),
  releaseWindow: vi.fn(async (key: string) => { mocks.claims.delete(key); }),
}));
import { encryptToken } from '@/lib/shopify/token-crypto';
import { SITE, TOKEN, connection, order } from '@/lib/easyorders/test-fixtures';
import { POST } from './route';

const allow = () => ({ success: true, reset: Date.now() + 60_000 });
beforeEach(() => {
  vi.clearAllMocks(); mocks.claims.clear(); mocks.redisDown = false;
  mocks.ip.configured = true; mocks.connection.configured = true;
  vi.stubEnv('SHOPIFY_TOKEN_ENC_KEY', Buffer.alloc(32, 7).toString('base64'));
  mocks.load.mockResolvedValue(connection()); mocks.rpc.mockResolvedValue(true);
  mocks.ipLimit.mockImplementation(async () => allow()); mocks.connectionLimit.mockImplementation(async () => allow());
});
afterEach(() => vi.unstubAllEnvs());
const statusUpdate = (orderId = 1, newStatus = 'delivered', oldStatus = 'paid') =>
  ({ event_type: 'order-status-update', order_id: orderId, old_status: oldStatus, new_status: newStatus, payment_ref_id: 'private' });
const request = (body: unknown = order, { secret, event = 'order-created', token = TOKEN, ip = '203.0.113.9' }:
  { secret?: string; event?: string; token?: string; ip?: string } = {}) =>
  new Request(`https://grindctrl.cloud/api/easyorders/webhook/${token}?event=${event}`, {
    method: 'POST', body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip, ...(secret !== undefined ? { secret } : {}) },
  });
const context = (token = TOKEN) => ({ params: Promise.resolve({ token }) });
const send = (body?: unknown, options?: Parameters<typeof request>[1]) => POST(request(body, options), context(options?.token));

describe('EasyOrders webhook token authentication', () => {
  it('accepts created and status deliveries, persists no shopper data', async () => {
    expect((await send(order)).status).toBe(200);
    expect((await send(statusUpdate(), { event: 'order-status-update' })).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith('record_easyorders_webhook', { p_site: SITE, p_token: TOKEN, p_changed: false });
    expect(mocks.rpc).toHaveBeenCalledWith('record_easyorders_webhook', { p_site: SITE, p_token: TOKEN, p_changed: true });
    const stored = JSON.stringify([...mocks.rpc.mock.calls, ...mocks.claims.keys()]);
    expect(stored).not.toMatch(/Private|payment_ref|order_id|Mona|eo-1/);
  });
  it('rejects an unknown/revoked token before reading the payload', async () => {
    mocks.load.mockResolvedValue(null);
    expect((await send(order, { token: 'b'.repeat(64) })).status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.connectionLimit).not.toHaveBeenCalled();
  });
  it('compares a known optional secret and never treats a header alone as authentication', async () => {
    mocks.load.mockResolvedValue(connection({ webhook_secret: encryptToken('known-secret') }));
    expect((await send(order, { secret: 'wrong-secret' })).status).toBe(401);
    expect((await send(order, { secret: 'short' })).status).toBe(401);
    expect((await send(order, { secret: 'known-secret' })).status).toBe(200);
    expect((await send({ ...order, id: 'eo-2' })).status).toBe(200); // header is not documented as mandatory
    mocks.load.mockResolvedValue(null);
    expect((await send(order, { secret: 'known-secret' })).status).toBe(401);
  });
  it('rejects invalid payloads and oversized chunked bodies', async () => {
    expect((await send(null)).status).toBe(400);
    expect((await send({ data: 'x'.repeat(256001) })).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('does not acknowledge failed persistence or a disconnect race', async () => {
    mocks.rpc.mockRejectedValueOnce(new Error('db')).mockResolvedValueOnce(false);
    expect((await send(statusUpdate(), { event: 'order-status-update' })).status).toBe(503);
    // The failed delivery released its dedupe claim, so the redelivery is recorded.
    expect((await send(statusUpdate(), { event: 'order-status-update' })).status).toBe(401);
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
  });
});

describe('EasyOrders webhook throttling (F04)', () => {
  it('limits a random-token flood per network before any database lookup', async () => {
    let used = 0;
    mocks.ipLimit.mockImplementation(async () => (++used <= 5 ? allow() : { success: false, reset: Date.now() + 30_000 }));
    mocks.load.mockResolvedValue(null);
    const statuses = [];
    for (let i = 0; i < 12; i++) {
      const token = i.toString(16).padStart(2, '0').repeat(32);
      statuses.push((await send(order, { token })).status);
    }
    expect(statuses.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
    expect(statuses.slice(5).every((s) => s === 429)).toBe(true);
    expect(mocks.load).toHaveBeenCalledTimes(5);
    expect(mocks.ipLimit).toHaveBeenCalledWith('ip:203.0.113.9');
  });
  it('rejects malformed tokens without spending the limiter or the database', async () => {
    for (const token of ['short', '../x', 'A'.repeat(64), 'a'.repeat(65)]) expect((await send(order, { token })).status).toBe(401);
    expect(mocks.ipLimit).not.toHaveBeenCalled();
    expect(mocks.load).not.toHaveBeenCalled();
  });
  it('denies with 503 when the limiter is unconfigured or failing, before the database', async () => {
    mocks.ip.configured = false;
    const response = await send(order);
    expect(response.status).toBe(503);
    expect(response.headers.get('retry-after')).toBe('30');
    mocks.ip.configured = true;
    mocks.ipLimit.mockRejectedValueOnce(new Error('redis down'));
    expect((await send(order)).status).toBe(503);
    mocks.ipLimit.mockResolvedValueOnce({ success: true, reset: Date.now(), reason: 'timeout' });
    expect((await send(order)).status).toBe(503);
    expect(mocks.load).not.toHaveBeenCalled();
  });
  it('applies the per-connection budget after authentication', async () => {
    mocks.connectionLimit.mockResolvedValue({ success: false, reset: Date.now() + 20_000 });
    expect((await send(order)).status).toBe(429);
    expect(mocks.connectionLimit).toHaveBeenCalledWith(SITE);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('dedupes an identical redelivery without touching the database', async () => {
    const delivery = statusUpdate(42, 'in_delivery', 'processing');
    expect((await send(delivery, { event: 'order-status-update' })).status).toBe(200);
    expect((await send(delivery, { event: 'order-status-update' })).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    // A different status for the same order is a new event.
    expect((await send(statusUpdate(42, 'delivered', 'in_delivery'), { event: 'order-status-update' })).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
  });
  it('writes the connection row at most once a minute unless a status changed', async () => {
    for (let i = 0; i < 5; i++) expect((await send({ ...order, id: `eo-${i}` })).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenLastCalledWith('record_easyorders_webhook', expect.objectContaining({ p_changed: false }));
    // An unchanged status update is not a cache invalidation either.
    expect((await send(statusUpdate(7, 'paid', 'paid'), { event: 'order-status-update' })).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect((await send(statusUpdate(8), { event: 'order-status-update' })).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
    expect(mocks.rpc).toHaveBeenLastCalledWith('record_easyorders_webhook', expect.objectContaining({ p_changed: true }));
  });
  it('fails closed when the dedupe store is unavailable', async () => {
    mocks.redisDown = true;
    expect((await send(statusUpdate(), { event: 'order-status-update' })).status).toBe(503);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
