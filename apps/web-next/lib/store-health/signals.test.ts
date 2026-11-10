// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), select: vi.fn(), in: vi.fn(), gte: vi.fn(), lte: vi.fn(), order: vi.fn(), limit: vi.fn() }));
vi.mock('@/lib/messenger/db', () => ({ getMessengerServiceClient: () => m }));
import { incrementHealthCounters, readHealthCounts, recordPhotoHealth } from './signals';
beforeEach(() => {
  vi.clearAllMocks();
  for (const key of ['from', 'select', 'in', 'gte', 'lte', 'order'] as const) m[key].mockReturnValue(m);
  m.limit.mockResolvedValue({ data: [], error: null });
  m.rpc.mockResolvedValue({ error: null });
});
describe('store health counters', () => {
  it('reads one bounded seven-day query scoped to authorized sites', async () => {
    m.limit.mockResolvedValue({ data: [
      { metric: 'placement', dimension: 'inline', count: '12' }, { metric: 'placement', dimension: 'floating', count: 2 },
      { metric: 'product_detected', dimension: 'yes', count: 12 }, { metric: 'product_detected', dimension: 'no', count: 3 },
      { metric: 'listing_views', dimension: '', count: 1 }, { metric: 'pills', dimension: '', count: 24 },
      { metric: 'photo_ok', dimension: '', count: 2 }, { metric: 'photo_failure', dimension: 'cdn.example.com', count: 1 },
    ], error: null });
    expect(await readHealthCounts(['s1', 's2'], Date.parse('2026-11-10T23:59:00Z'))).toEqual({ inline: 12, floating: 2, detected: 12, missing: 3, listings: 1, pills: 24, photos: 2, photoHost: 'cdn.example.com' });
    expect(m.from).toHaveBeenCalledExactlyOnceWith('store_health_signals');
    expect(m.in).toHaveBeenCalledWith('site_id', ['s1', 's2']);
    expect(m.gte).toHaveBeenCalledWith('day', '2026-11-04');
    expect(m.lte).toHaveBeenCalledWith('day', '2026-11-10');
    expect(m.limit).toHaveBeenCalledWith(400);
  });
  it('does not read without a site and never guesses on database error', async () => {
    await readHealthCounts([], Date.now());
    expect(m.from).not.toHaveBeenCalled();
    m.limit.mockResolvedValue({ data: null, error: { message: 'offline' } });
    await expect(readHealthCounts(['s1'], Date.now())).rejects.toThrow('store health read failed');
  });
  it('records only the hostname on server refusal and no hostname on successful fetch', async () => {
    const url = 'https://CDN.example.com/private/path.jpg?customer=secret#fragment';
    await recordPhotoHealth('site', url, false);
    expect(m.rpc).toHaveBeenLastCalledWith('increment_store_health_signals', { p_site_id: 'site', p_counters: [{ metric: 'photo_failure', dimension: 'cdn.example.com', count: 1 }] });
    await recordPhotoHealth('site', url, true);
    expect(m.rpc).toHaveBeenLastCalledWith('increment_store_health_signals', { p_site_id: 'site', p_counters: [{ metric: 'photo_ok', dimension: '', count: 1 }] });
  });
  it('silently ignores bad URLs and keeps telemetry errors out of garment results', async () => {
    await recordPhotoHealth('s', 'bad', false);
    expect(m.rpc).not.toHaveBeenCalled();
    m.rpc.mockRejectedValueOnce(new Error('offline'));
    await expect(recordPhotoHealth('s', 'https://cdn.example/image', false)).resolves.toBeUndefined();
    m.rpc.mockResolvedValueOnce({ error: { message: 'offline' } });
    await expect(incrementHealthCounters('s', [{ metric: 'pills', dimension: '', count: 2 }])).rejects.toThrow('store health write failed');
  });
});
