import { createHash } from 'node:crypto';
import { Redis } from '@upstash/redis';
import { RequestRateLimitError } from '@/lib/request-rate-limit';
import { getResourceBudget, TURN_COST, type BudgetSummary, type ResourceKey, type Tier } from './rate-limiter';
import { RateLimitedError } from './errors';
import type { DrawResult } from './rate-limiter-store';
import { CHAT_MIN_RESERVATION_TOKENS } from './chat-budget';

type BudgetStore = {
  atomicDraw(key: string, cost: number, capacity: number, refillPerMs: number, now: number): DrawResult | Promise<DrawResult>;
};

// Server-time atomic token bucket: every instance sees the same spend. A
// zero-cost availability read does not create keys or mutate the budget.
// TTL is one complete refill period, so an expired bucket is genuinely full.
export const DRAW_SCRIPT = `
local clock = redis.call('TIME')
local now = tonumber(clock[1]) * 1000 + math.floor(tonumber(clock[2]) / 1000)
local cost = tonumber(ARGV[1])
local capacity = tonumber(ARGV[2])
local refill = tonumber(ARGV[3])
local row = redis.call('HMGET', KEYS[1], 'tokens', 'at')
local tokens = tonumber(row[1]) or capacity
local at = tonumber(row[2]) or now
tokens = math.min(capacity, tokens + math.max(0, now - at) * refill)
local allowed = 0
local reset = 0
if tokens >= cost then
  allowed = 1
  tokens = tokens - cost
else
  reset = math.ceil((cost - tokens) / refill)
end
if cost > 0 then
  redis.call('HSET', KEYS[1], 'tokens', tostring(tokens), 'at', tostring(now))
  redis.call('PEXPIRE', KEYS[1], math.ceil(capacity / refill))
end
return {allowed, tostring(tokens), tostring(reset)}
`;

export class RedisBudgetStore implements BudgetStore {
  async atomicDraw(key: string, cost: number, capacity: number, refillPerMs: number): Promise<DrawResult> {
    if (![cost, capacity, refillPerMs].every(Number.isFinite) || cost < 0 || capacity <= 0 || refillPerMs <= 0) {
      throw new RequestRateLimitError(503, 30);
    }
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) throw new RequestRateLimitError(503, 30);
    try {
      // No automatic retry for a possibly committed draw; an ambiguous
      // response must not double-charge, nor authorize a provider call.
      const redis = new Redis({ url, token, retry: false, signal: AbortSignal.timeout(5000) });
      const identity = createHash('sha256').update(key).digest('hex');
      const result = await redis.eval(DRAW_SCRIPT, [`gc-assistant:budget:v1:${identity}`], [cost, capacity, refillPerMs]);
      if (!Array.isArray(result) || result.length !== 3) throw new Error('Invalid budget result');
      const [allowed, remaining, resetMs] = result.map(Number);
      if (![allowed, remaining, resetMs].every(Number.isFinite) || ![0, 1].includes(allowed) || remaining < 0 || remaining > capacity || resetMs < 0) {
        throw new Error('Invalid budget result');
      }
      return { allowed: allowed === 1, remaining, resetMs };
    } catch {
      console.error('[assistant] distributed budget unavailable');
      throw new RequestRateLimitError(503, 30);
    }
  }
}

export async function checkDistributedBudget(store: BudgetStore, tenantId: string, tier: Tier, resource: ResourceKey, cost: number) {
  const config = getResourceBudget(tier, resource);
  const result = await store.atomicDraw(`${tenantId}:${tier}:${resource}`, cost, config.capacity, config.capacity / config.windowMs, Date.now());
  return result.allowed ? null : new RateLimitedError(Math.max(1, Math.ceil(result.resetMs / 1000)), tier === 'anon');
}

export async function getDistributedBudgetSummary(store: BudgetStore, tenantId: string, tier: Tier): Promise<BudgetSummary> {
  async function available(resource: ResourceKey) {
    const config = getResourceBudget(tier, resource);
    const result = await store.atomicDraw(`${tenantId}:${tier}:${resource}`, 0, config.capacity, config.capacity / config.windowMs, Date.now());
    const turnCost = resource === 'chat:tokens' ? CHAT_MIN_RESERVATION_TOKENS : TURN_COST[resource];
    return {
      remaining: Math.floor(result.remaining / turnCost),
      resetSeconds: Math.max(0, Math.ceil(((turnCost - result.remaining) * config.windowMs) / config.capacity / 1000)),
    };
  }
  const [chat, ...voice] = await Promise.all([
    available('chat:tokens'), available('stt:requests'), available('stt:audio_seconds'),
    available('tts:requests'), available('tts:characters'),
  ]);
  return { chat, voice: voice.reduce((a, b) => b.remaining < a.remaining || (b.remaining === a.remaining && b.resetSeconds > a.resetSeconds) ? b : a) };
}

/** Keep the SSE contract on chat/TTS errors so the existing UI can recover. */
export function budgetUnavailableStreamResponse() {
  return new Response(`event: error\ndata: ${JSON.stringify({ type: 'provider_unavailable', message: 'Service temporarily unavailable. Please try again shortly.' })}\n\n`, {
    status: 503,
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', 'Retry-After': '30' },
  });
}
