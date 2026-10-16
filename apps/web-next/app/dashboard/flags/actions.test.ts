// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  operator: vi.fn(),
  rateLimit: vi.fn(),
  exists: vi.fn(),
  write: vi.fn(),
  flags: vi.fn(),
  invalidateProxy: vi.fn(),
  revalidate: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }));
vi.mock('@/lib/shopify/platform-operator', async () => {
  class PlatformOperatorRequiredError extends Error {}
  return { PlatformOperatorRequiredError, requireTryOnPlatformOperator: mocks.operator };
});
vi.mock('@/lib/request-rate-limit', () => ({
  requireMerchantRateLimit: mocks.rateLimit,
  merchantActionFailure: () => ({ ok: false, code: 'unavailable', message: 'Action temporarily unavailable.' }),
}));
vi.mock('@/lib/shopify/proxy-config-cache', () => ({ invalidateProxyConfig: mocks.invalidateProxy }));
vi.mock('@/lib/flags/store-flags', () => ({
  isStoreFlag: (value: unknown) => value === 'n23_after_hours' || value === 'n24_assistant_down',
  storeExists: mocks.exists,
  writeStoreFlag: mocks.write,
  storeFlags: mocks.flags,
}));

import { setStoreFlag } from './actions';
import { PlatformOperatorRequiredError } from '@/lib/shopify/platform-operator';

describe('setStoreFlag', () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.operator.mockResolvedValue('user_operator');
    mocks.rateLimit.mockResolvedValue(undefined);
    mocks.exists.mockResolvedValue(true);
    mocks.write.mockResolvedValue(undefined);
    mocks.flags.mockResolvedValue(['n23_after_hours']);
  });

  it('lets only the platform operator change a flag', async () => {
    mocks.operator.mockRejectedValue(new PlatformOperatorRequiredError());
    const result = await setStoreFlag({ kind: 'shop', key: 'maison.myshopify.com', flag: 'n23_after_hours', enabled: true });
    expect(result).toMatchObject({ ok: false, code: 'forbidden' });
    expect(mocks.write).not.toHaveBeenCalled();
  });

  it('writes the flag, clears the storefront config and answers the new flags', async () => {
    const result = await setStoreFlag({ kind: 'shop', key: 'maison.myshopify.com', flag: 'n23_after_hours', enabled: true });
    expect(result).toEqual({ ok: true, flags: ['n23_after_hours'] });
    expect(mocks.write).toHaveBeenCalledWith({ shopDomain: 'maison.myshopify.com' }, 'n23_after_hours', true, 'user_operator');
    expect(mocks.invalidateProxy).toHaveBeenCalledWith('maison.myshopify.com');
  });

  it('keys a Store Chat site by its id and leaves the App Proxy cache alone', async () => {
    const key = '11111111-1111-4111-8111-111111111111';
    await setStoreFlag({ kind: 'site', key, flag: 'n24_assistant_down', enabled: false });
    expect(mocks.write).toHaveBeenCalledWith({ widgetSiteId: key }, 'n24_assistant_down', false, 'user_operator');
    expect(mocks.invalidateProxy).not.toHaveBeenCalled();
  });

  it('refuses a flag the code does not know, or a store the app does not', async () => {
    expect(await setStoreFlag({ kind: 'shop', key: 'maison.myshopify.com', flag: 'n99_typo', enabled: true })).toMatchObject({
      ok: false,
      code: 'invalid',
    });
    mocks.exists.mockResolvedValue(false);
    expect(await setStoreFlag({ kind: 'shop', key: 'stranger.myshopify.com', flag: 'n23_after_hours', enabled: true })).toMatchObject({
      ok: false,
      code: 'invalid',
    });
    expect(mocks.write).not.toHaveBeenCalled();
  });
});
