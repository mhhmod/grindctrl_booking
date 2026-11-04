// @vitest-environment node
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  writes: [] as Array<{ table: string; payload: unknown; filters: Array<[string, unknown]> }>,
  result: vi.fn(),
}));

vi.mock('@/lib/woo/signed-request', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/woo/signed-request')>()),
  verifyWooSignedRequest: mocks.verify,
}));

vi.mock('@/lib/messenger/db', () => ({
  getMessengerServiceClient: () => ({
    from: (table: string) => {
      const write = { table, payload: undefined as unknown, filters: [] as Array<[string, unknown]> };
      const builder = {
        update: (payload: unknown) => {
          write.payload = payload;
          return builder;
        },
        eq: (field: string, value: unknown) => {
          write.filters.push([field, value]);
          return builder;
        },
        then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => {
          mocks.writes.push(write);
          return Promise.resolve(mocks.result(table)).then(resolve, reject);
        },
      };
      return builder;
    },
  }),
}));

import { POST } from './route';

const SITE_ID = '123e4567-e89b-12d3-a456-426614174000';

function post(body: unknown = { homeUrl: 'https://shop.example.com/', pluginVersion: '0.2.0' }) {
  return POST(new NextRequest('http://localhost/api/woo/disconnect', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }));
}

function verified(connectionStatus: 'active' | 'disconnected' = 'active') {
  return {
    ok: true,
    siteId: SITE_ID,
    secretVersion: 1,
    connectionStatus,
    homeUrl: 'https://shop.example.com',
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.writes.length = 0;
  mocks.verify.mockResolvedValue(verified());
  mocks.result.mockReturnValue({ error: null });
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('POST /api/woo/disconnect', () => {
  it('disconnects the connection and takes the tenant row out of service', async () => {
    const response = await post();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ ok: true });

    const connection = mocks.writes.find((write) => write.table === 'woo_site_connections')!;
    expect(connection.payload).toMatchObject({
      status: 'disconnected',
      disconnected_at: expect.any(String),
    });
    expect(connection.filters).toEqual([['widget_site_id', SITE_ID], ['status', 'active']]);

    const tenant = mocks.writes.find((write) => write.table === 'tryon_shops')!;
    expect(tenant.payload).toMatchObject({
      status: 'uninstalled',
      uninstalled_at: expect.any(String),
    });
    expect(tenant.filters).toEqual([['shop_domain', `site:${SITE_ID}`], ['status', 'installed']]);
  });

  it('authenticates an already-disconnected site and repeats the guarded writes as a no-op', async () => {
    mocks.verify.mockResolvedValue(verified('disconnected'));
    const response = await post();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(mocks.verify).toHaveBeenCalledWith(expect.any(Request), expect.any(String), {
      allowDisconnected: true,
    });
    // Every write is guarded on the current state, so a repeat changes nothing.
    for (const write of mocks.writes) {
      expect(write.filters.some(([field]) => field === 'status')).toBe(true);
    }
  });

  it.each([
    ['bad_signature', 401],
    ['stale_timestamp', 401],
    ['replayed', 409],
    ['unavailable', 503],
  ] as const)('writes nothing when verification fails with %s', async (code, status) => {
    mocks.verify.mockResolvedValue({ ok: false, code, status, siteId: SITE_ID });
    const response = await post();

    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: code });
    expect(mocks.writes).toHaveLength(0);
  });

  it('rejects an oversized body before verifying it', async () => {
    const response = await post('x'.repeat(8 * 1024));

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: 'invalid_request' });
    expect(mocks.verify).not.toHaveBeenCalled();
  });

  it.each(['woo_site_connections', 'tryon_shops'])(
    'answers unavailable without database detail when the %s write fails',
    async (failing) => {
      mocks.result.mockImplementation((table: string) =>
        table === failing ? { error: { message: 'secret-db-detail' } } : { error: null },
      );
      const response = await post();
      const text = await response.text();

      expect(response.status).toBe(503);
      expect(JSON.parse(text)).toEqual({ error: 'unavailable' });
      expect(text).not.toContain('secret-db-detail');
      expect(console.error).toHaveBeenCalledWith('[woo] disconnect failed', {
        code: 'unavailable',
        siteId: SITE_ID,
      });
    },
  );
});
