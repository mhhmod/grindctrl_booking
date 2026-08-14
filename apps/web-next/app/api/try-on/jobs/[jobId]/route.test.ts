import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

/* This suite exercises job lookup, not the rate limiter — real limiter calls
   @upstash/redis over the network, which vitest can't do (it doesn't load
   .env.local the way Next.js does, so Redis.fromEnv() has no credentials
   here regardless). */
vi.mock('@/lib/ratelimit', () => ({
  publicApiRatelimit: { limit: vi.fn().mockResolvedValue({ success: true, reset: Date.now() + 10_000 }) },
  clientIp: () => 'test-ip',
  rateLimitedResponse: () => new Response(JSON.stringify({ error: 'Too many requests' }), { status: 429 }),
}));

import { GET } from '@/app/api/try-on/jobs/[jobId]/route';
import { generateTryOn } from '@/lib/try-on/service';

describe('GET /api/try-on/jobs/[jobId]', () => {
  it('returns the job fields in the top-level response envelope', async () => {
    const job = await generateTryOn('sess_test', 'premium-ringer-tee', 'upload');
    const response = await GET(new NextRequest(`http://localhost/api/try-on/jobs/${job.jobId}`), {
      params: Promise.resolve({ jobId: job.jobId }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.jobId).toBe(job.jobId);
    expect(body.status).toBe('completed');
    expect(body.resultImageUrl).toBe('/try-on/mock-result.png');
    expect(body.productId).toBe('premium-ringer-tee');
    expect(body.message).toMatch(/mock mode/i);
    expect(body.meta.runtime).toBe('mock');
    expect(body.data).toBeUndefined();
  });
});
