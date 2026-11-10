import 'server-only';
import { getMessengerServiceClient } from '@/lib/messenger/db';

export type HealthCounter = { metric: 'placement' | 'product_detected' | 'listing_views' | 'pills' | 'photo_ok' | 'photo_failure'; dimension: string; count: number };
export type HealthCounts = { inline: number; floating: number; detected: number; missing: number; listings: number; pills: number; photos: number; photoHost: string | null };
export const emptyHealthCounts = (): HealthCounts => ({ inline: 0, floating: 0, detected: 0, missing: 0, listings: 0, pills: 0, photos: 0, photoHost: null });

export async function incrementHealthCounters(siteId: string, counters: HealthCounter[]): Promise<void> {
  const { error } = await getMessengerServiceClient().rpc('increment_store_health_signals', { p_site_id: siteId, p_counters: counters });
  if (error) throw new Error('store health write failed');
}

/** Only after a server garment check/fetch. Telemetry never changes a look. */
export async function recordPhotoHealth(siteId: string, rawUrl: string, ok: boolean): Promise<void> {
  try {
    const host = new URL(rawUrl).hostname.toLowerCase().replace(/\.$/, '');
    if (host.length > 253 || !/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/.test(host)) return;
    await incrementHealthCounters(siteId, [{ metric: ok ? 'photo_ok' : 'photo_failure', dimension: ok ? '' : host, count: 1 }]);
  } catch { /* Keep the garment outcome. */ }
}

/** Seven UTC calendar days including today; 28 dimensions/day at most. */
export async function readHealthCounts(siteIds: string[], now: number): Promise<HealthCounts> {
  const counts = emptyHealthCounts();
  if (!siteIds.length) return counts;
  const today = new Date(now).toISOString().slice(0, 10);
  const start = new Date(Date.parse(today) - 6 * 86400000).toISOString().slice(0, 10);
  const { data, error } = await getMessengerServiceClient().from('store_health_signals')
    .select('day, metric, dimension, count').in('site_id', siteIds).gte('day', start).lte('day', today)
    .order('day', { ascending: false }).order('metric').order('dimension').limit(200 * siteIds.length);
  if (error) throw new Error('store health read failed');
  for (const row of data ?? []) {
    const n = Number(row.count);
    if (!Number.isSafeInteger(n) || n < 0) continue;
    if (row.metric === 'placement' && row.dimension === 'inline') counts.inline += n;
    if (row.metric === 'placement' && row.dimension === 'floating') counts.floating += n;
    if (row.metric === 'product_detected' && row.dimension === 'yes') counts.detected += n;
    if (row.metric === 'product_detected' && row.dimension === 'no') counts.missing += n;
    if (row.metric === 'listing_views') counts.listings += n;
    if (row.metric === 'pills') counts.pills += n;
    if (row.metric === 'photo_ok') counts.photos += n;
    if (row.metric === 'photo_failure' && n > 0 && counts.photoHost === null) counts.photoHost = row.dimension;
  }
  return counts;
}
