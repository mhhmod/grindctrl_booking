export const TRYON_POLL_TIMEOUT_MS = 2 * 60_000;
export const TRYON_POLL_INITIAL_DELAY_MS = 1_000;
export const TRYON_POLL_MAX_DELAY_MS = 5_000;
export const TRYON_POLL_BACKOFF_FACTOR = 1.6;

// This bucket is intentionally separate from session/attempt/generation.
// A healthy two-minute poll cycle uses fewer than 30 requests with the
// backoff above, leaving room for overlapping tabs without making the route
// an unbounded status oracle.
export const TRYON_POLL_RATE_LIMIT_REQUESTS = 90;
export const TRYON_POLL_RATE_LIMIT_WINDOW = '2 m' as const;
export const TRYON_POLL_RATE_LIMIT_WINDOW_MS = 2 * 60_000;

export function tryOnPollDelayMs(requestCount: number): number {
  const exponent = Math.max(0, Math.trunc(requestCount) - 1);
  return Math.min(
    TRYON_POLL_MAX_DELAY_MS,
    Math.ceil(TRYON_POLL_INITIAL_DELAY_MS * TRYON_POLL_BACKOFF_FACTOR ** exponent),
  );
}

export function retryAfterDelayMs(value: string | null, now = Date.now()): number | null {
  if (!value) return null;
  const deltaSeconds = Number(value);
  if (Number.isFinite(deltaSeconds)) {
    // A bare numeric Retry-After is delta-seconds by definition (RFC 9110)
    // and must never fall through to Date.parse: a negative or otherwise
    // invalid numeric string can still parse as some unrelated legacy date
    // under Date.parse's lenient non-ISO fallback, silently producing a
    // bogus delay instead of the "invalid" null callers rely on.
    return deltaSeconds >= 0 ? Math.ceil(deltaSeconds * 1_000) : null;
  }

  const retryAt = Date.parse(value);
  return Number.isFinite(retryAt) ? Math.max(0, retryAt - now) : null;
}
