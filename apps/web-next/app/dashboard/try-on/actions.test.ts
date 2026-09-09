// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ owned: vi.fn(), limit: vi.fn(), save: vi.fn(), revalidate: vi.fn() }));
vi.mock('@/lib/shopify/shops', () => ({ requireManagedTryOnShop: mocks.owned }));
vi.mock('@/lib/try-on/settings', () => ({ saveTryOnSettings: mocks.save }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }));
vi.mock('@/lib/request-rate-limit', async (original) => ({
  ...await original<typeof import('@/lib/request-rate-limit')>(), requireMerchantRateLimit: mocks.limit,
}));
import { RequestRateLimitError } from '@/lib/request-rate-limit';
import { saveTryOnSettingsAction } from './actions';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.owned.mockResolvedValue('owned.myshopify.com');
  mocks.save.mockResolvedValue(true);
});

describe('Try-On settings safe action result', () => {
  it('returns rate-limit details without a thrown/redacted server-action error', async () => {
    mocks.limit.mockRejectedValueOnce(new RequestRateLimitError(429, 12));
    expect(await saveTryOnSettingsAction(new FormData())).toMatchObject({ ok: false, code: 'rate_limited', retryAfterSeconds: 12 });
    expect(mocks.limit).toHaveBeenCalledWith('shop:owned.myshopify.com');
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it('refuses unauthorized requests before limiter or storage', async () => {
    mocks.owned.mockRejectedValueOnce(new Error('Unknown Shopify shop'));
    expect(await saveTryOnSettingsAction(new FormData())).toMatchObject({ ok: false, code: 'forbidden' });
    expect(mocks.limit).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it('does not report success when settings persistence returned false', async () => {
    mocks.save.mockResolvedValueOnce(false);
    expect(await saveTryOnSettingsAction(new FormData())).toMatchObject({ ok: false, code: 'unavailable' });
    expect(mocks.revalidate).not.toHaveBeenCalled();
    expect(await saveTryOnSettingsAction(new FormData())).toEqual({ ok: true });
  });
});
