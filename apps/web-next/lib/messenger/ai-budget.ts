import 'server-only';
import { pasteRedis, scriptCount } from '@/lib/paste/redis';

/* What Store Chat may spend on the model in one UTC day. Each shopper turn
   that reaches the model is counted against its site and against every
   site together, in one atomic step, before the model runs. Past either
   ceiling, or when Redis cannot answer, the model is not called and the
   turn goes to the store's team instead (fail closed). Env, read per call:
     MESSENGER_AI_SITE_DAILY_TURNS    per site, default 2000
     MESSENGER_AI_GLOBAL_DAILY_TURNS  all sites, default 50000; 0 stops the
                                      model everywhere (circuit breaker) */

export const DEFAULT_SITE_DAILY_AI_TURNS = 2_000;
export const DEFAULT_GLOBAL_DAILY_AI_TURNS = 50_000;
const KEY_TTL_SECONDS = 2 * 24 * 60 * 60;

export type AiTurnBudget = 'allowed' | 'site_exhausted' | 'global_exhausted' | 'unavailable';

/** 1 counted, 2 site day full, 3 all-sites day full. */
export type AiTurnCounter = (keys: [site: string, global: string], siteLimit: number, globalLimit: number, ttlSeconds: number) => Promise<number>;
/** True when this call is the first to claim the key today. */
export type OnceClaimer = (key: string, ttlSeconds: number) => Promise<boolean>;

function envLimit(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 0 ? value : fallback;
}

export function siteDailyAiTurns(): number {
  return envLimit('MESSENGER_AI_SITE_DAILY_TURNS', DEFAULT_SITE_DAILY_AI_TURNS);
}

export function globalDailyAiTurns(): number {
  return envLimit('MESSENGER_AI_GLOBAL_DAILY_TURNS', DEFAULT_GLOBAL_DAILY_AI_TURNS);
}

function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

// The global key carries the hash tag the site key does, so both live in one slot.
const CLAIM_SCRIPT = `
if tonumber(redis.call('GET', KEYS[1]) or '0') >= tonumber(ARGV[1]) then return 2 end
if tonumber(redis.call('GET', KEYS[2]) or '0') >= tonumber(ARGV[2]) then return 3 end
redis.call('INCR', KEYS[1])
redis.call('INCR', KEYS[2])
if redis.call('TTL', KEYS[1]) < 0 then redis.call('EXPIRE', KEYS[1], tonumber(ARGV[3])) end
if redis.call('TTL', KEYS[2]) < 0 then redis.call('EXPIRE', KEYS[2], tonumber(ARGV[3])) end
return 1`;

const redisCounter: AiTurnCounter = async (keys, siteLimit, globalLimit, ttlSeconds) =>
  scriptCount(await pasteRedis().eval(CLAIM_SCRIPT, keys, [String(siteLimit), String(globalLimit), String(ttlSeconds)]));

const redisOnce: OnceClaimer = async (key, ttlSeconds) =>
  (await pasteRedis().set(key, '1', { nx: true, ex: ttlSeconds })) === 'OK';

export async function claimAiTurnBudget(
  siteId: string,
  options: { now?: Date; counter?: AiTurnCounter } = {},
): Promise<AiTurnBudget> {
  const global = globalDailyAiTurns();
  if (global === 0) return 'global_exhausted';
  const site = siteDailyAiTurns();
  if (site === 0) return 'site_exhausted';
  const day = utcDay(options.now ?? new Date());
  try {
    const result = await (options.counter ?? redisCounter)(
      [`gc-msgr-ai:{${day}}:site:${siteId}`, `gc-msgr-ai:{${day}}:all`], site, global, KEY_TTL_SECONDS);
    if (result === 1) return 'allowed';
    if (result === 2) return 'site_exhausted';
    if (result === 3) return 'global_exhausted';
    return 'unavailable';
  } catch {
    return 'unavailable';
  }
}

/** Claims today's one merchant alert for a site whose budget ran out. A
 *  send that then fails should call releaseAiBudgetAlert so a later turn
 *  tries again. False on any doubt: an unsent alert beats an email storm. */
export async function claimAiBudgetAlert(siteId: string, options: { now?: Date; claim?: OnceClaimer } = {}): Promise<boolean> {
  try {
    return await (options.claim ?? redisOnce)(aiBudgetAlertKey(siteId, options.now ?? new Date()), KEY_TTL_SECONDS);
  } catch {
    return false;
  }
}

export async function releaseAiBudgetAlert(siteId: string, now = new Date()): Promise<void> {
  try {
    await pasteRedis().del(aiBudgetAlertKey(siteId, now));
  } catch {
    // The alert stays claimed for today; the event log still records it.
  }
}

function aiBudgetAlertKey(siteId: string, now: Date): string {
  return `gc-msgr-ai:{${utcDay(now)}}:alerted:${siteId}`;
}
