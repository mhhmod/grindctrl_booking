// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ eval: vi.fn(), mget: vi.fn() }));
vi.mock('@/lib/paste/redis', async original => ({ ...await original<typeof import('@/lib/paste/redis')>(), pasteRedis: () => m }));
import { claimDailyBudget, readDailyUsage, CLAIM_DAILY_SCRIPT } from './daily-counter';
beforeEach(() => { m.eval.mockReset().mockResolvedValue(1); m.mget.mockReset().mockResolvedValue([null, '12']); });
it('claims both keys with one script call and a two-day TTL, with no retry on failure', async () => {
 const keys: [string, string] = ['site:{day}', 'all:{day}'];
 expect(await claimDailyBudget(keys, 3, 5)).toBe('allowed');
 expect(m.eval).toHaveBeenCalledWith(CLAIM_DAILY_SCRIPT, keys, ['3', '5', '172800']); expect(m.eval).toHaveBeenCalledOnce();
 m.eval.mockReset().mockRejectedValue(Error('down')); expect(await claimDailyBudget(keys, 3, 5)).toBe('unavailable'); expect(m.eval).toHaveBeenCalledOnce();
});
it('bulk reads missing counters as zero but rejects malformed and partial results', async () => {
 expect(await readDailyUsage(['a', 'b'])).toEqual([0, 12]);
 for (const raw of [[null], [null, undefined], [null, -1], [null, 1.5], [null, 'oops']]) { m.mget.mockResolvedValue(raw); await expect(readDailyUsage(['a', 'b'])).rejects.toThrow(); }
});
