// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), select: vi.fn(), eq: vi.fn(), gte: vi.fn(), order: vi.fn(), limit: vi.fn() }));
vi.mock('@/lib/messenger/db', () => ({ getMessengerServiceClient: () => db }));
import { readSignatureFailures, recordSignatureHealth } from './signature-signals';
beforeEach(() => { vi.clearAllMocks(); for (const key of ['from', 'select', 'eq', 'gte', 'order'] as const) db[key].mockReturnValue(db); db.limit.mockResolvedValue({ data: [], error: null }); db.rpc.mockResolvedValue({ error: null }); });
it('M10: records both refusals and verification, without persisting the signature', async () => {
  for (const outcome of ['bad_signature', 'stale_signature', 'verified'] as const) {
    await recordSignatureHealth('s1', outcome);
    expect(db.rpc).toHaveBeenLastCalledWith('record_store_signature_health', { p_site: 's1', p_outcome: outcome });
  }
});
it('M10: isolates sites, counts recent failures, clears the warning after verified code returns', async () => {
  const row = { bad_count: 3, stale_count: 2, failed_at: '2026-11-11T01:00:00Z', verified_at: null };
  db.limit.mockResolvedValueOnce({ data: [row], error: null });
  expect(await readSignatureFailures('s1', Date.parse('2026-11-11T02:00:00Z'))).toBe(5);
  expect(db.eq).toHaveBeenCalledWith('site_id', 's1');
  db.limit.mockResolvedValueOnce({ data: [{ ...row, verified_at: '2026-11-11T01:01:00Z' }], error: null });
  expect(await readSignatureFailures('s1', Date.parse('2026-11-11T02:00:00Z'))).toBe(0);
});
it('keeps telemetry failure out of the signed render response, but logs it', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  db.rpc.mockRejectedValueOnce(new Error('offline'));
  await expect(recordSignatureHealth('s1', 'bad_signature')).resolves.toBeUndefined();
  expect(log).toHaveBeenCalled(); log.mockRestore();
});
