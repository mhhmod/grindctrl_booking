import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import {
  TRYON_POLL_RATE_LIMIT_REQUESTS,
  TRYON_POLL_RATE_LIMIT_WINDOW,
} from '@/lib/try-on/poll-policy';

/* Guards the public, unauthenticated, AI-cost-incurring routes: the try-on
   flow (session/generate/jobs/config). Every request to those without this
   would be a way to run up the OpenRouter bill for free. Not wired to
   anything requiring auth — those already have
   a real identity to rate-limit or ban by, this is specifically for the
   surface a script can hit anonymously.

   Construction is guarded: Redis.fromEnv() throws when the Upstash env vars
   are missing, and a module-load crash here would take every importing
   route down with it. A missing limiter fails OPEN with a loud error log
   instead — degraded protection beats an app-wide outage, and the missing
   env vars are exactly the kind of thing .env.example + this log surface. */
function createRatelimiters(): {
  publicApi: Ratelimit | null;
  tryOnPoll: Ratelimit | null;
} {
  /* Redis.fromEnv() only warns when vars are missing, producing a client
     that throws per-call. Check explicitly: fail OPEN with the loud error
     below rather than crashing every importing route at boot. */
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    console.error(
      '[ratelimit] UPSTASH_REDIS_REST_URL/TOKEN missing — public API rate limiting is DISABLED.',
    );
    return { publicApi: null, tryOnPoll: null };
  }
  try {
    const redis = Redis.fromEnv();
    return {
      publicApi: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(10, '10 s'),
        analytics: true,
        prefix: 'gc-ratelimit',
      }),
      tryOnPoll: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(
          TRYON_POLL_RATE_LIMIT_REQUESTS,
          TRYON_POLL_RATE_LIMIT_WINDOW,
        ),
        analytics: true,
        prefix: 'gc-ratelimit:tryon-poll',
      }),
    };
  } catch (error) {
    console.error(
      '[ratelimit] Upstash limiter unavailable — public API rate limiting is DISABLED. Cause:',
      error instanceof Error ? error.message : error,
    );
    return { publicApi: null, tryOnPoll: null };
  }
}

const limiters = createRatelimiters();

function limiterFacade(limiter: Ratelimit | null) {
  return {
    configured: limiter !== null,
    async limit(id: string): Promise<{ success: boolean; reset: number }> {
      if (!limiter) return { success: true, reset: Date.now() + 60_000 };
      return limiter.limit(id);
    },
  };
}

export const publicApiRatelimit = limiterFacade(limiters.publicApi);
export const tryOnPollRatelimit = limiterFacade(limiters.tryOnPoll);

/* Identity of the requesting network for rate-limit keying. Prefers the
   RIGHTMOST x-forwarded-for entry: every proxy on the path appends to the
   left side, so the last entry is the one OUR infrastructure added — a
   client cannot spoof it without sitting inside our own network. Taking
   the first (leftmost) entry would let any caller rotate fake IPs and void
   the limit. Returns null when no trusted header exists; callers decide
   their own fallback (a shared bucket, never a client-supplied one). */
export function clientIp(req: Request): string | null {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const entries = forwarded.split(',').map((part) => part.trim()).filter(Boolean);
    const rightmost = entries[entries.length - 1];
    if (rightmost) return rightmost;
  }
  return req.headers.get('x-real-ip')?.trim() || null;
}

export function rateLimitedResponse(reset: number): Response {
  return new Response(JSON.stringify({ error: 'Too many requests' }), {
    status: 429,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': String(Math.max(1, Math.ceil((reset - Date.now()) / 1000))),
    },
  });
}
