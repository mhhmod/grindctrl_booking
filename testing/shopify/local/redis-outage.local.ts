// Run only while the actual disposable Redis container is stopped by stack.py.
import { beforeAll, afterAll, it, expect, vi } from 'vitest';
import { config } from './redis-fixture';
beforeAll(()=>{
 vi.stubEnv('UPSTASH_REDIS_REST_URL',config.url);vi.stubEnv('UPSTASH_REDIS_REST_TOKEN',config.token);
});
afterAll(()=>vi.unstubAllEnvs());
it('the original limiter fails closed during an actual Redis container outage',async()=>{
 const {merchantWriteRatelimit}=await import('@/lib/ratelimit');
 const {requireRateLimit}=await import('@/lib/request-rate-limit');
 expect(merchantWriteRatelimit.configured).toBe(true);
 await expect(requireRateLimit(merchantWriteRatelimit,'synthetic-outage')).rejects.toMatchObject({status:503});
});
