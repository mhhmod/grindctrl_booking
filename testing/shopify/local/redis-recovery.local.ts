// Fresh process after actual Redis restart; the quota must survive on its AOF.
import { readFileSync } from 'node:fs';
import { it, expect } from 'vitest';
import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';
import { config,checkpointFile } from './redis-fixture';
it('retains the existing spent quota after actual Redis restart',async()=>{
 const record=JSON.parse(readFileSync(checkpointFile,'utf8'));
 const redis=new Redis({url:config.url,token:config.token,retry:{retries:0}});
 expect(await redis.ping()).toBe('PONG');
 // The spend itself must have survived the restart (AOF), whatever the clock says.
 expect(record.keys).toHaveLength(1);
 expect(Number(await redis.get(record.keys[0]))).toBeGreaterThanOrEqual(1);
 expect(await redis.pttl(record.keys[0])).toBeGreaterThan(0);
 // Upstash weights the previous bucket with floor((1-elapsed)*count), which is 0 for a single
 // request once the minute boundary passes, so denial is only defined inside the spent bucket.
 if(Date.now()>=record.reset)return;
 const limiter=new Ratelimit({redis,limiter:Ratelimit.slidingWindow(1,'60 s'),
   prefix:record.prefix,ephemeralCache:false,analytics:false,timeout:2000});
 const result=await limiter.limit(record.identity);
 expect(result.success).toBe(false);expect(Number.isFinite(result.reset)).toBe(true);
});
