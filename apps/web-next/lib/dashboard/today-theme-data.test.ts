// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ health: vi.fn(), record: vi.fn(), eq: vi.fn(), result: { data: [] as unknown, error: null as unknown } }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/store-health/signals', () => ({ readHealthCounts: m.health }));
vi.mock('@/lib/messenger/conversations', () => ({ recordEvent: m.record }));
vi.mock('@/lib/messenger/db', () => ({ getMessengerServiceClient: () => ({ from: () => {
  const query = { select: () => query, eq: (...args: unknown[]) => { m.eq(...args); return query; }, limit: () => query, maybeSingle: async () => m.result, then: (resolve: (value: unknown) => unknown) => Promise.resolve(m.result).then(resolve) };
  return query;
} }) }));
import { readTodayTryOnMounted, recordShopifyThemePiece } from './today-theme-data';
beforeEach(() => { vi.clearAllMocks(); m.result = { data: [], error: null }; });
it('m5: needs a mounted product button, rather than detection or a listing view', async () => {
  m.health.mockResolvedValue({ inline: 0, floating: 0, detected: 3, pills: 9 });
  expect(await readTodayTryOnMounted('site', false, 123)).toBe(false);
  m.health.mockResolvedValue({ inline: 1, floating: 0 });
  expect(await readTodayTryOnMounted('site', false, 123)).toBe(true);
  expect(m.health).toHaveBeenCalledWith(['site'], 123);
});
it('m5: reads the native product-block signal for this site only', async () => {
  m.result.data = [{ id: 'event' }];
  expect(await readTodayTryOnMounted('site', true, 123)).toBe(true);
  expect(m.eq).toHaveBeenCalledWith('widget_site_id', 'site');
  expect(m.eq).toHaveBeenCalledWith('event_name', 'tryon_block_loaded');
  m.result.data = [];
  expect(await readTodayTryOnMounted('site', true, 123)).toBe(false);
});
it('records under the server-resolved shop site and leaves failures unknown', async () => {
  m.result.data = { id: 'site' };
  await recordShopifyThemePiece('store.myshopify.com');
  expect(m.eq).toHaveBeenCalledWith('domain', 'store.myshopify.com');
  expect(m.record).toHaveBeenCalledWith({ siteId: 'site', eventName: 'tryon_block_loaded' });
  m.result.error = { message: 'down' };
  await expect(readTodayTryOnMounted('site', true, 123)).rejects.toThrow();
});
