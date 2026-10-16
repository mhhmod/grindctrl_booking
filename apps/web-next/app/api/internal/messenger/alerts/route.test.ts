// @vitest-environment node
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ retry: vi.fn() }));
vi.mock('@/lib/messenger/alert-retry', () => ({ retryPendingAlerts: mocks.retry }));

import { POST } from './route';

const SECRET = 'a'.repeat(40);
const call = (authorization?: string) =>
  POST(new NextRequest('http://localhost/api/internal/messenger/alerts', {
    method: 'POST',
    headers: authorization ? { authorization } : {},
  }));

describe('POST /api/internal/messenger/alerts', () => {
  beforeEach(() => {
    process.env.MESSENGER_ALERTS_SECRET = SECRET;
    mocks.retry.mockReset().mockResolvedValue({ scanned: 1, retried: 1, sent: 1, stillPending: 0 });
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });
  afterEach(() => {
    delete process.env.MESSENGER_ALERTS_SECRET;
    vi.restoreAllMocks();
  });

  it('runs the retry for the workflow holding the secret', async () => {
    const res = await call(`Bearer ${SECRET}`);
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({ scanned: 1, retried: 1, sent: 1, stillPending: 0 });
  });

  it('refuses anyone else, and everyone while the secret is unset or short', async () => {
    expect((await call()).status).toBe(401);
    expect((await call('Bearer wrong')).status).toBe(401);
    process.env.MESSENGER_ALERTS_SECRET = 'short';
    expect((await call('Bearer short')).status).toBe(401);
    expect(mocks.retry).not.toHaveBeenCalled();
  });

  it('answers 500 when the retry fails, so the workflow run shows it', async () => {
    mocks.retry.mockRejectedValue(new Error('db down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await call(`Bearer ${SECRET}`)).status).toBe(500);
  });
});
