// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ operator: vi.fn(), exists: vi.fn(), write: vi.fn(), rate: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/shopify/platform-operator', () => ({ requireTryOnPlatformOperator: mocks.operator, PlatformOperatorRequiredError: class extends Error {} }));
vi.mock('@/lib/request-rate-limit', () => ({ requireMerchantRateLimit: mocks.rate }));
vi.mock('@/lib/spend/store', () => ({ writeSpendLimit: mocks.write }));
vi.mock('@/lib/flags/store-flags', async original => ({ ...await original<typeof import('@/lib/flags/store-flags')>(), storeExists: mocks.exists }));
import { PlatformOperatorRequiredError } from '@/lib/shopify/platform-operator';
import { setStoreSpendLimit } from './spend-actions';
const input = { tenant: 'lulu.myshopify.com', key: 'tryOnDailyLooks' as const, value: 300 };
beforeEach(() => { vi.clearAllMocks(); mocks.operator.mockResolvedValue('operator-1'); mocks.exists.mockResolvedValue(true); mocks.write.mockResolvedValue(undefined); mocks.rate.mockResolvedValue(undefined); });
describe('operator-only daily limits', () => {
 it('refuses non-operators before any store write', async () => {
   mocks.operator.mockRejectedValue(new PlatformOperatorRequiredError()); expect(await setStoreSpendLimit(input)).toEqual({ ok: false, code: 'forbidden' }); expect(mocks.write).not.toHaveBeenCalled();
 });
 it('refuses unknown stores', async () => {
   mocks.exists.mockResolvedValue(false); expect(await setStoreSpendLimit(input)).toEqual({ ok: false, code: 'unknown_store' }); expect(mocks.write).not.toHaveBeenCalled();
 });
 it.each([-1, 100001, 1.5, NaN])('refuses invalid bounds %s', async value => {
   expect(await setStoreSpendLimit({ ...input, value })).toEqual({ ok: false, code: 'invalid' }); expect(mocks.write).not.toHaveBeenCalled();
 });
 it.each([0, 100000, null])('saves %s with the server-derived operator id', async value => {
   expect(await setStoreSpendLimit({ ...input, value })).toEqual({ ok: true }); expect(mocks.write).toHaveBeenCalledWith(input.tenant, input.key, value, 'operator-1');
 });
 it('refuses a rate-limit outage and surfaces storage failure as a save failure', async () => {
   mocks.rate.mockRejectedValue(Error('down')); expect(await setStoreSpendLimit(input)).toMatchObject({ ok: false }); expect(mocks.write).not.toHaveBeenCalled();
 });
});
