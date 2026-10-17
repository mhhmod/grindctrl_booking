import { describe, expect, it, vi } from 'vitest';
import { withoutTestLooks } from './test-looks';

describe('leaving test looks out of the numbers (N5)', () => {
  it('filters them out when the column exists', async () => {
    const run = vi.fn(async (exclude: boolean) => ({ data: exclude ? ['real'] : ['real', 'test'], error: null }));
    expect((await withoutTestLooks(run)).data).toEqual(['real']);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('reads without the filter until store_launch.sql is applied', async () => {
    const run = vi.fn(async (exclude: boolean) =>
      exclude
        ? { data: null, error: { code: '42703', message: 'column tryon_jobs.is_test does not exist' } }
        : { data: ['real'], error: null },
    );
    expect((await withoutTestLooks(run)).data).toEqual(['real']);
    expect(run).toHaveBeenCalledWith(false);
  });

  it('passes any other error through', async () => {
    const run = vi.fn(async () => ({ data: null, error: { code: '57014', message: 'timeout' } }));
    expect((await withoutTestLooks(run)).error).toEqual({ code: '57014', message: 'timeout' });
    expect(run).toHaveBeenCalledTimes(1);
  });
});
