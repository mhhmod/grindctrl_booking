import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getJob, storeJob } from './service';
import type { TryOnJob } from './types';

function makeJob(jobId: string, createdAt: string): TryOnJob {
  return {
    jobId,
    sessionId: 'sess_test',
    productId: 'short-tshirt',
    shop: null,
    status: 'completed',
    resultImageUrl: 'data:image/png;base64,aGVsbG8=',
    createdAt,
    meta: { runtime: 'mock', provider: 'mock', costEstimate: 0 },
  };
}

describe('job store lifecycle bounds', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('serves a freshly stored job to pollers', () => {
    const now = Date.now();
    vi.setSystemTime(now);
    storeJob(makeJob('tryon_a', new Date(now).toISOString()), now);
    expect(getJob('tryon_a')?.jobId).toBe('tryon_a');
  });

  it('evicts entries older than the TTL on the next insert', () => {
    const start = Date.now();
    vi.setSystemTime(start);
    storeJob(makeJob('tryon_old', new Date(start).toISOString()), start);

    // Advance past the 30-minute TTL and insert another job.
    vi.setSystemTime(start + 31 * 60 * 1000);
    storeJob(makeJob('tryon_new', new Date(start + 31 * 60 * 1000).toISOString()));

    expect(getJob('tryon_old')).toBeUndefined();
    expect(getJob('tryon_new')?.jobId).toBe('tryon_new');
  });

  it('drops malformed timestamps during pruning instead of keeping them forever', () => {
    const now = Date.now();
    vi.setSystemTime(now);
    storeJob(makeJob('tryon_broken', 'not-a-date'), now);
    storeJob(makeJob('tryon_ok', new Date(now).toISOString()), now);
    expect(getJob('tryon_broken')).toBeUndefined();
    expect(getJob('tryon_ok')).toBeDefined();
  });

  it('caps the store by evicting oldest entries first', () => {
    const start = Date.now();
    vi.setSystemTime(start);

    // Fill beyond the cap (internal max is 1000; inserting 1002 forces eviction).
    for (let i = 0; i < 1002; i += 1) {
      const at = start + i;
      vi.setSystemTime(at);
      storeJob(makeJob(`tryon_cap_${i}`, new Date(at).toISOString()), at);
    }

    expect(getJob('tryon_cap_0')).toBeUndefined();
    expect(getJob('tryon_cap_1')).toBeUndefined();
    expect(getJob('tryon_cap_1001'))?.toBeDefined();
  });
});
