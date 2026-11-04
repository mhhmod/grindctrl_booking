// @vitest-environment node
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ cleanup: vi.fn(), woo: vi.fn() }));
vi.mock('@/lib/shopify/chat-retention', () => ({ CHAT_RETENTION_BATCH_LIMIT: 25, cleanupInactiveStoreChat: mocks.cleanup }));
vi.mock('@/lib/woo/privacy', () => ({ redactDueWooSites: mocks.woo }));
import { POST } from './route';

const secret = 'r'.repeat(40);
const summary = { scanned: 1, conversations: 1, messages: 3, attachments: 0, storageObjects: 0, visitors: 1, events: 0, feedback: 0, unanswered: 0, pending: 0, failed: 0 };
const wooSummary = { sites: 1, completed: 1, pending: 0, storageRemoved: 2, failed: 0 };
const call = (authorization?: string) => POST(new NextRequest('http://localhost/api/internal/shopify/retention', {
  method: 'POST', headers: authorization ? { authorization } : {},
}));

describe('Store Chat retention cron', () => {
  beforeEach(() => {
    vi.stubEnv('TRYON_CLEANUP_SECRET', secret);
    mocks.cleanup.mockReset().mockResolvedValue(summary);
    mocks.woo.mockReset().mockResolvedValue(wooSummary);
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

  it('requires the configured long bearer secret before invoking cleanup', async () => {
    for (const header of [undefined, 'Bearer wrong', `Basic ${secret}`, `Bearer ${secret} extra`]) {
      expect((await call(header)).status).toBe(401);
    }
    vi.stubEnv('TRYON_CLEANUP_SECRET', 'short');
    expect((await call('Bearer short')).status).toBe(401);
    vi.stubEnv('TRYON_CLEANUP_SECRET', '');
    expect((await call(`Bearer ${secret}`)).status).toBe(401);
    expect(mocks.cleanup).not.toHaveBeenCalled();
  });

  it('runs bounded cleanup and logs only counts', async () => {
    const response = await call(`Bearer ${secret}`);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(mocks.cleanup).toHaveBeenCalledWith(25);
    expect(await response.json()).toEqual({ ok: true, data: summary, woo: wooSummary });
    expect(console.info).toHaveBeenCalledWith('[store-chat-retention] completed', summary);
  });

  it('returns 500 for partial failure so the scheduler can alert', async () => {
    mocks.cleanup.mockResolvedValue({ ...summary, failed: 1 });
    expect((await call(`Bearer ${secret}`)).status).toBe(500);
    expect(console.error).toHaveBeenCalledWith('[store-chat-retention] failed', { ...summary, failed: 1 });
  });

  it('keeps provider errors and shopper data out of logs and responses', async () => {
    mocks.cleanup.mockRejectedValue(new Error('private@example.com/site/attachment'));
    const response = await call(`Bearer ${secret}`);
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('private@example.com');
    expect(console.error).toHaveBeenCalledWith('[store-chat-retention] failed', { failed: 1 });
  });

  it('redacts due WooCommerce sites on the same run, and a failure in one job never skips the other', async () => {
    mocks.cleanup.mockRejectedValue(new Error('boom'));
    const response = await call(`Bearer ${secret}`);
    expect(response.status).toBe(500);
    expect(mocks.woo).toHaveBeenCalledTimes(1);
    expect(await response.json()).toMatchObject({ ok: false, woo: wooSummary });

    mocks.cleanup.mockResolvedValue(summary);
    mocks.woo.mockRejectedValue(new Error('private@example.com'));
    const second = await call(`Bearer ${secret}`);
    expect(second.status).toBe(500);
    expect(mocks.cleanup).toHaveBeenCalledTimes(2);
    expect(await second.text()).not.toContain('private@example.com');
  });

  it('reports a Woo redaction failure as a failed run', async () => {
    mocks.woo.mockResolvedValue({ ...wooSummary, failed: 1 });
    expect((await call(`Bearer ${secret}`)).status).toBe(500);
  });
});
