import 'server-only';
import { claimDailyBudget, dailyKeys, readDailyUsage, type DailyCounter, type DailyBudget } from '@/lib/spend/daily-counter';
import { effectiveSpendLimit, envDailyLimit } from '@/lib/spend/limits';
import { readSpendLimits } from '@/lib/spend/store';

export const DEFAULT_SITE_DAILY_LOOKS = 300;
export const DEFAULT_GLOBAL_DAILY_LOOKS = 5_000;
export const siteDailyLooks = () => envDailyLimit('TRYON_SITE_DAILY_LOOKS', DEFAULT_SITE_DAILY_LOOKS);
export const globalDailyLooks = () => envDailyLimit('TRYON_GLOBAL_DAILY_LOOKS', DEFAULT_GLOBAL_DAILY_LOOKS);

export async function claimTryOnDailyBudget(tenant: string, options: { now?: Date; counter?: DailyCounter; siteLimit?: number } = {}): Promise<DailyBudget> {
  try {
    const limit = options.siteLimit ?? (await readSpendLimits(tenant)).tryOnDailyLooks;
    return await claimDailyBudget(dailyKeys('tryon', tenant, options.now), effectiveSpendLimit(limit, siteDailyLooks()), globalDailyLooks(), options.counter);
  } catch { return 'unavailable'; }
}

export type TryOnDayStatus = { used: number; limit: number; reached: boolean };
export async function readTryOnDayStatus(tenant: string, now = new Date()): Promise<TryOnDayStatus> {
  const limits = await readSpendLimits(tenant);
  const limit = effectiveSpendLimit(limits.tryOnDailyLooks, siteDailyLooks());
  const [used, globalUsed] = await readDailyUsage(dailyKeys('tryon', tenant, now));
  return { used, limit, reached: used >= limit || globalUsed >= globalDailyLooks() };
}

/** Fail closed for storefront availability, without calling Redis trouble
 * a daily exhaustion on the merchant's Store check. */
export async function tryOnDayAvailability(tenant: string): Promise<'live' | 'daily_limit' | 'unavailable'> {
  try { return (await readTryOnDayStatus(tenant)).reached ? 'daily_limit' : 'live'; }
  catch { return 'unavailable'; }
}
