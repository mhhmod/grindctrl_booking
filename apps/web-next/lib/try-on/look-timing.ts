import 'server-only';

import { createClient } from '@supabase/supabase-js';
import { withoutTestLooks } from './test-looks';

/* How long a look takes at this store (02-try-on.md): "The seconds come
   from the store's own median time per look over its recent looks. When
   there are too few looks to be honest, the line drops the first
   sentence." The shopper reads a round number, never a promise the store
   has not kept. The window and the floor follow contract N38
   (09-backend-contracts.md): the last 50 completed looks in 7 days, and
   nothing under 20. */

export const RECENT_LOOKS = 50;
export const RECENT_DAYS = 7;
export const MIN_LOOKS = 20;
const TTL_MS = 10 * 60 * 1000;

const cache = new Map<string, { seconds: number | null; expiresAt: number }>();

/** The median of real durations, rounded to the nearest 5 seconds (at
 *  least 5), or null with fewer than MIN_LOOKS of them. */
export function typicalSeconds(durationsMs: readonly unknown[]): number | null {
  const real = durationsMs
    .filter((ms): ms is number => typeof ms === 'number' && Number.isFinite(ms) && ms > 0)
    .sort((a, b) => a - b);
  if (real.length < MIN_LOOKS) return null;
  const middle = Math.floor(real.length / 2);
  const median = real.length % 2 ? real[middle] : (real[middle - 1] + real[middle]) / 2;
  return Math.max(5, Math.round(median / 1000 / 5) * 5);
}

/** The store's typical seconds per look from its recent shopper looks, or
 *  null when there are too few or they cannot be read. Never throws. */
export async function getTypicalLookSeconds(shop: string | null | undefined, now: number = Date.now()): Promise<number | null> {
  if (!shop) return null;
  const cached = cache.get(shop);
  if (cached && cached.expiresAt > now) return cached.seconds;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  try {
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    // The owner's test looks are not looks shoppers waited for.
    const { data, error } = await withoutTestLooks((excludeTestLooks) => {
      const query = supabase
        .from('tryon_jobs')
        .select('duration_ms')
        .eq('shop', shop)
        .eq('status', 'completed')
        .gte('created_at', new Date(now - RECENT_DAYS * 24 * 60 * 60 * 1000).toISOString());
      return (excludeTestLooks ? query.eq('is_test', false) : query)
        .order('created_at', { ascending: false })
        .limit(RECENT_LOOKS);
    });
    if (error) return null;
    const seconds = typicalSeconds(((data ?? []) as Array<{ duration_ms: unknown }>).map((row) => row.duration_ms));
    cache.set(shop, { seconds, expiresAt: now + TTL_MS });
    return seconds;
  } catch {
    return null;
  }
}

/** Test seam. */
export function clearLookTimingCache(): void {
  cache.clear();
}
