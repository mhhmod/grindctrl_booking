// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getShopifySessionToken } from './app-bridge-client';

afterEach(() => {
  delete (window as unknown as { shopify?: unknown }).shopify;
  vi.useRealTimers();
});

describe('getShopifySessionToken', () => {
  it('returns the token once window.shopify is present', async () => {
    (window as unknown as { shopify: { idToken: () => Promise<string> } }).shopify = {
      idToken: () => Promise.resolve('tok-123'),
    };
    await expect(getShopifySessionToken()).resolves.toBe('tok-123');
  });

  it('throws if App Bridge never becomes ready', async () => {
    vi.useFakeTimers();
    // Attach the rejection expectation before advancing timers — otherwise
    // the promise rejects before anything is listening, and vitest reports
    // an unhandled rejection instead of a passing assertion.
    const pending = expect(getShopifySessionToken()).rejects.toThrow('App Bridge not ready');
    await vi.advanceTimersByTimeAsync(6000);
    await pending;
  });
});
