import 'server-only';
import type { VerifiedTryOnSession } from '@/lib/try-on/storefront-context';
import { pasteRedis, scriptCount } from './redis';

/* Paid looks one shopper session may start on a pasted install, website or
   Shopify. The session id is the try-on session our server derived from a
   context it minted (a random nonce per mint, signed), so a caller can
   neither choose it nor reuse another one. Each look is counted once by its
   request key, so retrying the same attempt never spends the allowance
   twice. The window starts at the session's first look. Fail closed: no
   answer from Redis means no look. */

export const PASTE_LOOKS_PER_SHOPPER_SESSION = 6;
export const PASTE_LOOK_WINDOW_SECONDS = 60 * 60;

export type PasteLookAllowance = 'allowed' | 'exhausted' | 'unavailable';
/** 1 when `member` is (now) counted under `key`, 0 when the set is full. */
export type LookCounter = (key: string, member: string, limit: number, windowSeconds: number) => Promise<number>;

const CLAIM_SCRIPT = `
if redis.call('SISMEMBER', KEYS[1], ARGV[1]) == 1 then return 1 end
if redis.call('SCARD', KEYS[1]) >= tonumber(ARGV[2]) then return 0 end
redis.call('SADD', KEYS[1], ARGV[1])
if redis.call('TTL', KEYS[1]) < 0 then redis.call('EXPIRE', KEYS[1], tonumber(ARGV[3])) end
return 1`;

const redisCounter: LookCounter = async (key, member, limit, windowSeconds) =>
  scriptCount(await pasteRedis().eval(CLAIM_SCRIPT, [key], [member, String(limit), String(windowSeconds)]));

type LookAuthorization = Pick<VerifiedTryOnSession, 'platform' | 'test' | 'shop' | 'sessionId' | 'requestKey'>;

/** Counts this paid look against its shopper session. Owner test looks and
 *  every non-paste session are not counted here. */
export async function claimPasteLook(authorization: LookAuthorization, counter: LookCounter = redisCounter): Promise<PasteLookAllowance> {
  const paste = authorization.platform === 'paste-website' || authorization.platform === 'paste-shopify';
  if (!paste || authorization.test === true) return 'allowed';
  if (!authorization.shop || !authorization.sessionId || !authorization.requestKey) return 'unavailable';
  try {
    const counted = await counter(`gc-paste:looks:v1:${authorization.shop}:${authorization.sessionId}`,
      authorization.requestKey, PASTE_LOOKS_PER_SHOPPER_SESSION, PASTE_LOOK_WINDOW_SECONDS);
    return counted === 1 ? 'allowed' : 'exhausted';
  } catch {
    return 'unavailable';
  }
}
