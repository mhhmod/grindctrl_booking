// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ from: vi.fn(), select: vi.fn(), in: vi.fn(), neq: vi.fn(), limit: vi.fn() }));
vi.mock('@/lib/messenger/db', () => ({ getMessengerServiceClient: () => db }));
import { freePlanReason } from './free-plan-reason';
beforeEach(() => { vi.clearAllMocks(); for (const key of ['from', 'select', 'in', 'neq'] as const) db[key].mockReturnValue(db); db.limit.mockResolvedValue({ data: [], error: null }); });
it('M9: an unverified Woo domain needs proof, without granting a plan', async () => {
  expect(await freePlanReason('s1', [])).toBe('no_verified_domain');
  expect(db.from).not.toHaveBeenCalled();
});
it('M9/m7: reads the real apex holder, excludes this site and returns no account details', async () => {
  db.limit.mockResolvedValueOnce({ data: [{ widget_site_id: 'private-other-site' }], error: null });
  expect(await freePlanReason('s1', ['www.shop.example.com'])).toBe('apex_taken');
  expect(db.in).toHaveBeenCalledWith('apex', ['example.com']);
  expect(db.neq).toHaveBeenCalledWith('widget_site_id', 's1');
  expect(await freePlanReason('s1', ['shop.example.com'])).toBeNull();
});
it('does not mistake a failed read for a free plan already claimed', async () => {
  db.limit.mockResolvedValue({ data: null, error: { code: 'offline' } });
  await expect(freePlanReason('s1', ['shop.example.com'])).rejects.toThrow('free plan claim read failed');
});
