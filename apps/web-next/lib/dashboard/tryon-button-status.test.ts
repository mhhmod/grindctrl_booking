import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { tryOnButtonStatus } from './tryon-button-status';

const live = { available: true, status: 'active' as const, totalCreditsRemaining: 20 };
const base = { installed: true, showButton: true, entitlement: live, launchState: 'live' as const };

describe('tryOnButtonStatus, the Try-On page header', () => {
  it('is on when installed, switched on, live and with looks', () => {
    expect(tryOnButtonStatus(base)).toEqual({ showButton: true, tryOnState: 'on', reason: null, codeOutdated: false });
    expect(tryOnButtonStatus({ ...base, launchState: 'holdout' })).toMatchObject({ tryOnState: 'on' });
  });

  it('is off with reason paused whenever the merchant switched it off', () => {
    expect(tryOnButtonStatus({ ...base, showButton: false })).toEqual({ showButton: false, tryOnState: 'off', reason: 'paused', codeOutdated: false });
    expect(tryOnButtonStatus({ ...base, showButton: false, launchState: 'preview', entitlement: null }))
      .toMatchObject({ tryOnState: 'off', reason: 'paused' });
  });

  it('says not installed first, keeping the saved switch', () => {
    expect(tryOnButtonStatus({ ...base, installed: false, showButton: false }))
      .toEqual({ showButton: false, tryOnState: 'not_installed', reason: 'not_installed', codeOutdated: false });
    expect(tryOnButtonStatus({ ...base, entitlement: { available: false, status: 'active', totalCreditsRemaining: 20 } }))
      .toMatchObject({ tryOnState: 'not_installed' });
  });

  it.each([
    ['preview', { launchState: 'preview' as const }],
    ['preview', { launchState: 'setup' as const }],
    ['out_of_looks', { entitlement: { available: false, status: 'active' as const, totalCreditsRemaining: 0 } }],
    ['plan_inactive', { entitlement: { available: false, status: 'expired' as const, totalCreditsRemaining: 5 } }],
    ['unavailable', { entitlement: null }],
  ])('is not ready with reason %s', (reason, over) => {
    expect(tryOnButtonStatus({ ...base, ...over })).toEqual({ showButton: true, tryOnState: 'not_ready', reason, codeOutdated: false });
  });

  it('carries whether pasted code is outdated through every state, false when not given', () => {
    expect(tryOnButtonStatus({ ...base, codeOutdated: true })).toEqual({ showButton: true, tryOnState: 'on', reason: null, codeOutdated: true });
    expect(tryOnButtonStatus({ ...base, installed: false, codeOutdated: true })).toMatchObject({ tryOnState: 'not_installed', codeOutdated: true });
    expect(tryOnButtonStatus({ ...base, showButton: false, codeOutdated: true })).toMatchObject({ tryOnState: 'off', codeOutdated: true });
    expect(tryOnButtonStatus({ ...base, entitlement: null, codeOutdated: true })).toMatchObject({ tryOnState: 'not_ready', codeOutdated: true });
  });
});
