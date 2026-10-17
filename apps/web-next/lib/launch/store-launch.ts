import 'server-only';

import { getMessengerServiceClient } from '@/lib/messenger/db';
import { invalidateProxyConfig } from '@/lib/shopify/proxy-config-cache';
import { normalizeShopDomain } from '@/lib/shopify/shop-authorization';
import { LAUNCH_STATES, type LaunchState, type StoreLaunch } from './audience';

/* The launch state per Shopify store (supabase/store_launch.sql), read by
   both config routes and cached for 60 seconds like the flags. No row, a
   missing table or a failed read all mean live: a database hiccup must not
   hide GrindCTRL from a live store's shoppers. */

export const HOLDOUT_DEFAULT_SHARE = 0.5;
export const HOLDOUT_DEFAULT_DAYS = 14;
const CACHE_TTL_MS = 60_000;

const cache = new Map<string, { launch: StoreLaunch | null; expiresAt: number }>();

function isMissingTable(error: { code?: string; message?: string }): boolean {
  const message = error.message ?? '';
  return error.code === '42P01' || error.code === 'PGRST205' || (message.includes('store_launch') && /does not exist|schema cache/.test(message));
}

function fromRow(row: Record<string, unknown>): StoreLaunch | null {
  const state = row.state as LaunchState;
  if (!LAUNCH_STATES.includes(state) || typeof row.salt !== 'string') return null;
  const share = row.holdout_share === null || row.holdout_share === undefined ? null : Number(row.holdout_share);
  return {
    state,
    holdoutShare: share !== null && Number.isFinite(share) ? share : null,
    holdoutStartedAt: (row.holdout_started_at as string | null) ?? null,
    holdoutEndsAt: (row.holdout_ends_at as string | null) ?? null,
    salt: row.salt,
  };
}

export async function getStoreLaunch(shop: string, now: number = Date.now()): Promise<StoreLaunch | null> {
  const domain = normalizeShopDomain(shop);
  if (!domain) return null;
  const cached = cache.get(domain);
  if (cached && cached.expiresAt > now) return cached.launch;
  try {
    const { data, error } = await getMessengerServiceClient()
      .from('store_launch')
      .select('state, holdout_share, holdout_started_at, holdout_ends_at, salt')
      .eq('shop_domain', domain)
      .maybeSingle();
    if (error) {
      // Until the owner applies the table, every store is live; that answer
      // is cached. A passing error is not, so the next read can recover.
      if (isMissingTable(error)) cache.set(domain, { launch: null, expiresAt: now + CACHE_TTL_MS });
      return null;
    }
    const launch = data ? fromRow(data as Record<string, unknown>) : null;
    cache.set(domain, { launch, expiresAt: now + CACHE_TTL_MS });
    return launch;
  } catch {
    return null;
  }
}

/** Writes a store's launch state. Callers check who may: the owner of the
 *  shop (setLaunchState) or the platform operator. */
export async function writeStoreLaunch(
  shop: string,
  input: { state: LaunchState; holdoutShare?: number; days?: number },
  updatedBy: string,
  now: Date = new Date(),
): Promise<StoreLaunch | null> {
  const domain = normalizeShopDomain(shop);
  if (!domain || !LAUNCH_STATES.includes(input.state)) throw new Error('Unknown store or launch state.');
  const holdout = input.state === 'holdout';
  const share = holdout ? (input.holdoutShare ?? HOLDOUT_DEFAULT_SHARE) : null;
  const days = holdout ? (input.days ?? HOLDOUT_DEFAULT_DAYS) : null;
  if (share !== null && !(share >= 0.05 && share <= 0.95)) throw new Error('The holdout share must be between 5% and 95%.');
  if (days !== null && !(Number.isInteger(days) && days >= 1 && days <= 60)) throw new Error('A holdout runs 1 to 60 days.');

  const { data, error } = await getMessengerServiceClient()
    .from('store_launch')
    .upsert(
      {
        shop_domain: domain,
        state: input.state,
        holdout_share: share,
        holdout_started_at: holdout ? now.toISOString() : null,
        holdout_ends_at: holdout && days !== null ? new Date(now.getTime() + days * 86_400_000).toISOString() : null,
        updated_by: updatedBy,
        updated_at: now.toISOString(),
      },
      { onConflict: 'shop_domain' },
    )
    .select('state, holdout_share, holdout_started_at, holdout_ends_at, salt')
    .single();
  cache.delete(domain);
  // The storefront scripts read the answer from the App Proxy config.
  invalidateProxyConfig(domain);
  if (error) throw new Error(`store_launch write failed: ${error.message}`);
  return fromRow(data as Record<string, unknown>);
}

/** Test seam. */
export function clearStoreLaunchCache(): void {
  cache.clear();
}
