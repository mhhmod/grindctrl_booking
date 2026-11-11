import 'server-only';
import { pasteRedis, scriptCount } from '@/lib/paste/redis';

export const DAILY_COUNTER_TTL = 172_800;
export type DailyCounter = (keys: [string, string], siteLimit: number, globalLimit: number, ttl: number) => Promise<number>;
export type DailyBudget = 'allowed' | 'site_exhausted' | 'global_exhausted' | 'unavailable';

// Both features use the Store Chat contract: one atomic check and increment,
// one Redis slot, no retry and no refund (a failed provider call may cost us).
export const CLAIM_DAILY_SCRIPT = `
if tonumber(redis.call('GET', KEYS[1]) or '0') >= tonumber(ARGV[1]) then return 2 end
if tonumber(redis.call('GET', KEYS[2]) or '0') >= tonumber(ARGV[2]) then return 3 end
redis.call('INCR', KEYS[1])
redis.call('INCR', KEYS[2])
if redis.call('TTL', KEYS[1]) < 0 then redis.call('EXPIRE', KEYS[1], tonumber(ARGV[3])) end
if redis.call('TTL', KEYS[2]) < 0 then redis.call('EXPIRE', KEYS[2], tonumber(ARGV[3])) end
return 1`;

export const redisDailyCounter: DailyCounter = async (keys, site, global, ttl) =>
  scriptCount(await pasteRedis().eval(CLAIM_DAILY_SCRIPT, keys, [String(site), String(global), String(ttl)]));

export function dailyKeys(feature: 'tryon' | 'chat', store: string, now = new Date()): [string, string] {
  const day = now.toISOString().slice(0, 10);
  return feature === 'chat'
    ? [`gc-msgr-ai:{${day}}:site:${store}`, `gc-msgr-ai:{${day}}:all`]
    : [`gc-tryon:{${day}}:site:${store}`, `gc-tryon:{${day}}:all`];
}

export async function claimDailyBudget(keys: [string, string], site: number, global: number, counter = redisDailyCounter): Promise<DailyBudget> {
  if (global === 0) return 'global_exhausted';
  if (site === 0) return 'site_exhausted';
  try {
    const result = await counter(keys, site, global, DAILY_COUNTER_TTL);
    return result === 1 ? 'allowed' : result === 2 ? 'site_exhausted' : result === 3 ? 'global_exhausted' : 'unavailable';
  } catch { return 'unavailable'; }
}

/** Missing is zero; malformed or failed reads are unknown, never zero. */
export function dailyUsage(raw: unknown): number {
  return raw === null ? 0 : scriptCount(raw);
}

export async function readDailyUsage(keys: string[]): Promise<number[]> {
  if (!keys.length) return [];
  const values = await pasteRedis().mget<unknown[]>(...keys);
  if (!Array.isArray(values) || values.length !== keys.length) throw new Error('daily_usage_unavailable');
  return values.map(dailyUsage);
}
