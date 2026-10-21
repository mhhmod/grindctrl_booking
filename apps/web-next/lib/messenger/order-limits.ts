import 'server-only';

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

/* Order lookups are counted per address as well as per conversation: a new
   conversation is one localStorage clear away, so a per-conversation budget
   alone would not slow down someone guessing order numbers. Counted on
   attempts, not successes, since guessing is what spends it. The chat's
   model path and the lookup form share these, so one cannot refill the
   other. Without Redis there is no limiter, and requireRateLimit refuses. */
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN ? Redis.fromEnv() : null;

/** 20 an hour per store and address. */
export const orderLookupLimiter = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, '1 h'), prefix: 'gc-msgr-order', analytics: false })
  : null;

/** 10 a day per store and order number, whoever asks (contract N48), so a
 *  number cannot be tried against many emails from many addresses. */
export const orderNumberLimiter = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '1 d'), prefix: 'gc-msgr-order-number', analytics: false })
  : null;
