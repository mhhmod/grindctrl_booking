import 'server-only';
import { pasteRedis } from '@/lib/paste/redis';
import { claimDailyBudget, dailyKeys, redisDailyCounter } from '@/lib/spend/daily-counter';
import { effectiveSpendLimit } from '@/lib/spend/limits';
import { readChatSpendLimits } from '@/lib/spend/store';

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

const redisOnce: OnceClaimer = async (key, ttlSeconds) =>
  (await pasteRedis().set(key, '1', { nx: true, ex: ttlSeconds })) === 'OK';

export async function claimAiTurnBudget(
  siteId: string,
  options: { now?: Date; counter?: AiTurnCounter; siteLimit?: number } = {},
): Promise<AiTurnBudget> {
  try {
    const override = options.siteLimit ?? (await readChatSpendLimits(siteId)).storeChatDailyTurns;
    return await claimDailyBudget(dailyKeys('chat', siteId, options.now),
      effectiveSpendLimit(override, siteDailyAiTurns()), globalDailyAiTurns(), options.counter ?? redisDailyCounter);
  } catch { return 'unavailable'; }
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
