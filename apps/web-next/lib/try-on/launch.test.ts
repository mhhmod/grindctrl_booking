import { describe, expect, it } from 'vitest';
import { tryOnLaunchFromEntitlement } from './launch';

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
