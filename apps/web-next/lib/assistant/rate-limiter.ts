import type { RateLimiterStore } from './rate-limiter-store';

export type Tier = 'anon' | 'auth';
export type ResourceKey = 'chat:tokens' | 'stt:requests' | 'stt:audio_seconds' | 'tts:requests' | 'tts:characters';

interface BucketConfig {
  capacity: number;
  windowMs: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/* Provisional starter budgets, not a pricing decision — see the architecture
   doc. Anon: ~8 chat turns / 3 voice turns per rolling 24h. Auth: 5x anon,
   also provisional. "Turn" sizing: ~800 chat tokens, ~30s STT audio per
   voice turn, ~3 sentences/~600 chars of TTS reply per voice turn. */
const TIERS: Record<Tier, Record<ResourceKey, BucketConfig>> = {
  anon: {
    'chat:tokens': { capacity: 6_400, windowMs: DAY_MS },
    'stt:requests': { capacity: 3, windowMs: DAY_MS },
    'stt:audio_seconds': { capacity: 90, windowMs: DAY_MS },
    'tts:requests': { capacity: 9, windowMs: DAY_MS },
    'tts:characters': { capacity: 1_800, windowMs: DAY_MS },
  },
  auth: {
    'chat:tokens': { capacity: 32_000, windowMs: DAY_MS },
    'stt:requests': { capacity: 15, windowMs: DAY_MS },
    'stt:audio_seconds': { capacity: 450, windowMs: DAY_MS },
    'tts:requests': { capacity: 45, windowMs: DAY_MS },
    'tts:characters': { capacity: 9_000, windowMs: DAY_MS },
  },
};

export interface DrawResult {
  allowed: boolean;
  remaining: number;
  resetSeconds: number;
}

export function draw(
  store: RateLimiterStore,
  tenantId: string,
  tier: Tier,
  resource: ResourceKey,
  cost: number,
  now: number = Date.now(),
): DrawResult {
  const config = TIERS[tier][resource];
  const refillPerMs = config.capacity / config.windowMs;
  const key = `${tenantId}:${tier}:${resource}`;

  const result = store.atomicDraw(key, cost, config.capacity, refillPerMs, now);
  return {
    allowed: result.allowed,
    remaining: result.remaining,
    resetSeconds: Math.ceil(result.resetMs / 1000),
  };
}

/* What one "turn" costs in each resource, used only to translate raw token/
   character/second buckets into a single human "N turns left" number for
   the UI. Ratios match the tier budgets above (e.g. 6400 chat:tokens / 800
   per turn = 8 turns). Provisional, same as the budgets themselves. */
export const TURN_COST: Record<ResourceKey, number> = {
  'chat:tokens': 800,
  'stt:requests': 1,
  'stt:audio_seconds': 30,
  'tts:requests': 3,
  'tts:characters': 600,
};

const VOICE_RESOURCES: ResourceKey[] = ['stt:requests', 'stt:audio_seconds', 'tts:requests', 'tts:characters'];

interface TurnAvailability {
  turns: number;
  resetSeconds: number;
}

function turnAvailability(
  store: RateLimiterStore,
  tenantId: string,
  tier: Tier,
  resource: ResourceKey,
  now: number,
): TurnAvailability {
  const config = TIERS[tier][resource];
  const refillPerMs = config.capacity / config.windowMs;
  const peeked = store.atomicDraw(`${tenantId}:${tier}:${resource}`, 0, config.capacity, refillPerMs, now);

  const turnCost = TURN_COST[resource];
  const turns = Math.floor(peeked.remaining / turnCost);
  const shortfall = turnCost - peeked.remaining;
  // Divide through capacity/windowMs directly rather than via the derived
  // refillPerMs reciprocal — avoids compounding floating-point error.
  const resetSeconds = shortfall <= 0 ? 0 : Math.ceil((shortfall * config.windowMs) / config.capacity / 1000);

  return { turns, resetSeconds };
}

export interface BudgetSummary {
  chat: { remaining: number; resetSeconds: number };
  voice: { remaining: number; resetSeconds: number };
}

export function getBudgetSummary(
  store: RateLimiterStore,
  tenantId: string,
  tier: Tier,
  now: number = Date.now(),
): BudgetSummary {
  const chat = turnAvailability(store, tenantId, tier, 'chat:tokens', now);
  const voice = VOICE_RESOURCES.map((resource) => turnAvailability(store, tenantId, tier, resource, now)).reduce(
    (tightest, current) => (current.turns < tightest.turns ? current : tightest),
  );

  return {
    chat: { remaining: chat.turns, resetSeconds: chat.resetSeconds },
    voice: { remaining: voice.turns, resetSeconds: voice.resetSeconds },
  };
}
