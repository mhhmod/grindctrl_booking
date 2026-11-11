// @vitest-environment node
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock('@/lib/store-health/alerts', () => ({ runStoreHealthAlerts: mocks.run }));
vi.mock('node:crypto', async (original) => {
  const actual = await original<typeof import('node:crypto')>();
  return { ...actual, timingSafeEqual: vi.fn(actual.timingSafeEqual) };
});
import { timingSafeEqual } from 'node:crypto';
import { POST } from './route';
const SECRET = 'a'.repeat(40);
const call = (authorization?: string) => POST(new NextRequest('http://localhost/api/internal/store-health/alerts', {
  method: 'POST', headers: authorization ? { authorization } : {},
}));
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('STORE_HEALTH_ALERTS_SECRET', SECRET); });
afterEach(() => vi.unstubAllEnvs());
describe('store-health scheduled route', () => {
  it.each([undefined, '', 'Bearer bad', `Basic ${SECRET}`, `Bearer ${SECRET} extra`, `Bearer ${'b'.repeat(40)}`, `Bearer ${'é'.repeat(40)}`])('rejects missing/wrong/malformed bearer %s with no work', async (auth) => {
    expect((await call(auth)).status).toBe(401); expect(mocks.run).not.toHaveBeenCalled();
  });
  it('uses timingSafeEqual on equal byte lengths for both wrong and valid secrets', async () => {
    expect((await call(`Bearer ${'b'.repeat(40)}`)).status).toBe(401);
    mocks.run.mockResolvedValue({ checked: 50, sent: 1 });
    const response = await call(`Bearer ${SECRET}`);
    expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('no-store');
    expect(timingSafeEqual).toHaveBeenCalledTimes(2);
    expect(mocks.run).toHaveBeenCalledWith();
  });
  it.each(['', 'too-short'])('denies unset/unsafe server config %s', async (value) => {
    vi.stubEnv('STORE_HEALTH_ALERTS_SECRET', value);
    expect((await call(`Bearer ${SECRET}`)).status).toBe(401);
  });
  it('returns a generic 500 when the worker fails', async () => {
    mocks.run.mockRejectedValue(new Error('private detail'));
    const response = await call(`Bearer ${SECRET}`);
    expect(response.status).toBe(500); expect(await response.text()).not.toContain('private detail');
  });
});
