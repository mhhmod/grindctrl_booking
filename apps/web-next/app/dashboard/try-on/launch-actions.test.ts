// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  owned: vi.fn(),
  limit: vi.fn(),
  flags: vi.fn(),
  write: vi.fn(),
  revalidate: vi.fn(),
  operator: vi.fn(),
}));
vi.mock('@/lib/shopify/shops', () => ({ requireManagedTryOnShop: mocks.owned }));
vi.mock('@/lib/flags/store-flags', () => ({ storeFlags: mocks.flags }));
vi.mock('@/lib/launch/store-launch', () => ({ writeStoreLaunch: mocks.write }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }));
vi.mock('@clerk/nextjs/server', () => ({ auth: async () => ({ userId: 'user_owner' }) }));
vi.mock('@/lib/request-rate-limit', async (original) => ({
  ...(await original<typeof import('@/lib/request-rate-limit')>()),
  requireMerchantRateLimit: mocks.limit,
}));
vi.mock('@/lib/shopify/platform-operator', async (original) => ({
  ...(await original<typeof import('@/lib/shopify/platform-operator')>()),
  requireTryOnPlatformOperator: mocks.operator,
}));

import { createPreviewLink, setLaunchState, setLaunchStateAsOperator } from './launch-actions';
import { verifyPreviewToken } from '@/lib/launch/preview-token';
import { PlatformOperatorRequiredError } from '@/lib/shopify/platform-operator';

const SHOP = 'maison.myshopify.com';

beforeEach(() => {
  vi.resetAllMocks();
  process.env.SHOPIFY_API_KEY = 'client';
  process.env.SHOPIFY_API_SECRET = 'secret';
  mocks.owned.mockResolvedValue(SHOP);
  mocks.flags.mockResolvedValue(['n5_preview_mode', 'n6_holdout']);
  mocks.write.mockImplementation(async (_shop: string, input: { state: string }) => ({ state: input.state }));
});

describe('setLaunchState (N5, N6)', () => {
  it('lets the owner go live, or start the 50/50 test', async () => {
    expect(await setLaunchState({ shop: SHOP, state: 'live' })).toEqual({ ok: true, state: 'live' });
    expect(mocks.write).toHaveBeenCalledWith(SHOP, { state: 'live' }, 'user_owner');
    expect(await setLaunchState({ shop: SHOP, state: 'holdout' })).toEqual({ ok: true, state: 'holdout' });
    expect(mocks.revalidate).toHaveBeenCalledWith('/dashboard/try-on');
  });

  it('refuses someone else\'s shop before anything is read or written', async () => {
    mocks.owned.mockRejectedValue(new Error('Unknown Shopify shop'));
    expect(await setLaunchState({ shop: SHOP, state: 'live' })).toMatchObject({ ok: false, code: 'forbidden' });
    expect(mocks.flags).not.toHaveBeenCalled();
    expect(mocks.write).not.toHaveBeenCalled();
  });

  it('needs n5_preview_mode, and n6_holdout for the 50/50 test', async () => {
    mocks.flags.mockResolvedValue(['n5_preview_mode']);
    expect(await setLaunchState({ shop: SHOP, state: 'holdout' })).toMatchObject({ ok: false, code: 'not_enabled' });
    mocks.flags.mockResolvedValue([]);
    expect(await setLaunchState({ shop: SHOP, state: 'live' })).toMatchObject({ ok: false, code: 'not_enabled' });
    expect(mocks.write).not.toHaveBeenCalled();
  });

  it('refuses a state the owner may not pick', async () => {
    expect(await setLaunchState({ shop: SHOP, state: 'setup' as never })).toMatchObject({ ok: false, code: 'invalid' });
  });
});

describe('createPreviewLink (N5)', () => {
  it('gives the owner a 24-hour link to their own store', async () => {
    const result = await createPreviewLink({ shop: SHOP });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const url = new URL(result.url);
    expect(url.origin).toBe(`https://${SHOP}`);
    expect(verifyPreviewToken('secret', url.searchParams.get('gc_preview'), SHOP)).toBe(true);
    expect(Date.parse(result.expiresAt) - Date.now()).toBeGreaterThan(23 * 3_600_000);
  });

  it('gives none while the flag is off, or for someone else\'s shop', async () => {
    mocks.flags.mockResolvedValue([]);
    expect(await createPreviewLink({ shop: SHOP })).toMatchObject({ ok: false, code: 'not_enabled' });
    mocks.owned.mockRejectedValue(new Error('Unauthorized'));
    expect(await createPreviewLink({ shop: SHOP })).toMatchObject({ ok: false, code: 'forbidden' });
  });
});

describe('setLaunchStateAsOperator', () => {
  it('lets only the platform operator set any state', async () => {
    mocks.operator.mockResolvedValue('user_operator');
    expect(await setLaunchStateAsOperator({ shop: SHOP, state: 'preview' })).toEqual({ ok: true, state: 'preview' });
    expect(mocks.write).toHaveBeenCalledWith(SHOP, { state: 'preview' }, 'user_operator');

    mocks.operator.mockRejectedValue(new PlatformOperatorRequiredError());
    expect(await setLaunchStateAsOperator({ shop: SHOP, state: 'live' })).toMatchObject({ ok: false, code: 'forbidden' });
  });
});
