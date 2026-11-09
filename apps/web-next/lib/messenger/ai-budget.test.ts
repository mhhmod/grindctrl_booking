// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  claimAiBudgetAlert,
  claimAiTurnBudget,
  DEFAULT_GLOBAL_DAILY_AI_TURNS,
  DEFAULT_SITE_DAILY_AI_TURNS,
  globalDailyAiTurns,
  siteDailyAiTurns,
  type AiTurnCounter,
} from './ai-budget';

afterEach(() => vi.unstubAllEnvs());

/** Both daily counters as the script keeps them. */
function memoryCounter(): AiTurnCounter {
  const counts = new Map<string, number>();
  return async ([site, global], siteLimit, globalLimit) => {
    if ((counts.get(site) ?? 0) >= siteLimit) return 2;
    if ((counts.get(global) ?? 0) >= globalLimit) return 3;
    counts.set(site, (counts.get(site) ?? 0) + 1);
    counts.set(global, (counts.get(global) ?? 0) + 1);
    return 1;
  };
}

describe('AI turn budget settings', () => {
  it('defaults to 2000 per site and 50000 overall, read from env per call', () => {
    vi.stubEnv('MESSENGER_AI_SITE_DAILY_TURNS', '');
    vi.stubEnv('MESSENGER_AI_GLOBAL_DAILY_TURNS', '');
    expect(siteDailyAiTurns()).toBe(DEFAULT_SITE_DAILY_AI_TURNS);
    expect(globalDailyAiTurns()).toBe(DEFAULT_GLOBAL_DAILY_AI_TURNS);
    expect([DEFAULT_SITE_DAILY_AI_TURNS, DEFAULT_GLOBAL_DAILY_AI_TURNS]).toEqual([2000, 50000]);
    vi.stubEnv('MESSENGER_AI_SITE_DAILY_TURNS', '25');
    vi.stubEnv('MESSENGER_AI_GLOBAL_DAILY_TURNS', 'nope');
    expect(siteDailyAiTurns()).toBe(25);
    expect(globalDailyAiTurns()).toBe(DEFAULT_GLOBAL_DAILY_AI_TURNS);
  });
});

describe('claimAiTurnBudget', () => {
  it('counts turns per site and stops a site at its limit while others continue', async () => {
    vi.stubEnv('MESSENGER_AI_SITE_DAILY_TURNS', '2');
    const counter = memoryCounter();
    const results = [];
    for (let i = 0; i < 3; i += 1) results.push(await claimAiTurnBudget('site-a', { counter }));
    expect(results).toEqual(['allowed', 'allowed', 'site_exhausted']);
    expect(await claimAiTurnBudget('site-b', { counter })).toBe('allowed');
  });

  it('trips the global breaker across sites', async () => {
    vi.stubEnv('MESSENGER_AI_GLOBAL_DAILY_TURNS', '2');
    const counter = memoryCounter();
    expect(await claimAiTurnBudget('site-a', { counter })).toBe('allowed');
    expect(await claimAiTurnBudget('site-b', { counter })).toBe('allowed');
    expect(await claimAiTurnBudget('site-c', { counter })).toBe('global_exhausted');
  });

  it('stops every site at once when the breaker is set to 0, without asking Redis', async () => {
    vi.stubEnv('MESSENGER_AI_GLOBAL_DAILY_TURNS', '0');
    const counter = vi.fn<AiTurnCounter>();
    expect(await claimAiTurnBudget('site-a', { counter })).toBe('global_exhausted');
    expect(counter).not.toHaveBeenCalled();
  });

  it('keys one UTC day, both counters in one slot', async () => {
    const counter = vi.fn<AiTurnCounter>().mockResolvedValue(1);
    await claimAiTurnBudget('site-a', { counter, now: new Date('2026-11-09T23:30:00Z') });
    expect(counter).toHaveBeenCalledWith(['gc-msgr-ai:{2026-11-09}:site:site-a', 'gc-msgr-ai:{2026-11-09}:all'], 2000, 50000, 172800);
  });

  it('fails closed when Redis throws, answers oddly or is not configured', async () => {
    expect(await claimAiTurnBudget('site-a', { counter: async () => { throw new Error('timeout'); } })).toBe('unavailable');
    expect(await claimAiTurnBudget('site-a', { counter: async () => 9 })).toBe('unavailable');
    vi.stubEnv('UPSTASH_REDIS_REST_URL', ''); vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
    expect(await claimAiTurnBudget('site-a')).toBe('unavailable');
  });
});

describe('claimAiBudgetAlert', () => {
  it('lets one caller a day send the alert and refuses on any doubt', async () => {
    const claimed = new Set<string>();
    const claim = async (key: string) => (claimed.has(key) ? false : (claimed.add(key), true));
    const now = new Date('2026-11-09T10:00:00Z');
    expect(await claimAiBudgetAlert('site-a', { now, claim })).toBe(true);
    expect(await claimAiBudgetAlert('site-a', { now, claim })).toBe(false);
    expect(await claimAiBudgetAlert('site-a', { now: new Date('2026-11-10T00:00:01Z'), claim })).toBe(true);
    expect(await claimAiBudgetAlert('site-a', { claim: async () => { throw new Error('down'); } })).toBe(false);
  });
});
