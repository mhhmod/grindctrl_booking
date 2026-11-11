// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ set: vi.fn(), snapshot: vi.fn(), send: vi.fn() }));
vi.mock('@/lib/paste/redis', () => ({ pasteRedis: () => ({ set: m.set }) }));
vi.mock('./snapshot', () => ({ readSpendSnapshot: m.snapshot }));
vi.mock('@/lib/email/spend-sender', () => ({ sendSpendEmail: m.send }));
import { runSpendAlerts } from './alerts';
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('PLATFORM_ALERT_EMAIL', 'operator@example.com'); m.set.mockResolvedValue('OK'); m.send.mockResolvedValue('sent'); m.snapshot.mockResolvedValue({ global: [{ feature: 'Try-On demo', used: 150, limit: 150 }], stores: [] }); });
afterEach(() => vi.unstubAllEnvs());
it('uses SET NX with a 2-day TTL and separate 80/100 keys for one UTC day', async () => {
 await runSpendAlerts(undefined, new Date('2026-11-11T23:30:00Z'));
 expect(m.set).toHaveBeenCalledWith('gc-spend-alert:{2026-11-11}:global:Try-On demo:80', '1', { nx: true, ex: 172800 });
 expect(m.set).toHaveBeenCalledWith('gc-spend-alert:{2026-11-11}:global:Try-On demo:100', '1', { nx: true, ex: 172800 });
 expect(m.send).toHaveBeenCalledTimes(2);
});
it('does not send for a non-claim or failed counters', async () => {
 m.set.mockResolvedValue(null); await runSpendAlerts(); expect(m.send).not.toHaveBeenCalled();
 m.snapshot.mockRejectedValue(Error('Redis down')); await expect(runSpendAlerts()).rejects.toThrow('Redis down'); expect(m.send).not.toHaveBeenCalled();
});
