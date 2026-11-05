// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({ reads: [] as string[], results: [] as Array<{ data: unknown; error: unknown }> }));

vi.mock('@/lib/messenger/db', () => ({
  getMessengerServiceClient: () => ({
    from: () => ({
      select: (columns: string) => {
        mocks.reads.push(columns);
        const builder = { eq: () => builder, maybeSingle: () => Promise.resolve(mocks.results.shift()) };
        return builder;
      },
    }),
  }),
}));

import { loadActiveWooConnection } from './active-connection';

const row = { platform: 'woocommerce', status: 'active', home_url: 'https://shop.example.com', secret_version: 1, plugin_version: '0.3.1' };

beforeEach(() => {
  mocks.reads.length = 0;
  mocks.results.length = 0;
});

describe('loadActiveWooConnection', () => {
  it('returns the stored REST root', async () => {
    mocks.results.push({ data: { ...row, rest_base_url: 'https://shop.example.com/?rest_route=/' }, error: null });
    expect(await loadActiveWooConnection('site')).toMatchObject({ restBaseUrl: 'https://shop.example.com/?rest_route=/' });
  });

  it('keeps working before the rest_base_url migration is applied', async () => {
    mocks.results.push({ data: null, error: { message: 'column does not exist' } }, { data: row, error: null });
    const connection = await loadActiveWooConnection('site');
    expect(connection).toMatchObject({ homeUrl: 'https://shop.example.com' });
    expect(connection?.restBaseUrl ?? null).toBeNull();
    expect(mocks.reads[1]).not.toContain('rest_base_url');
  });

  it('still fails when the connection itself cannot be read', async () => {
    mocks.results.push({ data: null, error: { message: 'down' } }, { data: null, error: { message: 'down' } });
    await expect(loadActiveWooConnection('site')).rejects.toThrow('unavailable');
  });
});
