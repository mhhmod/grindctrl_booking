import type { RateLimiterStore } from './rate-limiter-store';
import { draw, type ResourceKey, type Tier } from './rate-limiter';
import { RateLimitedError } from './errors';

/** Checks the local budget before any Groq call — Groq's own 429 is a
 *  safety net, never the primary control. Returns null when within budget,
 *  or a RateLimitedError ready to serialize into the route's response.
 *  Only the anon tier gets a sign-in CTA — auth is already the top tier. */
export function checkBudget(
  store: RateLimiterStore,
  tenantId: string,
  tier: Tier,
  resource: ResourceKey,
  cost: number,
  now?: number,
): RateLimitedError | null {
  const result = draw(store, tenantId, tier, resource, cost, now);
  if (result.allowed) return null;
  return new RateLimitedError(result.resetSeconds, tier === 'anon');
}
