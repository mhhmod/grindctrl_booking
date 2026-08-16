import { describe, expect, it } from 'vitest';
import { InMemoryStore } from './rate-limiter-store';
import { checkBudget } from './rate-limit-gate';
import { RateLimitedError } from './errors';

describe('checkBudget', () => {
  it('returns null when the tenant is within budget', () => {
    const store = new InMemoryStore();

    const result = checkBudget(store, 'tenant-a', 'anon', 'chat:tokens', 10, 0);

    expect(result).toBeNull();
  });

  it('returns a RateLimitedError with a sign-in CTA for an exhausted anon tenant', () => {
    const store = new InMemoryStore();
    checkBudget(store, 'tenant-a', 'anon', 'stt:requests', 3, 0); // exhaust the budget

    const result = checkBudget(store, 'tenant-a', 'anon', 'stt:requests', 1, 0);

    expect(result).toBeInstanceOf(RateLimitedError);
    expect(result?.signInCta).toBe(true);
    expect(result?.resetSeconds).toBeGreaterThan(0);
  });

  it('returns a RateLimitedError with no sign-in CTA for an exhausted authenticated tenant', () => {
    const store = new InMemoryStore();
    checkBudget(store, 'user_abc', 'auth', 'stt:requests', 15, 0); // exhaust the auth budget

    const result = checkBudget(store, 'user_abc', 'auth', 'stt:requests', 1, 0);

    expect(result).toBeInstanceOf(RateLimitedError);
    expect(result?.signInCta).toBe(false);
  });
});
