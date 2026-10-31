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
 const limiter=new Ratelimit({redis,limiter:Ratelimit.slidingWindow(1,'60 s'),
   prefix:record.prefix,ephemeralCache:false,analytics:false,timeout:2000});
 const result=await limiter.limit(record.identity);
 expect(result.success).toBe(false);expect(Number.isFinite(result.reset)).toBe(true);
});
