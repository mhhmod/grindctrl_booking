// @vitest-environment node
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  rpc: vi.fn(),
  limit: vi.fn(),
  remove: vi.fn(),
  queued: [] as Array<{ bucket: string; path: string }>,
  cleared: [] as unknown[],
}));

vi.mock('@/lib/woo/signed-request', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/woo/signed-request')>()),
  verifyWooSignedRequest: mocks.verify,
}));
vi.mock('@/lib/ratelimit', () => ({
  publicApiRatelimit: { configured: true, limit: mocks.limit },
  clientIp: () => '203.0.113.9',
}));
vi.mock('@/lib/messenger/db', () => ({
  getMessengerServiceClient: () => ({
    rpc: mocks.rpc,
    from: (table: string) => {
      expect(table).toBe('woo_privacy_storage_queue');
      const builder = {
        select: () => builder,
        order: () => builder,
        limit: () => Promise.resolve({ data: mocks.queued, error: null }),
        delete: () => builder,
        eq: () => builder,
        in: (_field: string, paths: string[]) => {
          mocks.cleared.push(paths);
          return Promise.resolve({ error: null });
        },
      };
      return builder;
    },
    storage: { from: () => ({ remove: mocks.remove }) },
  }),
}));

import { POST as exportPost } from './export/route';
import { POST as erasePost } from './erase/route';

const SITE_ID = '123e4567-e89b-12d3-a456-426614174000';
const EMAIL = 'Shopper@Example.com';

function call(handler: typeof exportPost, path: string, body: unknown) {
  return handler(new NextRequest(`http://localhost/api/woo/privacy/${path}`, {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }));
}

const logged = () => JSON.stringify([
  ...(console.info as unknown as { mock: { calls: unknown[] } }).mock.calls,
  ...(console.warn as unknown as { mock: { calls: unknown[] } }).mock.calls,
  ...(console.error as unknown as { mock: { calls: unknown[] } }).mock.calls,
]);

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('GRINDCTRL_CAPABILITY_SECRET', 'k'.repeat(40));
  mocks.queued = [];
  mocks.cleared = [];
  mocks.verify.mockResolvedValue({
    ok: true, siteId: SITE_ID, secretVersion: 1, connectionStatus: 'active', homeUrl: 'https://shop.example.com',
  });
  mocks.limit.mockResolvedValue({ success: true, reset: Date.now() + 1000 });
  mocks.remove.mockResolvedValue({ error: null, data: [] });
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe.each([['export', exportPost], ['erase', erasePost]] as const)('POST /api/woo/privacy/%s guards', (name, handler) => {
  it.each([
    ['bad_signature', 401],
    ['replayed', 409],
    ['site_disconnected', 403],
    ['unavailable', 503],
  ] as const)('does no work when verification fails with %s', async (code, status) => {
    mocks.verify.mockResolvedValue({ ok: false, code, status, siteId: SITE_ID });
    const response = await call(handler, name, { email: EMAIL, page: 1 });

    expect(response.status).toBe(status);
    expect(mocks.limit).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ['a missing email', { page: 1 }],
    ['a list of emails', { email: 'a@example.com,b@example.com', page: 1 }],
    ['a header-injection email', { email: 'a@example.com\r\nbcc: x@example.com', page: 1 }],
    ['page zero', { email: EMAIL, page: 0 }],
    ['a fractional page', { email: EMAIL, page: 1.5 }],
    ['a string page', { email: EMAIL, page: '2' }],
    ['not json', 'nope'],
    ['an array body', [EMAIL]],
  ])('rejects %s before touching data', async (_label, body) => {
    const response = await call(handler, name, body);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_request' });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('rejects an oversized body before verifying it', async () => {
    const response = await call(handler, name, 'x'.repeat(8 * 1024));
    expect(response.status).toBe(413);
    expect(mocks.verify).not.toHaveBeenCalled();
  });

  it('rate limits per site, after the signature', async () => {
    mocks.limit.mockResolvedValue({ success: false, reset: Date.now() + 30_000 });
    const response = await call(handler, name, { email: EMAIL, page: 1 });

    expect(response.status).toBe(429);
    expect(mocks.limit).toHaveBeenCalledWith(`woo-privacy:${SITE_ID}`);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('fails closed when the rate limiter is unavailable', async () => {
    mocks.limit.mockRejectedValue(new Error('redis down'));
    const response = await call(handler, name, { email: EMAIL, page: 1 });

    expect(response.status).toBe(503);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('answers unavailable without database detail, and never logs the email', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: `boom ${EMAIL}` } });
    const response = await call(handler, name, { email: EMAIL, page: 1 });
    const text = await response.text();

    expect(response.status).toBe(503);
    expect(text).not.toContain('boom');
    expect(logged().toLowerCase()).not.toContain('shopper@example.com');
  });
});

describe('POST /api/woo/privacy/export', () => {
  it('normalises the email, pages, and maps to WordPress export items', async () => {
    mocks.rpc.mockResolvedValue({
      error: null,
      data: {
        total: 12,
        done: false,
        visitors: [{ name: 'Sam', email: 'shopper@example.com', firstSeenAt: '2026-10-01', lastSeenAt: '2026-10-02' }],
        leads: [],
        conversations: [{
          id: 'c1', startedAt: '2026-10-01', status: 'closed', lastPageUrl: 'https://shop.example.com/p',
          messages: [{ role: 'user', content: 'Is it waterproof?', createdAt: '2026-10-01T10:00:00Z' }],
          attachments: [{ id: 'a1', mime: 'image/png', bytes: 100, createdAt: '2026-10-01' }],
          feedback: [], questions: ['Is it waterproof?'],
        }],
      },
    });
    const response = await call(exportPost, 'export', { email: `  ${EMAIL} `, page: 2 });
    const body = await response.json();

    expect(mocks.rpc).toHaveBeenCalledWith('woo_privacy_export', {
      p_site: SITE_ID, p_email: 'shopper@example.com', p_page: 2, p_page_size: 10,
    });
    expect(response.status).toBe(200);
    expect(body.done).toBe(false);
    expect(body.items).toHaveLength(2);
    expect(body.items[1]).toMatchObject({ group_id: 'grindctrl-store-chat', item_id: 'conversation-c1' });
    expect(JSON.stringify(body.items[1].data)).toContain('Is it waterproof?');
    expect(JSON.stringify(body.items[1].data)).not.toContain('storage');
    expect(logged().toLowerCase()).not.toContain('shopper@example.com');
    expect(logged()).toMatch(/"emailHash":"[0-9a-f]{16}"/);
  });

  it('defaults the page to 1', async () => {
    mocks.rpc.mockResolvedValue({ error: null, data: { conversations: [], visitors: [], leads: [], total: 0, done: true } });
    const response = await call(exportPost, 'export', { email: EMAIL });

    expect(response.status).toBe(200);
    expect(mocks.rpc.mock.calls[0][1]).toMatchObject({ p_page: 1 });
    expect(await response.json()).toEqual({ ok: true, items: [], done: true });
  });
});

describe('POST /api/woo/privacy/erase', () => {
  it('erases one batch, reports done only when nothing remains, and drains storage', async () => {
    mocks.queued = [{ bucket: 'messenger-attachments', path: `${SITE_ID}/c1/a1.png` }];
    mocks.rpc.mockResolvedValue({
      error: null,
      data: { remaining: 3, counts: { conversations: 10, messages: 40, leads: 0, visitors: 1, storage_objects_queued: 1 } },
    });
    const response = await call(erasePost, 'erase', { email: EMAIL, page: 5 });
    const body = await response.json();

    expect(mocks.rpc).toHaveBeenCalledWith('woo_privacy_erase', {
      p_site: SITE_ID, p_email: 'shopper@example.com', p_batch: 10,
    });
    expect(body).toMatchObject({ ok: true, removed: 11, done: false });
    expect(mocks.remove).toHaveBeenCalledWith([`${SITE_ID}/c1/a1.png`]);
    expect(mocks.cleared).toEqual([[`${SITE_ID}/c1/a1.png`]]);
    expect(logged().toLowerCase()).not.toContain('shopper@example.com');
  });

  it('reports done when no matching conversation remains', async () => {
    mocks.rpc.mockResolvedValue({ error: null, data: { remaining: 0, counts: { conversations: 0 } } });
    const body = await (await call(erasePost, 'erase', { email: EMAIL })).json();
    expect(body).toMatchObject({ removed: 0, done: true });
  });

  it('still succeeds when Storage removal fails, leaving the objects queued', async () => {
    mocks.queued = [{ bucket: 'messenger-attachments', path: 'p1' }];
    mocks.remove.mockResolvedValue({ error: { message: 'storage down' }, data: null });
    mocks.rpc.mockResolvedValue({ error: null, data: { remaining: 0, counts: { conversations: 1 } } });
    const response = await call(erasePost, 'erase', { email: EMAIL });

    expect(response.status).toBe(200);
    expect(mocks.cleared).toEqual([]);
  });
});
