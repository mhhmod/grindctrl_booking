import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const sdk = vi.hoisted(() => ({ capture: vi.fn(), get_explicit_consent_status: vi.fn() }));
vi.mock('posthog-js', () => ({ default: sdk }));
import { markTryOnOpen, recordTryOnOpen, recordTryOnPhase } from './performance';

beforeEach(() => {
  sdk.capture.mockReset();
  sdk.get_explicit_consent_status.mockReturnValue('granted');
  vi.useFakeTimers();
  vi.setSystemTime(2_000_000_000_000);
  window.history.replaceState({}, '', '/try-on');
});
afterEach(() => { vi.useRealTimers(); });

describe('try-on performance consent and privacy', () => {
  it.each(['pending', 'denied'])('drops measurements with consent %s without replaying later', (consent) => {
    sdk.get_explicit_consent_status.mockReturnValue(consent);
    recordTryOnPhase('photo_prepare', 32);
    expect(sdk.capture).not.toHaveBeenCalled();
    sdk.get_explicit_consent_status.mockReturnValue('granted');
    recordTryOnPhase('upload', 800);
    expect(sdk.capture).toHaveBeenCalledOnce();
  });
  it.each(['tap_to_open', 'photo_prepare', 'upload', 'wait_to_result'] as const)('records only phase and rounded duration for %s', (phase) => {
    recordTryOnPhase(phase, 42.4);
    expect(sdk.capture).toHaveBeenCalledWith('tryon.phase_completed', {
      phase, durationMs: 42, taxonomy_version: 1, occurred_at: new Date().toISOString(),
      consent_state: 'granted', source: 'tryon_widget', channel: 'web',
    });
  });
  it('consumes and removes the storefront tap timestamp exactly once', () => {
    window.history.replaceState({}, '', '/embed/try-on?product=tee&gc_opened_at=1999999999200');
    recordTryOnOpen(); recordTryOnOpen();
    expect(sdk.capture).toHaveBeenCalledOnce();
    expect(sdk.capture.mock.calls[0][1]).toMatchObject({ phase: 'tap_to_open', durationMs: 800 });
    expect(window.location.search).toBe('?product=tee');
  });
  it('supports same-app navigation without inventing a tap for direct visits', () => {
    recordTryOnOpen();
    expect(sdk.capture).not.toHaveBeenCalled();
    markTryOnOpen(); vi.advanceTimersByTime(500); recordTryOnOpen();
    expect(sdk.capture.mock.calls[0][1]).toMatchObject({ phase: 'tap_to_open', durationMs: 500 });
  });
  it.each([NaN, Infinity, -1])('ignores invalid durations %s', (duration) => {
    recordTryOnPhase('upload', duration);
    expect(sdk.capture).not.toHaveBeenCalled();
  });
});
