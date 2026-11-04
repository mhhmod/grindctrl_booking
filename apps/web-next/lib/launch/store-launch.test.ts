// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ filters: [] as Array<[string, unknown]>, upserts: [] as unknown[] }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/shopify/proxy-config-cache', () => ({ invalidateProxyConfig: vi.fn() }));
vi.mock('@/lib/messenger/db', () => ({
  getMessengerServiceClient: () => ({
    from: () => {
      const row = { state: 'preview', holdout_share: null, holdout_started_at: null, holdout_ends_at: null, salt: 'salt' };
      const builder: Record<string, unknown> = {};
      builder.select = () => builder;
      builder.eq = (column: string, value: unknown) => { mocks.filters.push([column, value]); return builder; };
      builder.maybeSingle = async () => ({ data: row, error: null });
      builder.single = async () => ({ data: row, error: null });
      builder.upsert = (value: unknown) => { mocks.upserts.push(value); return builder; };
      return builder;
    },
  }),
}));

import { clearStoreLaunchCache, getStoreLaunch, writeStoreLaunch } from './store-launch';

const KEY = 'site:11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  clearStoreLaunchCache();
  mocks.filters = [];
  mocks.upserts = [];
});

describe('the launch state per tenant', () => {
  it('reads and writes a WooCommerce store under its site tenant key', async () => {
    expect(await getStoreLaunch(KEY.toUpperCase())).toMatchObject({ state: 'preview' });
    expect(mocks.filters).toContainEqual(['shop_domain', KEY]);
    await writeStoreLaunch(KEY, { state: 'live' }, 'user_1');
    expect(mocks.upserts[0]).toMatchObject({ shop_domain: KEY, state: 'live' });
  });

  it('still keys a Shopify shop by its domain, and refuses anything that is neither', async () => {
    await getStoreLaunch('Maison.myshopify.com');
    expect(mocks.filters).toContainEqual(['shop_domain', 'maison.myshopify.com']);
    expect(await getStoreLaunch('example.com')).toBeNull();
    await expect(writeStoreLaunch('site:nope', { state: 'live' }, 'user_1')).rejects.toThrow('Unknown store');
  });
});
