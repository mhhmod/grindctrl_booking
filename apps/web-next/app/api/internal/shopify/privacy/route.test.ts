import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { run } = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock('@/lib/shopify/privacy', () => ({ runPendingShopifyPrivacyRequests: run }));
import { POST } from './route';

const SECRET = 'privacy-cleanup-secret-at-least-32-bytes';
const summary = { processed: 3, completed: 1, exportedPendingDelivery: 1, manualRequired: 1, failed: 0 };
const request = (token?: string) => new NextRequest('http://localhost/api/internal/shopify/privacy', {
  method: 'POST', headers: token ? { authorization: `Bearer ${token}` } : {},
});

describe('privacy scheduler endpoint', () => {
  beforeEach(() => {
    vi.stubEnv('TRYON_CLEANUP_SECRET', SECRET);
    run.mockReset().mockResolvedValue(summary);
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

  it.each([undefined, 'short', 'x'.repeat(SECRET.length)])('rejects invalid bearer %s before work', async (token) => {
    const response = await POST(request(token));
    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(run).not.toHaveBeenCalled();
  });
  it.each(['', 'short'])('fails closed for unconfigured or short runtime secrets', async (secret) => {
    vi.stubEnv('TRYON_CLEANUP_SECRET', secret);
    expect((await POST(request(SECRET))).status).toBe(401);
    expect(run).not.toHaveBeenCalled();
  });
  it('runs a bounded batch and reports only counts', async () => {
    const response = await POST(request(SECRET));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, data: summary });
    expect(run).toHaveBeenCalledWith({ limit: 25 });
    expect(console.info).toHaveBeenCalledWith('[shopify-privacy] pending work processed', summary);
  });
  it('signals partial failure for scheduler monitoring and retries next run', async () => {
    run.mockResolvedValueOnce({ ...summary, failed: 1 });
    expect((await POST(request(SECRET))).status).toBe(500);
    expect((await POST(request(SECRET))).status).toBe(200);
  });
  it('does not leak sensitive errors in responses or logs', async () => {
    run.mockRejectedValue(new Error('customer@example.com secret SMTP payload'));
    const response = await POST(request(SECRET));
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('customer@example.com');
    expect(console.error).toHaveBeenCalledWith('[shopify-privacy] pending work unavailable');
  });
});
