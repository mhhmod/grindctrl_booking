import 'server-only';
import { getMessengerServiceClient } from '@/lib/messenger/db';
import { invalidateProxyConfig } from '@/lib/shopify/proxy-config-cache';
import { AUTO_PLACEMENT, parsePlacement, publicPlacement, type ButtonPlacement, type PublicPlacement } from './placement';

// Before 20261111_tryon_pick_spot.sql runs, every store reads as automatic.
const MISSING_TABLE = new Set(['42P01', 'PGRST205']);

export async function readButtonPlacement(shop: string): Promise<ButtonPlacement> {
  if (!shop || shop === 'default') return AUTO_PLACEMENT;
  const { data, error } = await getMessengerServiceClient().from('tryon_button_placements')
    .select('placement, spot').eq('shop', shop).maybeSingle();
  if (error) {
    if (MISSING_TABLE.has(String(error.code))) return AUTO_PLACEMENT;
    throw new Error('placement unavailable');
  }
  // A row this code cannot read (a hand edit) places the button automatically.
  return (data && parsePlacement(data)) ?? AUTO_PLACEMENT;
}

/** For storefront config responses: placement never decides whether Try-On
 *  shows, so a failed read places the button automatically. */
export async function readPublicPlacement(shop: string): Promise<PublicPlacement> {
  try {
    return publicPlacement(await readButtonPlacement(shop));
  } catch {
    console.error('[try-on] placement read failed', { code: 'placement_read' });
    return { placement: 'auto' };
  }
}

export async function writeButtonPlacement(shop: string, value: ButtonPlacement): Promise<void> {
  const placement = parsePlacement(value);
  if (!shop || shop === 'default' || !placement) throw new Error('invalid placement');
  const { error } = await getMessengerServiceClient().from('tryon_button_placements').upsert({
    shop,
    placement: placement.placement,
    spot: placement.spot ?? null,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error('placement save failed');
  invalidateProxyConfig(shop);
}
