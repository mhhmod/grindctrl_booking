import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import {
  TRYON_POLL_RATE_LIMIT_REQUESTS,
  TRYON_POLL_RATE_LIMIT_WINDOW,
} from '@/lib/try-on/poll-policy';

/* Shared operational budgets for public traffic and authenticated merchant
   controls. Public reads, token minting, writes and provider work MUST use
   requireRateLimit from request-rate-limit.ts, never a raw success check:
   missing configuration and Upstash timeout-success are not authorization.
   Merchant callers additionally use verified account/shop identities.

   Construction is guarded to avoid module-load crashes; the configured
   flag tells strict callers to return a safe, retryable 503 before work.
   Signed service webhooks, OAuth callbacks, health and OPTIONS preflight
   deliberately retain their own protocol/auth controls instead of sharing
   shopper buckets. There is no blanket middleware throttle. */
function createRatelimiters(): {
  publicApi: Ratelimit | null;
  tryOnPoll: Ratelimit | null;
  merchantRead: Ratelimit | null;
  merchantWrite: Ratelimit | null;
} {
  /* Redis.fromEnv() only warns when vars are missing, producing a client
     that throws per-call. The strict guard rejects this unconfigured facade
     without crashing every importing route at boot. */
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    console.error(
      '[ratelimit] Redis configuration missing — protected requests are unavailable.',
    );
    return { publicApi: null, tryOnPoll: null, merchantRead: null, merchantWrite: null };
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
      // Operational abuse budgets, not paid-plan allowances. Keep reads
      // separate so inbox polling cannot consume the merchant's save budget.
      merchantRead: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(120, '60 s'),
        prefix: 'gc-ratelimit:merchant-read',
        analytics: false,
      }),
      merchantWrite: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(30, '60 s'),
        prefix: 'gc-ratelimit:merchant-write',
        analytics: false,
      }),
    };
  } catch {
    console.error(
      '[ratelimit] Redis initialization failed — protected requests are unavailable.',
    );
    return { publicApi: null, tryOnPoll: null, merchantRead: null, merchantWrite: null };
  }
}

const limiters = createRatelimiters();

function limiterFacade(limiter: Ratelimit | null) {
  return {
    configured: limiter !== null,
    async limit(id: string): Promise<{ success: boolean; reset: number; reason?: string }> {
      if (!limiter) return { success: true, reset: Date.now() + 60_000 };
      return limiter.limit(id);
    },
  };
}

export const publicApiRatelimit = limiterFacade(limiters.publicApi);
export const tryOnPollRatelimit = limiterFacade(limiters.tryOnPoll);
export const merchantReadRatelimit = limiterFacade(limiters.merchantRead);
export const merchantWriteRatelimit = limiterFacade(limiters.merchantWrite);

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
