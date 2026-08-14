import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

/* Guards the public, unauthenticated, AI-cost-incurring routes: the try-on
   flow (session/generate/jobs/config) and the landing-sandbox demo. Every
   request to those without this would be a way to run up the OpenRouter
   bill for free. Not wired to anything requiring auth — those already have
   a real identity to rate-limit or ban by, this is specifically for the
   surface a script can hit anonymously. */
export const publicApiRatelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '10 s'),
  analytics: true,
  prefix: 'gc-ratelimit',
});

export function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? '127.0.0.1';
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
