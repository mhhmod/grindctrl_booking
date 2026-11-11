// @vitest-environment node
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WOO_PLUGIN_RELEASE } from '@/lib/woo/plugin-release';

const mocks = vi.hoisted(() => ({ limit: vi.fn() }));
vi.mock('@/lib/ratelimit', () => ({
  publicApiRatelimit: { limit: mocks.limit },
  clientIp: () => '203.0.113.9',
}));
import { GET } from './route';

const get = () => GET(new NextRequest('https://grindctrl.cloud/api/woo/plugin/update'));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.limit.mockResolvedValue({ success: true, reset: Date.now() + 1000 });
});

describe('GET /api/woo/plugin/update', () => {
  it('returns only public release metadata with a ten-minute public cache and no authentication', async () => {
    const response = await get();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('public, max-age=600');
    expect(response.headers.get('set-cookie')).toBeNull();
    const body = await response.json();
    expect(body).toEqual(WOO_PLUGIN_RELEASE);
    expect(Object.keys(body).sort()).toEqual(['version', 'package', 'sha256', 'requires', 'requires_php', 'tested', 'wc_tested', 'last_updated', 'homepage', 'changelog_html'].sort());
    expect(body.package).toBe(`https://grindctrl.cloud/downloads/grindctrl-store-chat.zip?v=${body.version}`);
    expect(body.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(body.changelog_html).toContain('Updates now install by themselves.');
    expect(mocks.limit).toHaveBeenCalledWith('woo-plugin-update:203.0.113.9');
  });

  it('denies rate-limited requests without publicly caching the denial', async () => {
    mocks.limit.mockResolvedValue({ success: false, reset: Date.now() + 5000 });
    const response = await get();
    expect(response.status).toBe(429);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(Number(response.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(await response.json()).toMatchObject({ error: 'rate_limited' });
  });

  it.each([
    null,
    {},
    { success: true, reset: NaN },
    { success: true, reset: Date.now() + 1000, reason: 'timeout' },
  ])('fails closed on malformed or timeout-success enforcement: %j', async (result) => {
    mocks.limit.mockResolvedValue(result);
    const response = await get();
    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toMatchObject({ error: 'unavailable' });
  });

  it('fails closed when the limiter is unavailable', async () => {
    mocks.limit.mockRejectedValue(new Error('Redis unavailable'));
    expect((await get()).status).toBe(503);
  });
});
