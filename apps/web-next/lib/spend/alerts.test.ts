// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runSpendAlerts, type SpendAlertDependencies } from './alerts';
import type { SpendSnapshot } from './snapshot';
let snapshot: SpendSnapshot; let deps: SpendAlertDependencies; let claims: Set<string>;
beforeEach(() => {
 vi.stubEnv('PLATFORM_ALERT_EMAIL', 'operator@example.com'); claims = new Set();
 snapshot = { global: [{ feature: 'Try-On', used: 79, limit: 100 }], stores: [] };
 deps = { snapshot: vi.fn(async () => snapshot), claim: vi.fn(async key => { if (claims.has(key)) return false; claims.add(key); return true; }), send: vi.fn(async () => 'sent' as const) };
});
afterEach(() => vi.unstubAllEnvs());
const now = new Date('2026-11-11T12:00:00Z');
describe('daily platform spend alerts', () => {
 it.each(['Store Chat', 'Try-On', 'Try-On demo'] as const)('sends 80%% and 100%% once per UTC day for %s', async feature => {
   snapshot.global[0].feature = feature;
   await runSpendAlerts(deps, now); expect(deps.send).not.toHaveBeenCalled();
   snapshot.global[0].used = 80; await runSpendAlerts(deps, now); await runSpendAlerts(deps, now); expect(deps.send).toHaveBeenCalledTimes(1);
   snapshot.global[0].used = 100; await runSpendAlerts(deps, now); await runSpendAlerts(deps, now); expect(deps.send).toHaveBeenCalledTimes(2);
   await runSpendAlerts(deps, new Date('2026-11-12T00:00:00Z')); expect(deps.send).toHaveBeenCalledTimes(4);
 });
 it('sends once per store per day and includes top three stores', async () => {
   snapshot.stores = [1, 2, 3, 4].map(n => ({ store: 'store-' + n, feature: 'Try-On', used: n * 100, limit: n * 100 }));
   await runSpendAlerts(deps, now); await runSpendAlerts(deps, now); expect(deps.send).toHaveBeenCalledTimes(4);
   expect(deps.send).toHaveBeenCalledWith(expect.objectContaining({ topStores: [{ store: 'store-4', used: 400 }, { store: 'store-3', used: 300 }, { store: 'store-2', used: 200 }] }), 'operator@example.com');
 });
 it('keeps dedupe on SMTP uncertainty; Redis failure cannot send', async () => {
   snapshot.global[0].used = 80; vi.mocked(deps.send).mockRejectedValue(Error('SMTP accepted?'));
   await runSpendAlerts(deps, now); await runSpendAlerts(deps, now); expect(deps.send).toHaveBeenCalledOnce();
   vi.mocked(deps.claim).mockRejectedValue(Error('Redis down')); await expect(runSpendAlerts(deps, now)).rejects.toThrow('Redis down'); expect(deps.send).toHaveBeenCalledOnce();
 });
 it('treats 0 as reached', async () => {
   snapshot.global[0] = { feature: 'Store Chat', used: 0, limit: 0 }; await runSpendAlerts(deps, now); expect(deps.send).toHaveBeenCalledTimes(2);
 });
 it('skips without address and logs once per process', async () => {
   vi.stubEnv('PLATFORM_ALERT_EMAIL', ''); const log = vi.spyOn(console, 'info').mockImplementation(() => {});
   await runSpendAlerts(deps, now); await runSpendAlerts(deps, now);
   expect(log).toHaveBeenCalledTimes(1); expect(deps.snapshot).not.toHaveBeenCalled(); expect(deps.send).not.toHaveBeenCalled(); log.mockRestore();
 });
});
