// @vitest-environment node
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('@/lib/messenger/products', () => ({ refreshDueProducts: m.refresh }));
import { POST } from './route';
const secret = 'a'.repeat(40);
const call = (authorization?: string) => POST(new NextRequest('http://localhost/api/internal/messenger/products', { method: 'POST', headers: authorization ? { authorization } : {} }));
beforeEach(() => { vi.stubEnv('MESSENGER_PRODUCTS_SECRET', secret); m.refresh.mockReset().mockResolvedValue({ processed: 3, failed: 0 }); });
afterEach(() => vi.unstubAllEnvs());
describe('catalogue refresh job boundary', () => {
  it('runs a bounded batch only for the configured bearer secret', async () => {
    const res = await call(`Bearer ${secret}`);
    expect(res.status).toBe(200); expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({ ok: true, processed: 3, failed: 0 });
  });
  it('refuses missing, short and incorrect secrets before any work', async () => {
    expect((await call()).status).toBe(401); expect((await call('Bearer wrong')).status).toBe(401);
    vi.stubEnv('MESSENGER_PRODUCTS_SECRET', 'short'); expect((await call('Bearer short')).status).toBe(401);
    expect(m.refresh).not.toHaveBeenCalled();
  });
  it('returns a retryable server failure when the due query is unavailable', async () => {
    m.refresh.mockRejectedValue(new Error('offline')); expect((await call(`Bearer ${secret}`)).status).toBe(500);
  });
});
