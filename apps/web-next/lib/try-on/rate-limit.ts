/* ─── Try-On Agent — per-IP rate limit ─── */

/* ponytail: in-memory fixed window; single container today. Move to a
   shared store (Supabase/Redis) if the app ever runs multiple instances. */
const windows = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_PER_WINDOW = 10;

export function checkRateLimit(ip: string): { ok: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const entry = windows.get(ip);

  if (!entry || now >= entry.resetAt) {
    windows.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true };
  }

  if (entry.count >= MAX_PER_WINDOW) {
    return { ok: false, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) };
  }

  entry.count += 1;
  return { ok: true };
}

/* Periodic sweep so the map can't grow unbounded. */
export function sweepRateLimits(now = Date.now()) {
  for (const [key, entry] of windows) {
    if (now >= entry.resetAt) windows.delete(key);
  }
}
