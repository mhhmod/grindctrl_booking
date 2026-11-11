// @vitest-environment node
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const SITE = '123e4567-e89b-42d3-a456-426614174000';
const mocks = vi.hoisted(() => ({
  ipLimit: vi.fn(),
  siteLimit: vi.fn(),
  site: vi.fn(),
  active: vi.fn(),
  config: vi.fn(),
}));

vi.mock('@/lib/ratelimit', () => ({
  publicApiRatelimit: { limit: mocks.ipLimit },
  proxyShopReadRatelimit: { limit: mocks.siteLimit },
  clientIp: () => '203.0.113.9',
}));
vi.mock('@/lib/shopify/tokens', () => ({ isActiveTenant: mocks.active }));
vi.mock('@/lib/woo/tryon-site', () => ({ siteByEmbedKey: mocks.site }));
vi.mock('@/lib/woo/tryon-config', () => ({ buildSiteTryOnConfig: mocks.config }));

import { GET, OPTIONS } from './route';

const get = (query = 'key=abcdefgh12345678&locale=ar') =>
  GET(new NextRequest(`http://localhost/api/woo/tryon-config?${query}`));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.ipLimit.mockResolvedValue({ success: true, reset: Date.now() + 1000 });
  mocks.siteLimit.mockResolvedValue({ success: true, reset: Date.now() + 1000 });
  mocks.site.mockResolvedValue({ id: SITE, status: 'active' });
  mocks.active.mockResolvedValue(true);
  mocks.config.mockResolvedValue({ enabled: true, reason: null, buttonLabel: 'جرّبها' });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('GET /api/woo/tryon-config', () => {
  it('returns the site config with open CORS and no browser cache for live daily availability', async () => {
    const response = await get();
    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toMatchObject({ enabled: true });
    expect(mocks.config).toHaveBeenCalledWith(SITE, 'ar');
    expect(mocks.siteLimit).toHaveBeenCalledWith(`wtcfg:${SITE}`);
  });

  it('answers an unknown key without leaking anything and does not cache it', async () => {
    mocks.site.mockResolvedValue(null);
    const response = await get();
    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(mocks.config).not.toHaveBeenCalled();
  });

  it('reports a disconnected site as not installed instead of reading the shared cache', async () => {
    mocks.active.mockResolvedValue(false);
    const response = await get();
    expect(await response.json()).toEqual({ enabled: false, reason: 'not_installed' });
    expect(mocks.config).not.toHaveBeenCalled();
  });

  it('is rate limited, with CORS on the denial, and fails closed', async () => {
    mocks.ipLimit.mockResolvedValue({ success: false, reset: Date.now() + 5000 });
    const limited = await get();
    expect(limited.status).toBe(429);
    expect(limited.headers.get('access-control-allow-origin')).toBe('*');

    mocks.ipLimit.mockRejectedValue(new Error('redis down'));
    expect((await get()).status).toBe(503);
    expect(mocks.site).not.toHaveBeenCalled();
  });

  it('answers the preflight', async () => {
    expect((await OPTIONS()).status).toBe(204);
  });
});

vi.mock('@/lib/try-on/daily-budget', () => ({ tryOnDayAvailability: vi.fn(async () => 'live'), readTryOnDayStatus: vi.fn(async () => ({ used: 0, limit: 300, reached: false })) }));
import { tryOnDayAvailability, readTryOnDayStatus } from '@/lib/try-on/daily-budget';
beforeEach(() => {
  vi.mocked(tryOnDayAvailability).mockResolvedValue('live');
  vi.mocked(readTryOnDayStatus).mockResolvedValue({ used: 0, limit: 300, reached: false });
});
