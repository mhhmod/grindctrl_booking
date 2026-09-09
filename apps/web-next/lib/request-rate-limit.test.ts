// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ read: vi.fn(), write: vi.fn() }));
vi.mock('@/lib/ratelimit', () => ({
  merchantReadRatelimit: { configured: true, limit: mocks.read },
  merchantWriteRatelimit: { configured: true, limit: mocks.write },
}));
import { requireRateLimit, requireMerchantRateLimit, merchantRateLimitResponse, RequestRateLimitError, rateLimitErrorResponse } from './request-rate-limit';

afterEach(() => { vi.restoreAllMocks(); });

describe('request enforcement', () => {
  it('fails closed without configuration, on transport error, and on SDK timeout-success', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const limit = vi.fn();
    await expect(requireRateLimit({ configured: false, limit }, 'id')).rejects.toMatchObject({ status: 503 });
    expect(limit).not.toHaveBeenCalled();
    await expect(requireRateLimit(null, 'id')).rejects.toMatchObject({ status: 503 });
    limit.mockRejectedValueOnce(new Error('secret provider URL'));
    await expect(requireRateLimit({ limit }, 'id')).rejects.toMatchObject({ status: 503 });
    limit.mockResolvedValueOnce({ success: true, reason: 'timeout', reset: Date.now() + 5000 });
    await expect(requireRateLimit({ limit }, 'id')).rejects.toMatchObject({ status: 503 });
    expect(limit).toHaveBeenCalledTimes(2); // never retries a spent check
    expect(console.error).not.toHaveBeenCalledWith(expect.stringContaining('secret'));
  });

  it('uses finite positive Retry-After on 429 and a safe 503 response', async () => {
    const error = new RequestRateLimitError(429, 12);
    const response = rateLimitErrorResponse(error);
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('12');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toMatchObject({ error: 'rate_limited', retryAfterSeconds: 12 });
    expect(rateLimitErrorResponse(new RequestRateLimitError(503, 30)).headers.get('Retry-After')).toBe('30');
    await expect(requireRateLimit({ limit: vi.fn(async () => ({ success: false, reset: 0 })) }, 'id'))
      .rejects.toMatchObject({ status: 429, retryAfterSeconds: 1 });
  });

  it.each([null, {}, { success: 'yes', reset: Date.now() }, { success: true, reset: Number.NaN }])(
    'rejects malformed limiter results as unavailable rather than authorizing work', async (result) => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      await expect(requireRateLimit({ limit: vi.fn().mockResolvedValue(result) }, 'id'))
        .rejects.toMatchObject({ status: 503 });
    },
  );

  it('keeps verified identities and read/write budgets isolated', async () => {
    mocks.read.mockResolvedValue({ success: true, reset: Date.now() + 60000 });
    mocks.write.mockResolvedValue({ success: true, reset: Date.now() + 60000 });
    await requireMerchantRateLimit('shop:a.myshopify.com');
    await requireMerchantRateLimit('shop:b.myshopify.com');
    await requireMerchantRateLimit('account:user_1', 'read');
    expect(mocks.write.mock.calls).toEqual([['shop:a.myshopify.com'], ['shop:b.myshopify.com']]);
    expect(mocks.read).toHaveBeenCalledWith('account:user_1');
    mocks.write.mockResolvedValue({ success: false, reset: Date.now() + 60000 });
    expect((await merchantRateLimitResponse('shop:a.myshopify.com'))?.status).toBe(429);
  });
});
