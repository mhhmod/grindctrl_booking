// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TryOnJob } from './types';

const state = vi.hoisted(() => ({
  result: { error: null as null | { code: string; message: string } },
  payloads: [] as unknown[],
  filters: [] as unknown[],
  stored: null as Record<string, unknown> | null,
  reads: 0,
  conflict: false,
}));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => {
      let update: { phase_timings: Record<string, unknown> } | undefined;
      const query = {
        update: (value: { phase_timings: Record<string, unknown> }) => { update = value; state.payloads.push(value); return query; },
        select: () => query,
        maybeSingle: async () => { state.reads++; return { ...state.result, data: { phase_timings: state.stored } }; },
        eq: (...args: unknown[]) => { state.filters.push(args); return query; },
        is: (...args: unknown[]) => { state.filters.push(args); return query; },
        then: (resolve: (value: typeof state.result & { data: unknown[] }) => unknown) => {
          if (state.conflict) { state.conflict = false; state.stored = { client: { upload_ms: 300 } }; return Promise.resolve(resolve({ ...state.result, data: [] })); }
          if (update) state.stored = update.phase_timings;
          return Promise.resolve(resolve({ ...state.result, data: [{ id: 'job' }] }));
        },
      };
      return query;
    },
  }),
}));

import { createJobTimings, persistJobTimings, validClientTimings } from './job-timings';

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
  state.stored = null; state.reads = 0; state.conflict = false;
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
        ['id', job.jobId], ['session_id', job.sessionId], ['product_id', job.productId], ['shop', shop],
        ['phase_timings', null],
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
    expect(state.reads).toBe(1);
    clock.mockReturnValue(now + 60_001);
    state.result.error = { code: '42703', message: 'column phase_timings does not exist' };
    await expect(persistJobTimings(job, createJobTimings())).resolves.toBeUndefined();
    expect(warning).toHaveBeenCalledExactlyOnceWith('[try-on] phase_timings_column_unavailable');
    state.result.error = null;
    clock.mockReturnValue(now + 120_002);
    await persistJobTimings(job, createJobTimings());
    expect(state.reads).toBe(3);
    expect(warning).toHaveBeenCalledTimes(1);
  });

  it('never fails delivery or logs database detail when diagnostics fail', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    state.result.error = { code: '503', message: 'private database detail' };
    await expect(persistJobTimings(job, createJobTimings())).resolves.toBeUndefined();
    expect(JSON.stringify(warning.mock.calls)).not.toContain('private database detail');
  });
  it('keeps only bounded numeric durations and a real boolean, never arbitrary client data', async () => {
    const client = { attempt_ms: 10, check_ms: 999999, upload_ms: 12, check_prewarmed: true, photo: 'private' };
    await persistJobTimings(job, createJobTimings(undefined, client));
    expect(state.stored?.client).toEqual({ attempt_ms: 10, check_ms: 600000, upload_ms: 12, check_prewarmed: true });
    expect(validClientTimings({ attempt_ms: -1, check_ms: Infinity, upload_ms: '2', check_prewarmed: 'true' })).toBeUndefined();
    expect(validClientTimings({ attempt_ms: NaN, check_ms: null, upload_ms: {}, check_prewarmed: 0 })).toBeUndefined();
    expect(validClientTimings([])).toBeUndefined();
  });
  it('preserves the acknowledgment report when a provider timing write races with it', async () => {
    state.conflict = true;
    await persistJobTimings(job, createJobTimings(undefined, { attempt_ms: 20, check_prewarmed: true }));
    expect(state.stored?.client).toEqual({ upload_ms: 300, attempt_ms: 20, check_prewarmed: true });
    expect(state.reads).toBe(2);
  });
});
