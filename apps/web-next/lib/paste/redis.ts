import 'server-only';
import { Redis } from '@upstash/redis';

/** Atomic small counters the paste flows enforce fail-closed. Throws when
 *  Redis is not configured; callers treat any throw as "deny". No retries:
 *  a retried increment could count one request twice. */
export function pasteRedis(): Redis {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('paste_redis_unavailable');
  return new Redis({ url, token, retry: false, signal: AbortSignal.timeout(5000) });
}

/** A whole number result from a script, or a throw: anything else is an
 *  unavailable store, never a pass. */
export function scriptCount(value: unknown): number {
  const count = typeof value === 'string' ? Number(value) : value;
  if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0) throw new Error('paste_redis_invalid');
  return count;
}
