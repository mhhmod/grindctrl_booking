// @vitest-environment node
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock('@/lib/woo/signed-request', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/woo/signed-request')>()),
  verifyWooSignedRequest: mocks.verify,
}));

vi.mock('@/lib/messenger/db', () => ({
  getMessengerServiceClient: () => ({
    from: (table: string) => {
      expect(table).toBe('woo_site_connections');
      const builder = {
        update: (payload: unknown) => {
          mocks.update(payload);
          return builder;
        },
        eq: (field: string, value: unknown) => {
          mocks.eq(field, value);
          return builder;
        },
        select: () => builder,
        maybeSingle: mocks.maybeSingle,
      };
      return builder;
    },
  }),
}));

import { POST } from './route';

const SITE_ID = '123e4567-e89b-12d3-a456-426614174000';
const BODY = {
  homeUrl: 'https://shop.example.com/',
  pluginVersion: '0.2.0',
  wpVersion: '6.8',
  wcVersion: '10.3.0',
  timezone: 'Africa/Cairo',
  currency: 'EGP',
};

function post(body: unknown = BODY) {
  return POST(new NextRequest('http://localhost/api/woo/heartbeat', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }));
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.verify.mockResolvedValue({
    ok: true,
    siteId: SITE_ID,
    secretVersion: 1,
    connectionStatus: 'active',
    homeUrl: 'https://shop.example.com',
  });
  mocks.maybeSingle.mockResolvedValue({ data: { widget_site_id: SITE_ID }, error: null });
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('POST /api/woo/heartbeat', () => {
  it('records the heartbeat for an active site and asks for no more than the minimum version', async () => {
    const response = await post();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({
      ok: true,
      homeUrlMismatch: false,
      minPluginVersion: '0.4.0',
    });
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      last_home_url: 'https://shop.example.com',
      plugin_version: '0.2.0',
      wp_version: '6.8',
      wc_version: '10.3.0',
      timezone: 'Africa/Cairo',
      currency: 'EGP',
      last_seen_at: expect.any(String),
    }));
    expect(mocks.eq).toHaveBeenCalledWith('widget_site_id', SITE_ID);
    expect(mocks.eq).toHaveBeenCalledWith('status', 'active');
  });

  it('stores the reported REST root for plain permalinks, only when it is the paired site', async () => {
    await post({ ...BODY, restUrl: 'https://shop.example.com/?rest_route=/' });
    expect(mocks.update).toHaveBeenCalledWith({ rest_base_url: 'https://shop.example.com/?rest_route=/' });
  });

  it.each([
    ['another host', { restUrl: 'https://evil.example.net/wp-json/' }],
    ['a private address', { restUrl: 'https://169.254.169.254/' }],
    ['a stray query', { restUrl: 'https://shop.example.com/?rest_route=/&x=1' }],
    ['a copied database', { homeUrl: 'https://staging.example.net/', restUrl: 'https://staging.example.net/wp-json/' }],
  ])('does not store a REST root from %s', async (_name, extra) => {
    await post({ ...BODY, ...extra });
    expect(mocks.update).not.toHaveBeenCalledWith(expect.objectContaining({ rest_base_url: expect.anything() }));
  });

  it('flags a different home URL on every heartbeat and never overwrites the paired one', async () => {
    const copy = { ...BODY, homeUrl: 'https://staging.example.net/' };
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await post(copy);
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ ok: true, homeUrlMismatch: true });
    }
    for (const [payload] of mocks.update.mock.calls) {
      expect(payload).not.toHaveProperty('home_url');
      expect(payload).toMatchObject({ last_home_url: 'https://staging.example.net' });
    }
  });

  it('answers a failed signature with its code, and returns server time for a skewed clock', async () => {
    mocks.verify.mockResolvedValue({
      ok: false,
      code: 'stale_timestamp',
      status: 401,
      siteId: SITE_ID,
      serverTime: 1_799_999_999,
    });
    const response = await post();

    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ error: 'stale_timestamp', serverTime: 1_799_999_999 });
    expect(mocks.update).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith('[woo] heartbeat rejected', {
      code: 'stale_timestamp',
      siteId: SITE_ID,
    });
  });

  it.each([
    ['bad_signature', 401],
    ['replayed', 409],
    ['site_disconnected', 403],
    ['unavailable', 503],
  ] as const)('passes %s through with status %i', async (code, status) => {
    mocks.verify.mockResolvedValue({ ok: false, code, status, siteId: SITE_ID });
    const response = await post();

    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: code });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('verifies the exact raw body that was sent', async () => {
    const raw = `${JSON.stringify(BODY)}\n`;
    await post(raw);

    expect(mocks.verify).toHaveBeenCalledWith(expect.any(Request), raw);
  });

  it.each([
    ['not JSON', '{nope'],
    ['an http home URL', { ...BODY, homeUrl: 'http://shop.example.com' }],
    ['a missing plugin version', { ...BODY, pluginVersion: undefined }],
    ['a bad currency', { ...BODY, currency: 'eg' }],
  ])('answers invalid_request, not a signature error, for %s', async (_label, body) => {
    const response = await post(body);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_request' });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('rejects an oversized body before verifying it', async () => {
    const response = await post('x'.repeat(20 * 1024));

    expect(response.status).toBe(413);
    expect(mocks.verify).not.toHaveBeenCalled();

    // No Content-Length, endless body: cut off at the limit plus one chunk.
    let pulled = 0;
    const endless = new ReadableStream<Uint8Array>({
      pull(controller) { pulled += 1024; controller.enqueue(new Uint8Array(1024).fill(0x20)); },
    }, { highWaterMark: 0 });
    const streamed = await POST(new NextRequest('https://grindctrl.cloud/api/woo/heartbeat', {
      method: 'POST', body: endless, duplex: 'half',
    } as ConstructorParameters<typeof NextRequest>[1]));
    expect(streamed.status).toBe(413);
    expect(pulled).toBeLessThanOrEqual(16 * 1024 + 1024);
    expect(mocks.verify).not.toHaveBeenCalled();
  });

  it('refuses a site that was disconnected between verification and the write', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    const response = await post();

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'site_disconnected' });
  });

  it('answers unavailable without database detail when the write fails', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: { message: 'secret-db-detail' } });
    const response = await post();
    const text = await response.text();

    expect(response.status).toBe(503);
    expect(JSON.parse(text)).toEqual({ error: 'unavailable' });
    expect(text).not.toContain('secret-db-detail');
    expect(console.error).toHaveBeenCalledWith('[woo] heartbeat failed', {
      code: 'unavailable',
      siteId: SITE_ID,
    });
  });
});
