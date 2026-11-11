// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ limits: vi.fn(), usage: vi.fn() }));
vi.mock('@/lib/spend/store', () => ({ readSpendLimits: mocks.limits }));
vi.mock('@/lib/spend/daily-counter', async original => ({ ...await original<typeof import('@/lib/spend/daily-counter')>(), readDailyUsage: mocks.usage }));
import { claimTryOnDailyBudget, siteDailyLooks, globalDailyLooks, readTryOnDayStatus, tryOnDayAvailability } from './daily-budget';
import type { DailyCounter } from '@/lib/spend/daily-counter';
import { effectiveSpendLimit, spendLimits, validSpendLimit } from '@/lib/spend/limits';
const now = new Date('2026-11-11T23:59:00Z');
beforeEach(() => { mocks.limits.mockReset().mockResolvedValue({}); mocks.usage.mockReset().mockResolvedValue([0, 0]); });
afterEach(() => vi.unstubAllEnvs());
function counter(): DailyCounter {
 const counts = new Map<string, number>();
 return async ([site, global], a, b) => {
   if ((counts.get(site) ?? 0) >= a) return 2;
   if ((counts.get(global) ?? 0) >= b) return 3;
   counts.set(site, (counts.get(site) ?? 0) + 1); counts.set(global, (counts.get(global) ?? 0) + 1); return 1;
 };
}
describe('merchant daily ceilings', () => {
 it('defaults to 300/5000 and reads environment each call', () => {
   vi.stubEnv('TRYON_SITE_DAILY_LOOKS', ''); vi.stubEnv('TRYON_GLOBAL_DAILY_LOOKS', '');
   expect([siteDailyLooks(), globalDailyLooks()]).toEqual([300, 5000]);
   vi.stubEnv('TRYON_SITE_DAILY_LOOKS', '8'); expect(siteDailyLooks()).toBe(8);
   vi.stubEnv('TRYON_GLOBAL_DAILY_LOOKS', 'no'); expect(globalDailyLooks()).toBe(5000);
 });
 it('claims site and global together; refused stores do not consume global allowance', async () => {
   const count = counter(); vi.stubEnv('TRYON_SITE_DAILY_LOOKS', '1'); vi.stubEnv('TRYON_GLOBAL_DAILY_LOOKS', '2');
   expect(await claimTryOnDailyBudget('a', { counter: count, now })).toBe('allowed');
   expect(await claimTryOnDailyBudget('a', { counter: count, now })).toBe('site_exhausted');
   expect(await claimTryOnDailyBudget('b', { counter: count, now })).toBe('allowed');
   expect(await claimTryOnDailyBudget('c', { counter: count, now })).toBe('global_exhausted');
 });
 it.each(['TRYON_SITE_DAILY_LOOKS', 'TRYON_GLOBAL_DAILY_LOOKS'])('0 stops %s', async name => {
   vi.stubEnv(name, '0'); const count = vi.fn();
   expect(await claimTryOnDailyBudget('a', { counter: count })).toBe(name.includes('GLOBAL') ? 'global_exhausted' : 'site_exhausted');
   expect(count).not.toHaveBeenCalled();
 });
 it('uses one UTC day/slot and resets at midnight', async () => {
   const count = counter(); vi.stubEnv('TRYON_SITE_DAILY_LOOKS', '1');
   expect(await claimTryOnDailyBudget('site:abc', { counter: count, now })).toBe('allowed');
   expect(await claimTryOnDailyBudget('site:abc', { counter: count, now })).toBe('site_exhausted');
   expect(await claimTryOnDailyBudget('site:abc', { counter: count, now: new Date('2026-11-12T00:00:00Z') })).toBe('allowed');
   const spy = vi.fn<DailyCounter>().mockResolvedValue(1);
   await claimTryOnDailyBudget('a', { counter: spy, now });
   expect(spy).toHaveBeenCalledWith(['gc-tryon:{2026-11-11}:site:a', 'gc-tryon:{2026-11-11}:all'], 1, 5000, 172800);
 });
 it('fails closed on missing Redis, malformed answers and settings failure', async () => {
   vi.stubEnv('UPSTASH_REDIS_REST_URL', ''); vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
   expect(await claimTryOnDailyBudget('a')).toBe('unavailable');
   for (const answer of [0, 9, null, undefined]) expect(await claimTryOnDailyBudget('a', { counter: async () => answer as number })).toBe('unavailable');
   expect(await claimTryOnDailyBudget('a', { counter: async () => { throw Error('timeout'); } })).toBe('unavailable');
   mocks.limits.mockRejectedValue(Error('DB down'));
   const count = vi.fn(); expect(await claimTryOnDailyBudget('a', { counter: count })).toBe('unavailable'); expect(count).not.toHaveBeenCalled();
 });
 it('uses the operator override ahead of env, including 0', async () => {
   vi.stubEnv('TRYON_SITE_DAILY_LOOKS', '1'); mocks.limits.mockResolvedValue({ tryOnDailyLooks: 2 }); const count = counter();
   expect(await claimTryOnDailyBudget('a', { counter: count })).toBe('allowed'); expect(await claimTryOnDailyBudget('a', { counter: count })).toBe('allowed');
   mocks.limits.mockResolvedValue({ tryOnDailyLooks: 0 }); expect(await claimTryOnDailyBudget('a', { counter: count })).toBe('site_exhausted');
 });
 it('hides at either ceiling; reports unknown separately from exhaustion', async () => {
   mocks.usage.mockResolvedValue([300, 300]); expect(await tryOnDayAvailability('a')).toBe('daily_limit');
   mocks.usage.mockResolvedValue([1, 5000]); expect(await readTryOnDayStatus('a', now)).toMatchObject({ reached: true });
   mocks.usage.mockRejectedValue(Error('down')); expect(await tryOnDayAvailability('a')).toBe('unavailable');
 });
});
describe('override bounds', () => {
 it.each([-1, 100001, 1.5, NaN, Infinity, '5', null, undefined])('rejects %s', value => {
   expect(validSpendLimit(value)).toBe(false); expect(effectiveSpendLimit(value, 300)).toBe(300);
   expect(spendLimits({ spend_limits: { tryOnDailyLooks: value } })).toEqual({});
 });
 it.each([0, 1, 100000])('accepts %s', value => expect(spendLimits({ spend_limits: { tryOnDailyLooks: value } })).toEqual({ tryOnDailyLooks: value }));
});

it('M12: distinguishes store and all-stores ceilings with the next UTC reset instant', async () => {
  mocks.usage.mockResolvedValue([1, 5000]);
  expect(await readTryOnDayStatus('a', now)).toMatchObject({ cause: 'global', resetAt: '2026-11-12T00:00:00.000Z' });
  mocks.usage.mockResolvedValue([300, 5000]);
  expect(await readTryOnDayStatus('a', now)).toMatchObject({ cause: 'store' });
});
