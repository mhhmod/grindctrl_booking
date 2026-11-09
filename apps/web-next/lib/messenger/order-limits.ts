import 'server-only';

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { requireRateLimit, RequestRateLimitError } from '@/lib/request-rate-limit';

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

export type OrderLookupGate = 'open' | 'spent' | 'unavailable';

/** Spends one lookup from the per-address budget and, when the lookup names
 *  an order, from that order number's budget. The chat's model path and
 *  the lookup form both go through here, so neither can skip a budget.
 *  `network` is networkKey(clientIp(...)); `orderNumber` is normalized. A
 *  spent budget is 'spent'; one that cannot be enforced is 'unavailable'. */
export async function spendOrderLookupBudget(
  input: { siteId: string; network: string; orderNumber?: string | null },
  limiters: { address: Parameters<typeof requireRateLimit>[0]; number: Parameters<typeof requireRateLimit>[0] } =
    { address: orderLookupLimiter, number: orderNumberLimiter },
): Promise<OrderLookupGate> {
  try {
    await requireRateLimit(limiters.address, `${input.siteId}:${input.network}`);
    if (input.orderNumber) await requireRateLimit(limiters.number, `${input.siteId}:${input.orderNumber}`);
    return 'open';
  } catch (error) {
    if (!(error instanceof RequestRateLimitError)) throw error;
    return error.status === 429 ? 'spent' : 'unavailable';
  }
}

/** 120 an hour per connected WooCommerce site: a ceiling on signed calls to
 *  one merchant's WordPress, whoever in the store's chat asks. */
export const wooSiteOrderLimiter = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(120, '1 h'), prefix: 'gc-msgr-order-woo-site', analytics: false })
  : null;
