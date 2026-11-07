// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TryOnJob } from './types';

const state = vi.hoisted(() => ({
  result: { error: null as null | { code: string; message: string } },
  payloads: [] as unknown[],
  filters: [] as unknown[],
}));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => {
      const query = {
        update: (value: unknown) => { state.payloads.push(value); return query; },
        eq: (...args: unknown[]) => { state.filters.push(args); return query; },
        is: (...args: unknown[]) => { state.filters.push(args); return query; },
        then: (resolve: (value: typeof state.result) => unknown) => Promise.resolve(resolve(state.result)),
      };
      return query;
    },
  }),
}));

import { createJobTimings, persistJobTimings } from './job-timings';

const job: TryOnJob = {
  jobId: 'tryon_timings', sessionId: 'ts_session', productId: 'product',
  shop: 'store.myshopify.com', status: 'completed', createdAt: '2026-11-06T00:00:00Z',
  meta: { runtime: 'live', provider: 'meta/muse-image', costEstimate: null },
};

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-only');
  state.result = { error: null };
  state.payloads = [];
  state.filters = [];
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe('server phase timings', () => {
  it.each(['store.myshopify.com', 'site:123e4567-e89b-42d3-a456-426614174000', null])(
    'writes only numeric diagnostics, scoped to the job and tenant %s', async (shop) => {
      const timings = createJobTimings('data:image/png;base64,AQID');
      timings.provider_attempts.push({ attempt: 1, duration_ms: 123, status: 200 });
      await persistJobTimings({ ...job, shop }, timings);
      expect(timings.input_bytes.photo).toBe(3);
      expect(state.payloads).toEqual([{ phase_timings: timings }]);
      expect(state.filters).toEqual([
        ['id', job.jobId], ['session_id', job.sessionId], ['product_id', job.productId], ['shop', shop],
      ]);
      expect(JSON.stringify(state.payloads)).not.toMatch(/base64|AQID|session|myshopify|image\/png/);
    },
  );

  it('skips a missing migration, logs once per process, and recovers on later jobs', async () => {
    const now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    state.result.error = { code: 'PGRST204', message: "Could not find the 'phase_timings' column in the schema cache" };
    await expect(persistJobTimings(job, createJobTimings())).resolves.toBeUndefined();
    expect(state.payloads).toHaveLength(1);
    clock.mockReturnValue(now + 60_001);
    state.result.error = { code: '42703', message: 'column phase_timings does not exist' };
    await expect(persistJobTimings(job, createJobTimings())).resolves.toBeUndefined();
    expect(warning).toHaveBeenCalledExactlyOnceWith('[try-on] phase_timings_column_unavailable');
    state.result.error = null;
    clock.mockReturnValue(now + 120_002);
    await persistJobTimings(job, createJobTimings());
    expect(state.payloads).toHaveLength(3);
    expect(warning).toHaveBeenCalledTimes(1);
  });

  it('never fails delivery or logs database detail when diagnostics fail', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    state.result.error = { code: '503', message: 'private database detail' };
    await expect(persistJobTimings(job, createJobTimings())).resolves.toBeUndefined();
    expect(JSON.stringify(warning.mock.calls)).not.toContain('private database detail');
  });
});
