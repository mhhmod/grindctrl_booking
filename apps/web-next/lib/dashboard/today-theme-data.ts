import 'server-only';
import { getMessengerServiceClient } from '@/lib/messenger/db';
import { recordEvent } from '@/lib/messenger/conversations';
import { readHealthCounts } from '@/lib/store-health/signals';

/** Called only after the config route verifies Shopify's signature,
 * installation and shared rate limits. This signal grants no permissions. */
export async function recordShopifyThemePiece(shop: string): Promise<void> {
  const result = await getMessengerServiceClient().from('widget_sites')
    .select('id').eq('domain', shop).limit(1).maybeSingle();
  if (result.error) throw new Error('theme site read failed');
  if (result.data) await recordEvent({ siteId: result.data.id, eventName: 'tryon_block_loaded' });
}

/** Placement is reported after a button mounts, before any look is made.
 * Shopify's native block reports through its signed config request. */
export async function readTodayTryOnMounted(siteId: string, nativeShopify: boolean, now: number): Promise<boolean> {
  if (!nativeShopify) {
    const counts = await readHealthCounts([siteId], now);
    return counts.inline + counts.floating > 0;
  }
  const result = await getMessengerServiceClient().from('widget_events')
    .select('id').eq('widget_site_id', siteId).eq('event_name', 'tryon_block_loaded').limit(1);
  if (result.error) throw new Error('theme piece read failed');
  return (result.data ?? []).length > 0;
}
