// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ token: vi.fn(), graphql: vi.fn() }));
vi.mock('./tokens', () => ({ getShopToken: mocks.token }));
vi.mock('./admin', () => ({ adminGraphql: mocks.graphql }));

import { clearShopTimezoneCache, getShopTimezone } from './shop-timezone';

const NOW = Date.parse('2026-10-16T12:00:00Z');

describe('getShopTimezone (phase zero item 7)', () => {
  beforeEach(() => {
    clearShopTimezoneCache();
    mocks.token.mockReset().mockResolvedValue({ accessToken: 'shpat_test', scopes: '' });
    mocks.graphql.mockReset().mockResolvedValue({ shop: { ianaTimezone: 'Africa/Cairo' } });
  });

  it('reads the store\'s own zone once an hour', async () => {
    expect(await getShopTimezone('maison.myshopify.com', NOW)).toBe('Africa/Cairo');
    expect(await getShopTimezone('maison.myshopify.com', NOW + 30 * 60_000)).toBe('Africa/Cairo');
    expect(mocks.graphql).toHaveBeenCalledTimes(1);
    expect(mocks.graphql.mock.calls[0][0]).toMatchObject({ shopDomain: 'maison.myshopify.com', query: expect.stringContaining('ianaTimezone') });
  });

  it('answers nothing, without throwing, for no token, a failed call or an unknown zone', async () => {
    mocks.token.mockResolvedValueOnce(null);
    expect(await getShopTimezone('a.myshopify.com', NOW)).toBeNull();
    mocks.graphql.mockRejectedValueOnce(new Error('401'));
    expect(await getShopTimezone('b.myshopify.com', NOW)).toBeNull();
    mocks.graphql.mockResolvedValueOnce({ shop: { ianaTimezone: 'Mars/Olympus' } });
    expect(await getShopTimezone('c.myshopify.com', NOW)).toBeNull();
  });
});
