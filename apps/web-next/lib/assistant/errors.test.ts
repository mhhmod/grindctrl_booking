import { describe, expect, it } from 'vitest';
import { BadInputError, ProviderUnavailableError, RateLimitedError } from './errors';

describe('RateLimitedError', () => {
  it('carries the reset countdown and whether to show the sign-in CTA', () => {
    const err = new RateLimitedError(42, true);

    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('RateLimitedError');
    expect(err.resetSeconds).toBe(42);
    expect(err.signInCta).toBe(true);
  });
});

describe('ProviderUnavailableError', () => {
  it('is a distinct, identifiable error type', () => {
    const err = new ProviderUnavailableError();

    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ProviderUnavailableError');
  });
});

describe('BadInputError', () => {
  it('carries a specific, actionable reason', () => {
    const err = new BadInputError('Microphone permission was denied.');

    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('BadInputError');
    expect(err.reason).toBe('Microphone permission was denied.');
  });
});
