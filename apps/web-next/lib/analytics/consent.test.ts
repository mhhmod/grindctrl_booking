import { describe, expect, it, vi } from 'vitest';
import {
  enforceAnalyticsConsent,
  POSTHOG_FAIL_CLOSED_CONFIG,
  readAnalyticsConsent,
  setAnalyticsConsent,
} from '@/lib/analytics/consent';

function consentClient(overrides: Partial<{
  explicit: 'granted' | 'denied' | 'pending';
  optedIn: boolean;
  optedOut: boolean;
}> = {}) {
  return {
    get_explicit_consent_status: vi.fn(() => overrides.explicit ?? 'pending'),
    has_opted_in_capturing: vi.fn(() => overrides.optedIn ?? false),
    has_opted_out_capturing: vi.fn(() => overrides.optedOut ?? false),
    opt_in_capturing: vi.fn(),
    opt_out_capturing: vi.fn(),
  };
}

describe('analytics consent lifecycle', () => {
  it('keeps every automatic PostHog collection and storage path off by default', () => {
    expect(POSTHOG_FAIL_CLOSED_CONFIG).toEqual({
      opt_out_capturing_by_default: true,
      opt_out_persistence_by_default: true,
      advanced_disable_flags: true,
      disable_external_dependency_loading: true,
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      capture_exceptions: false,
      disable_session_recording: true,
    });
  });

  it.each([
    [{ explicit: 'granted' }, 'granted'],
    [{ explicit: 'denied' }, 'denied'],
    [{ explicit: 'pending', optedOut: true }, 'unknown'],
  ] as const)('derives %s as %s from the SDK decision', (decision, expected) => {
    expect(readAnalyticsConsent(consentClient(decision))).toBe(expected);
  });

  it('fails closed when reading consent throws', () => {
    const client = consentClient();
    client.get_explicit_consent_status.mockImplementation(() => { throw new Error('not initialized'); });
    expect(readAnalyticsConsent(client)).toBe('unknown');
  });

  it('keeps a pending decision unchosen while preserving the fail-closed default', () => {
    const unknownClient = consentClient();
    expect(enforceAnalyticsConsent(unknownClient)).toBe('unknown');
    expect(unknownClient.opt_out_capturing).not.toHaveBeenCalled();

    const grantedClient = consentClient({ explicit: 'granted' });
    expect(enforceAnalyticsConsent(grantedClient)).toBe('granted');
    expect(grantedClient.opt_out_capturing).not.toHaveBeenCalled();

    const deniedClient = consentClient({ explicit: 'denied' });
    expect(enforceAnalyticsConsent(deniedClient)).toBe('denied');
    expect(deniedClient.opt_out_capturing).toHaveBeenCalledOnce();
  });

  it('uses one explicit transition API for grant and denial', () => {
    const client = consentClient();
    setAnalyticsConsent(client, 'granted');
    expect(client.opt_in_capturing).toHaveBeenCalledOnce();
    expect(client.opt_out_capturing).not.toHaveBeenCalled();

    setAnalyticsConsent(client, 'denied');
    expect(client.opt_out_capturing).toHaveBeenCalledOnce();
  });
});
