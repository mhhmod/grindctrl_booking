import { describe, expect, it } from 'vitest';
import {
  retryAfterDelayMs,
  TRYON_POLL_RATE_LIMIT_REQUESTS,
  TRYON_POLL_RATE_LIMIT_WINDOW_MS,
  TRYON_POLL_TIMEOUT_MS,
  TRYON_POLL_INITIAL_DELAY_MS,
  TRYON_ASYNC_POLL_TIMEOUT_MS,
  tryOnPollDelayMs,
} from './poll-policy';

describe('try-on polling policy', () => {
  it('stays within the per-window budget throughout the full async window', () => {
    let now = TRYON_POLL_INITIAL_DELAY_MS;
    const requests: number[] = [];
    while (now < TRYON_ASYNC_POLL_TIMEOUT_MS) {
      requests.push(now);
      expect(requests.filter(at => at > now - TRYON_POLL_RATE_LIMIT_WINDOW_MS).length).toBeLessThan(40);
      now += tryOnPollDelayMs(requests.length);
    }
    expect(requests.length).toBeLessThanOrEqual(70);
    // Around twenty seconds, a completion is discovered within 1.5s.
    expect(requests.filter(at => at >= 18_000 && at <= 22_000)).toEqual([18_000, 19_500, 21_000]);
  });
  it('keeps a normal two-minute flow below the real configured poll budget', () => {
    let now = 0;
    let requests = 0;
    const withinWindow: number[] = [];

    while (now < TRYON_POLL_TIMEOUT_MS) {
      while (withinWindow.length && withinWindow[0] <= now - TRYON_POLL_RATE_LIMIT_WINDOW_MS) {
        withinWindow.shift();
      }
      expect(withinWindow.length).toBeLessThan(TRYON_POLL_RATE_LIMIT_REQUESTS);
      withinWindow.push(now);
      requests += 1;
      now += tryOnPollDelayMs(requests);
    }

    expect(requests).toBeLessThan(TRYON_POLL_RATE_LIMIT_REQUESTS);
  });

  it('parses both delta-seconds and HTTP-date Retry-After values safely', () => {
    const now = Date.parse('2026-09-01T00:00:00.000Z');
    expect(retryAfterDelayMs('3', now)).toBe(3_000);
    expect(retryAfterDelayMs('Tue, 01 Sep 2026 00:00:05 GMT', now)).toBe(5_000);
    expect(retryAfterDelayMs('-1', now)).toBeNull();
    expect(retryAfterDelayMs('not-a-date', now)).toBeNull();
  });
});
