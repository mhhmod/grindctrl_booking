// Real Redis and real @upstash/ratelimit Lua over the documented SRH adapter.
// No limiter, HTTP or Redis response is mocked.
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';
import { config, checkpointFile } from './redis-fixture';
const redis=()=>new Redis({url:config.url,token:config.token,retry:{retries:0}});
const prefix='gc-m1-real-rate:'+randomUUID();
let requireRateLimit:typeof import('@/lib/request-rate-limit').requireRateLimit;
beforeAll(async()=>{
 vi.stubEnv('UPSTASH_REDIS_REST_URL',config.url);vi.stubEnv('UPSTASH_REDIS_REST_TOKEN',config.token);
 ({requireRateLimit}=await import('@/lib/request-rate-limit'));
});
afterAll(()=>vi.unstubAllEnvs());
it('authenticates the real local Redis REST server and executes atomic Lua',async()=>{
 expect(await redis().ping()).toBe('PONG');
 const key=prefix+':lua';
 expect(await redis().eval('return redis.call("INCR", KEYS[1])',[key],[])).toBe(1);
 expect(await redis().eval('return redis.call("INCR", KEYS[1])',[key],[])).toBe(2);
});
it('enforces a shared one-request allowance under concurrent independent SDK clients',async()=>{
 const make=()=>new Ratelimit({redis:redis(),limiter:Ratelimit.slidingWindow(1,'60 s'),
   prefix,ephemeralCache:false,analytics:false,timeout:2000});
 const [a,b]=await Promise.all([make().limit('concurrent'),make().limit('concurrent')]);
 expect([a,b].filter(x=>x.success)).toHaveLength(1);
 expect([a,b].filter(x=>!x.success)).toHaveLength(1);
 expect([a,b].every(x=>Number.isFinite(x.reset))).toBe(true);
 await expect(requireRateLimit(make(),'concurrent')).rejects.toMatchObject({status:429});
 writeFileSync(checkpointFile,JSON.stringify({prefix,identity:'concurrent'}),{flag:'wx',mode:0o600});
});
it('uses the original shared merchant limiter and strict production enforcement',async()=>{
 const {merchantWriteRatelimit}=await import('@/lib/ratelimit');
 expect(merchantWriteRatelimit.configured).toBe(true);
 const identity='synthetic-owner:'+randomUUID();let allowed=0,denied=0;
 for(let i=0;i<16;i++){
  await Promise.all([0,1].map(async()=>{
   try{await requireRateLimit(merchantWriteRatelimit,identity);allowed++;}
   catch(error){expect(error).toMatchObject({status:429});denied++;}
  }));
 }
 expect(allowed).toBe(30);expect(denied).toBe(2);
});
it('denies a wrong REST token and never treats authentication failure as allowance',async()=>{
 const bad=new Redis({url:config.url,token:'invalid-local-test-token',retry:{retries:0}});
 const limiter=new Ratelimit({redis:bad,limiter:Ratelimit.slidingWindow(1,'60 s'),
   prefix:prefix+':bad',ephemeralCache:false,analytics:false,timeout:2000});
 await expect(requireRateLimit(limiter,'synthetic')).rejects.toMatchObject({status:503});
});
