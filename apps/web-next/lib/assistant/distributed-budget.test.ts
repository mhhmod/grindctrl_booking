// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ eval: vi.fn(), configs: [] as Record<string, unknown>[] }));
vi.mock('@upstash/redis', () => ({
  Redis: class Redis {
    constructor(config: Record<string, unknown>) { mocks.configs.push(config); }
    eval = mocks.eval;
  },
}));
vi.mock('@/lib/ratelimit', () => ({ merchantReadRatelimit: null, merchantWriteRatelimit: null }));
import { RedisBudgetStore, checkDistributedBudget, getDistributedBudgetSummary } from './distributed-budget';
import { InMemoryStore } from './rate-limiter-store';
import { CHAT_MIN_RESERVATION_TOKENS, CHAT_MAX_COMPLETION_TOKENS, chatReservationTokens } from './chat-budget';
import { getResourceBudget } from './rate-limiter';

beforeEach(() => {
  vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://test.invalid');
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test');
  mocks.eval.mockReset();
  mocks.configs.length = 0;
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe('distributed assistant budgets', () => {
  it('uses an atomic expiring server-time draw, hashes identity, and never retries ambiguous spends', async () => {
    mocks.eval.mockResolvedValue([1, '4.5', '0']);
    expect(await new RedisBudgetStore().atomicDraw('private-tenant', 1, 5, 0.001)).toEqual({ allowed: true, remaining: 4.5, resetMs: 0 });
    const [script, keys, args] = mocks.eval.mock.calls[0];
    expect(script).toContain("redis.call('TIME')");
    expect(script).toContain("redis.call('PEXPIRE'");
    expect(script).toContain('if cost > 0 then');
    expect(keys).toEqual([expect.stringMatching(/^gc-assistant:budget:v1:[a-f0-9]{64}$/)]);
    expect(JSON.stringify(keys)).not.toContain('private-tenant');
    expect(args).toEqual([1, 5, 0.001]);
    expect(mocks.configs[0]).toMatchObject({ retry: false, signal: expect.any(AbortSignal) });
  });

  it('fails closed on missing Redis, rejected commands, malformed results or negative cost', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = new RedisBudgetStore();
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
    await expect(store.atomicDraw('id', 1, 5, 0.001)).rejects.toMatchObject({ status: 503 });
    expect(mocks.eval).not.toHaveBeenCalled();
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test');
    mocks.eval.mockRejectedValueOnce(new Error('credential-bearing URL'));
    await expect(store.atomicDraw('id', 1, 5, 0.001)).rejects.toMatchObject({ status: 503 });
    expect(mocks.eval).toHaveBeenCalledTimes(1);
    mocks.eval.mockResolvedValueOnce([1, 'NaN', 0]);
    await expect(store.atomicDraw('id', 1, 5, 0.001)).rejects.toMatchObject({ status: 503 });
    await expect(store.atomicDraw('id', -1, 5, 0.001)).rejects.toMatchObject({ status: 503 });
  });

  it('preserves existing capacities and conservatively accounts for prompt/history/completion', async () => {
    expect(CHAT_MAX_COMPLETION_TOKENS).toBe(1024);
    expect(CHAT_MIN_RESERVATION_TOKENS).toBeLessThan(getResourceBudget('anon', 'chat:tokens').capacity);
    expect(chatReservationTokens([{ role: 'user', content: 'ع' }])).toBeGreaterThan(chatReservationTokens([{ role: 'user', content: 'x' }]));
    const store = new InMemoryStore();
    const capacity = getResourceBudget('anon', 'chat:tokens').capacity;
    expect(await checkDistributedBudget(store, 'a', 'anon', 'chat:tokens', capacity)).toBeNull();
    expect(await checkDistributedBudget(store, 'a', 'anon', 'chat:tokens', 1)).toMatchObject({ signInCta: true });
    expect(await checkDistributedBudget(store, 'b', 'anon', 'chat:tokens', capacity)).toBeNull();
    const summary = await getDistributedBudgetSummary(new InMemoryStore(), 'a', 'anon');
    expect(summary.chat.remaining).toBe(Math.floor(capacity / CHAT_MIN_RESERVATION_TOKENS));
    expect(summary.voice.remaining).toBe(3);
  });
});
