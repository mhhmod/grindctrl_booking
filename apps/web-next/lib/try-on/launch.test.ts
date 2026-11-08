import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ entitlement: vi.fn(), showButton: vi.fn() }));
vi.mock('./entitlement', () => ({ getShopEntitlement: mocks.entitlement }));
vi.mock('./settings', () => ({ readTryOnShowButton: mocks.showButton }));

import { getTryOnLaunch, tryOnLaunchFromEntitlement } from './launch';

describe('getTryOnLaunch, the one launch answer every storefront reads', () => {
  const live = { available: true, status: 'active', totalCreditsRemaining: 3 };
  beforeEach(() => {
    mocks.entitlement.mockReset().mockResolvedValue(live);
    mocks.showButton.mockReset().mockResolvedValue(true);
  });

  it.each(['demo.myshopify.com', 'site:123e4567-e89b-42d3-a456-426614174000'])('is paused for %s while its button is off', async (tenant) => {
    mocks.showButton.mockResolvedValue(false);
    expect(await getTryOnLaunch(tenant)).toEqual({ tryOn: 'hidden', reason: 'paused' });
    expect(mocks.showButton).toHaveBeenCalledWith(tenant);
  });

  it('is paused before any plan state, and even when the plan cannot be read', async () => {
    mocks.showButton.mockResolvedValue(false);
    mocks.entitlement.mockResolvedValue({ available: false, status: 'expired', totalCreditsRemaining: 0 });
    expect(await getTryOnLaunch('demo.myshopify.com')).toMatchObject({ reason: 'paused' });
    mocks.entitlement.mockRejectedValue(new Error('db down'));
    expect(await getTryOnLaunch('demo.myshopify.com')).toMatchObject({ reason: 'paused' });
  });

  it('follows the plan once switched on', async () => {
    expect(await getTryOnLaunch('demo.myshopify.com')).toEqual({ tryOn: 'live', reason: null });
    mocks.entitlement.mockResolvedValue({ available: false, status: 'active', totalCreditsRemaining: 0 });
    expect(await getTryOnLaunch('demo.myshopify.com')).toEqual({ tryOn: 'hidden', reason: 'out_of_looks' });
  });

  it('is unavailable, never live, when the switch cannot be read', async () => {
    mocks.showButton.mockRejectedValue(new Error('db down'));
    expect(await getTryOnLaunch('demo.myshopify.com')).toEqual({ tryOn: 'hidden', reason: 'unavailable' });
  });

  it('reads nothing without a shop', async () => {
    expect(await getTryOnLaunch(null)).toEqual({ tryOn: 'hidden', reason: 'not_installed' });
    expect(mocks.showButton).not.toHaveBeenCalled();
  });
});

describe('tryOnLaunchFromEntitlement', () => {
  it('is live when the entitlement is available', () => {
    expect(
      tryOnLaunchFromEntitlement({ available: true, status: 'active', totalCreditsRemaining: 3 }),
    ).toEqual({ tryOn: 'live', reason: null });
  });

  it('names a lapsed plan before an empty balance', () => {
    for (const status of ['expired', 'cancelled', 'none'] as const) {
      expect(
        tryOnLaunchFromEntitlement({ available: false, status, totalCreditsRemaining: 0 }),
      ).toEqual({ tryOn: 'hidden', reason: 'plan_inactive' });
    }
  });

  it('is out_of_looks on an active or grace plan with nothing left', () => {
    for (const status of ['active', 'grace'] as const) {
      expect(
        tryOnLaunchFromEntitlement({ available: false, status, totalCreditsRemaining: 0 }),
      ).toEqual({ tryOn: 'hidden', reason: 'out_of_looks' });
    }
  });

  it('is not_installed when the plan and looks would allow it', () => {
    expect(
      tryOnLaunchFromEntitlement({ available: false, status: 'active', totalCreditsRemaining: 40 }),
    ).toEqual({ tryOn: 'hidden', reason: 'not_installed' });
  });
});
