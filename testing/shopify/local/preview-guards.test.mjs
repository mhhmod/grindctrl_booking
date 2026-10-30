import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { validateLocalRedis } from './preview-guards.mjs';
const token='synthetic-local-token-at-least-thirty-two-characters';
const config={redis_token_sha256:createHash('sha256').update(token).digest('hex')};
test('generated per-run Redis credential binds only to the fixed internal route',()=>{
 assert.doesNotThrow(()=>validateLocalRedis(config,{UPSTASH_REDIS_REST_URL:'http://gateway:8000/redis',UPSTASH_REDIS_REST_TOKEN:token}));
 for(const url of ['https://production.upstash.io','http://attacker.invalid/redis','http://gateway:8000/rest/v1']){
  assert.throws(()=>validateLocalRedis(config,{UPSTASH_REDIS_REST_URL:url,UPSTASH_REDIS_REST_TOKEN:token}),/binding_invalid/);
 }
 assert.throws(()=>validateLocalRedis(config,{UPSTASH_REDIS_REST_URL:'http://gateway:8000/redis',UPSTASH_REDIS_REST_TOKEN:'a-different-generated-token-over-32-characters'}),/binding_invalid/);
});
test('missing binding accepts no Redis credential and rejects a supplied hosted credential',()=>{
 assert.doesNotThrow(()=>validateLocalRedis({},{}));
 assert.throws(()=>validateLocalRedis({},{UPSTASH_REDIS_REST_TOKEN:token}),/binding_required/);
});
