// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  eq: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock('@/lib/messenger/db', () => ({
  getMessengerServiceClient: () => ({
    from: vi.fn((table: string) => {
      expect(table).toBe('woo_site_connections');
      const builder = {
        select: vi.fn(() => builder),
        eq: mocks.eq.mockImplementation(() => builder),
        maybeSingle: mocks.maybeSingle,
      };
      return builder;
    }),
  }),
}));

import { getWooSiteConnection, isVersionBelow } from './connection';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
});

describe('getWooSiteConnection', () => {
  it('maps a service-role connection row for the selected site', async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: {
        platform: 'woocommerce',
        status: 'active',
        plugin_version: '0.4.0',
        last_seen_at: '2026-11-04T10:30:00.000Z',
        paired_at: '2026-11-04T10:00:00.000Z',
        home_url: 'https://shop.example.com',
        last_home_url: 'https://staging.example.com',
      },
      error: null,
    });

    await expect(getWooSiteConnection('site-1')).resolves.toEqual({
      platform: 'woocommerce',
      status: 'active',
      pluginVersion: '0.4.0',
      lastSeenAt: '2026-11-04T10:30:00.000Z',
      pairedAt: '2026-11-04T10:00:00.000Z',
      homeUrl: 'https://shop.example.com',
      cloneSuspected: true,
      pluginOutdated: false,
    });
    expect(mocks.eq).toHaveBeenCalledWith('widget_site_id', 'site-1');
  });

  it('returns null when the site has never paired', async () => {
    await expect(getWooSiteConnection('site-1')).resolves.toBeNull();
  });

  it('does not leak a database error', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: { message: 'relation missing' } });
    await expect(getWooSiteConnection('site-1')).rejects.toThrow(
      'WooCommerce connection status is unavailable.',
    );
  });
});

describe('isVersionBelow', () => {
  it('compares numeric parts, not strings', () => {
    expect(isVersionBelow('0.1.9', '0.2.0')).toBe(true);
    expect(isVersionBelow('0.10.0', '0.2.0')).toBe(false);
    expect(isVersionBelow('0.2.0', '0.2.0')).toBe(false);
    expect(isVersionBelow('1.0', '0.2.0')).toBe(false);
  });
});
