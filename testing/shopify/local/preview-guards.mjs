import { createHash } from 'node:crypto';

// Only a generated credential bound to this run's fixed internal Redis route.
// Never accept a hosted Redis URL/token or relax the external egress boundary.
export function validateLocalRedis(c,env){
  const url=env.UPSTASH_REDIS_REST_URL,token=env.UPSTASH_REDIS_REST_TOKEN;
  if(c.redis_token_sha256===undefined){
    if(url||token)throw new Error('local_preview_redis_binding_required');
    return;
  }
  if(!/^[a-f0-9]{64}$/.test(c.redis_token_sha256)||url!=='http://gateway:8000/redis'
    ||typeof token!=='string'||token.length<32
    ||createHash('sha256').update(token).digest('hex')!==c.redis_token_sha256){
    throw new Error('local_preview_redis_binding_invalid');
  }
}
