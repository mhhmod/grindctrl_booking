import { merchantReadRatelimit, merchantWriteRatelimit } from '@/lib/ratelimit';

type Limiter = {
  configured?: boolean;
  limit(identity: string): Promise<{ success: boolean; reset: number; reason?: string }>;
};

export type MerchantActionFailure = {
  ok: false;
  code: 'rate_limited' | 'unavailable' | 'forbidden';
  message: string;
  retryAfterSeconds?: number;
};

export function merchantActionFailure(error: unknown): MerchantActionFailure {
  if (error instanceof RequestRateLimitError) return {
    ok: false,
    code: error.status === 429 ? 'rate_limited' : 'unavailable',
    message: error.message,
    retryAfterSeconds: error.retryAfterSeconds,
  };
  return { ok: false, code: 'unavailable', message: 'Action temporarily unavailable. Please try again shortly.', retryAfterSeconds: 30 };
}

export class RequestRateLimitError extends Error {
  constructor(readonly status: 429 | 503, readonly retryAfterSeconds: number) {
    super(status === 429
      ? `Too many requests. Please try again in ${retryAfterSeconds} seconds.`
      : 'Service temporarily unavailable. Please try again shortly.');
    this.name = 'RequestRateLimitError';
  }
}

/** Never authorize costly work on an unavailable Redis or SDK timeout.
 * Upstash intentionally returns success:true on timeout; that is not proof
 * of capacity. No retry here: retrying would consume the same bucket twice. */
export async function requireRateLimit(limiter: Limiter | null, identity: string): Promise<void> {
  if (!limiter || limiter.configured === false) throw new RequestRateLimitError(503, 30);
  let result;
  try {
    result = await limiter.limit(identity);
  } catch {
    console.error('[ratelimit] enforcement unavailable');
    throw new RequestRateLimitError(503, 30);
  }
  if (!result || typeof result.success !== 'boolean'
    || result.reason === 'timeout' || !Number.isFinite(result.reset)) {
    console.error('[ratelimit] enforcement timed out or returned an invalid result');
    throw new RequestRateLimitError(503, 30);
  }
  if (!result.success) {
    const seconds = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
    throw new RequestRateLimitError(429, seconds);
  }
}

export function rateLimitErrorResponse(error: RequestRateLimitError): Response {
  return Response.json({
    ok: false,
    error: error.status === 429 ? 'rate_limited' : 'unavailable',
    message: error.message,
    retryAfterSeconds: error.retryAfterSeconds,
  }, {
    status: error.status,
    headers: { 'Retry-After': String(error.retryAfterSeconds), 'Cache-Control': 'no-store' },
  });
}

/** Identity must come from Clerk auth() or a VERIFIED Shopify session token,
 * never from a body, query string, or a shopper-controlled session id. */
export async function requireMerchantRateLimit(identity: string, mode: 'read' | 'write' = 'write') {
  await requireRateLimit(mode === 'read' ? merchantReadRatelimit : merchantWriteRatelimit, identity);
}

export async function merchantRateLimitResponse(identity: string, mode: 'read' | 'write' = 'write') {
  try {
    await requireMerchantRateLimit(identity, mode);
    return null;
  } catch (error) {
    if (error instanceof RequestRateLimitError) return rateLimitErrorResponse(error);
    throw error;
  }
}
