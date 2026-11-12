// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  sync: vi.fn(),
  status: vi.fn(),
  row: { data: { id: 'site', embed_key: 'key', products_sync_attempted_at: null as string | null }, error: null as unknown },
  after: [] as Array<() => unknown>,
}));
vi.mock('next/server', () => ({ after: (fn: () => unknown) => { m.after.push(fn); } }));
vi.mock('./products', () => ({ syncSiteProducts: m.sync, readProductsStatus: m.status }));
vi.mock('./db', () => ({
  getMessengerServiceClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => m.row }) }) }) }),
}));
import { scheduleProductsRefresh } from './products-refresh';

const flush = async () => { for (const run of m.after.splice(0)) await run(); };

beforeEach(() => {
  vi.clearAllMocks();
  m.after.length = 0;
  m.row = { data: { id: 'site', embed_key: 'key', products_sync_attempted_at: null }, error: null };
  m.sync.mockResolvedValue({ count: 3 });
  m.status.mockResolvedValue(null);
});

describe('reading the catalogue when a store first goes live', () => {
  it('runs after the response, not during it', async () => {
    scheduleProductsRefresh('site');
    expect(m.sync).not.toHaveBeenCalled();
    await flush();
    expect(m.sync).toHaveBeenCalledWith({ id: 'site', embed_key: 'key' });
  });

  it('resolves a Shopify app shop to its site, and does nothing for an unknown shop', async () => {
    scheduleProductsRefresh(async () => 'site');
    await flush();
    expect(m.sync).toHaveBeenCalledTimes(1);
    scheduleProductsRefresh(async () => null);
    await flush();
    expect(m.sync).toHaveBeenCalledTimes(1);
  });

  it('does not read again inside the hour, or once the products were read', async () => {
    m.row = { data: { id: 'site', embed_key: 'key', products_sync_attempted_at: new Date(Date.now() - 10 * 60_000).toISOString() }, error: null };
    scheduleProductsRefresh('site');
    await flush();
    m.row = { data: { id: 'site', embed_key: 'key', products_sync_attempted_at: null }, error: null };
    m.status.mockResolvedValue({ outcome: 'ok', count: 5, at: new Date().toISOString() });
    scheduleProductsRefresh('site');
    await flush();
    expect(m.sync).not.toHaveBeenCalled();
  });

  it('retries a store that was behind its password page once the hour has passed', async () => {
    m.row = { data: { id: 'site', embed_key: 'key', products_sync_attempted_at: new Date(Date.now() - 2 * 3_600_000).toISOString() }, error: null };
    m.status.mockResolvedValue({ outcome: 'password_page', count: 0, at: new Date().toISOString() });
    scheduleProductsRefresh('site');
    await flush();
    expect(m.sync).toHaveBeenCalledTimes(1);
  });

  it('never throws into the connect path, even when the read fails', async () => {
    m.sync.mockRejectedValue(new Error('Catalogue is behind the store password page.'));
    scheduleProductsRefresh('site');
    await expect(flush()).resolves.toBeUndefined();
  });
});
