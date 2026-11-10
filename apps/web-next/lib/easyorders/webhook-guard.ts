import 'server-only';
import { Redis } from '@upstash/redis';
import { hash } from './state';

/* Short Redis windows that keep webhook deliveries off the connection row:
   identical redeliveries are acknowledged without a write, and delivery time
   is recorded at most once a minute. Missing or failing Redis throws, so the
   route answers 503 and EasyOrders can redeliver (AGENTS.md: deny, never
   fall back to unthrottled work). */

export const DEDUPE_WINDOW_SECONDS = 120;
export const TOUCH_WINDOW_SECONDS = 60;

function redis(): Redis {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('webhook_guard_unavailable');
  return new Redis({ url, token, retry: false, signal: AbortSignal.timeout(5000) });
}

/** SET NX EX. True only for the first claim in the window. */
export async function claimWindow(key: string, ttlSeconds: number): Promise<boolean> {
  const result = await redis().set(key, '1', { nx: true, ex: ttlSeconds });
  if (result !== 'OK' && result !== null) throw new Error('webhook_guard_unavailable');
  return result === 'OK';
}
/** Best effort: lets a redelivery through after we failed to record it. */
export async function releaseWindow(key: string): Promise<void> {
  try { await redis().del(key); } catch { /* the window still expires on its own */ }
}

/** The order id is hashed so Redis never holds it in the clear. */
export const deliveryKey = (siteId: string, orderId: string, event: string, newStatus: string) =>
  `gc-easyorders-webhook:dedupe:${hash(`${siteId}\n${orderId}\n${event}\n${newStatus}`)}`;
export const touchKey = (siteId: string) => `gc-easyorders-webhook:touch:${siteId}`;
