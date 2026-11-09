import 'server-only';
import { pasteRedis, scriptCount } from '@/lib/paste/redis';
import { getTryOnMode } from './service';
import type { VerifiedTryOnSession } from './storefront-context';

/* Paid looks the public /try-on demo may start. Every demo look is a real
   provider generation paid by us, so two daily ceilings apply, both in Redis
   and both fail closed: one per visitor network (IPv6 by /64, see
   networkKey) and one for the whole demo. A look is counted once by its
   attempt's request key, so retrying the same attempt never spends twice.
   Days are UTC. Merchant storefront looks never pass through here. */

export const DEMO_LOOKS_PER_NETWORK_PER_DAY = 3;
export const DEFAULT_DEMO_DAILY_BUDGET = 150;
const KEY_TTL_SECONDS = 2 * 24 * 60 * 60;

export type DemoLookAllowance = 'allowed' | 'network_exhausted' | 'budget_exhausted' | 'unavailable';

/** 1 counted (or already counted), 2 network day full, 3 demo day full. */
export type DemoLookCounter = (
  keys: [network: string, spent: string],
  member: string,
  perNetwork: number,
  budget: number,
  ttlSeconds: number,
) => Promise<number>;

/** A public-demo look reaches the paid provider only in live mode; mock
 *  looks are static files and need neither the check nor the allowance. */
export function demoLookChallengeRequired(authorization: Pick<VerifiedTryOnSession, 'purpose'>): boolean {
  return authorization.purpose === 'public-demo' && getTryOnMode() === 'live';
}

/** TRYON_DEMO_DAILY_BUDGET: whole looks per UTC day; 0 pauses the demo. */
export function demoDailyBudget(): number {
  const raw = process.env.TRYON_DEMO_DAILY_BUDGET?.trim();
  if (!raw) return DEFAULT_DEMO_DAILY_BUDGET;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 0 ? value : DEFAULT_DEMO_DAILY_BUDGET;
}

// Both keys share a hash tag so the script touches one slot.
const CLAIM_SCRIPT = `
if redis.call('SISMEMBER', KEYS[1], ARGV[1]) == 1 then return 1 end
if redis.call('SCARD', KEYS[1]) >= tonumber(ARGV[2]) then return 2 end
if tonumber(redis.call('GET', KEYS[2]) or '0') >= tonumber(ARGV[3]) then return 3 end
redis.call('SADD', KEYS[1], ARGV[1])
redis.call('EXPIRE', KEYS[1], tonumber(ARGV[4]))
redis.call('INCR', KEYS[2])
if redis.call('TTL', KEYS[2]) < 0 then redis.call('EXPIRE', KEYS[2], tonumber(ARGV[4])) end
return 1`;

const redisCounter: DemoLookCounter = async (keys, member, perNetwork, budget, ttlSeconds) =>
  scriptCount(await pasteRedis().eval(CLAIM_SCRIPT, keys, [member, String(perNetwork), String(budget), String(ttlSeconds)]));

export async function claimDemoLook(
  input: { network: string; requestKey: string; now?: Date },
  counter: DemoLookCounter = redisCounter,
): Promise<DemoLookAllowance> {
  const budget = demoDailyBudget();
  if (budget === 0) return 'budget_exhausted';
  if (!input.network || !input.requestKey) return 'unavailable';
  const day = (input.now ?? new Date()).toISOString().slice(0, 10);
  try {
    const result = await counter(
      [`gc-demo:{${day}}:net:${input.network}`, `gc-demo:{${day}}:spent`],
      input.requestKey, DEMO_LOOKS_PER_NETWORK_PER_DAY, budget, KEY_TTL_SECONDS,
    );
    if (result === 1) return 'allowed';
    if (result === 2) return 'network_exhausted';
    if (result === 3) return 'budget_exhausted';
    return 'unavailable';
  } catch {
    return 'unavailable';
  }
}
