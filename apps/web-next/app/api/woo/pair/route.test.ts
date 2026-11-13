// @vitest-environment node
import { createHash } from 'node:crypto';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

type Call = {
  table: string;
  op: 'select' | 'update' | 'upsert';
  payload?: Record<string, unknown>;
  options?: Record<string, unknown>;
  filters: Array<[string, string, unknown]>;
};

const mocks = vi.hoisted(() => ({
  limit: vi.fn(),
  handle: vi.fn(),
  calls: [] as unknown[],
  connectedEmail: vi.fn(),
  adoptName: vi.fn(),
}));

vi.mock('@/lib/email/store-connected-sender', () => ({ scheduleStoreConnectedEmail: mocks.connectedEmail }));
vi.mock('@/lib/dashboard/store-domains', () => ({ adoptStoreNameFromAddress: mocks.adoptName }));

vi.mock('@/lib/ratelimit', () => ({
  publicApiRatelimit: { configured: true, limit: mocks.limit },
  clientIp: () => '203.0.113.9',
}));

vi.mock('@/lib/messenger/db', () => ({
  getMessengerServiceClient: () => ({
    from(table: string) {
      const call: Call = { table, op: 'select', filters: [] };
      const run = () => {
        mocks.calls.push(call);
        return Promise.resolve(mocks.handle(call));
      };
      const builder = {
        select: () => builder,
        update: (payload: Record<string, unknown>) => {
          call.op = 'update';
          call.payload = payload;
          return builder;
        },
        upsert: (payload: Record<string, unknown>, options?: Record<string, unknown>) => {
          call.op = 'upsert';
          call.payload = payload;
          call.options = options;
          return builder;
        },
        eq: (field: string, value: unknown) => {
          call.filters.push(['eq', field, value]);
          return builder;
        },
        is: (field: string, value: unknown) => {
          call.filters.push(['is', field, value]);
          return builder;
        },
        gt: (field: string, value: unknown) => {
          call.filters.push(['gt', field, value]);
          return builder;
        },
        maybeSingle: run,
        then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
          run().then(resolve, reject),
      };
      return builder;
    },
  }),
}));

import { deriveWooSiteSecret } from '@/lib/woo/site-secret';
import { POST } from './route';

const SITE_ID = '123e4567-e89b-12d3-a456-426614174000';
const CORE = 'test-only-independent-core-signing-key-2026';
const CODE = 'K7QM4TXP';
const CODE_HASH = createHash('sha256').update(CODE).digest('hex');
const EMBED_KEY = 'gc_abcd1234_wxyz';

const BODY = {
  code: CODE,
  homeUrl: 'https://shop.example.com/',
  pluginVersion: '0.2.0',
  wpVersion: '6.8',
  wcVersion: '10.3.0',
  timezone: 'Africa/Cairo',
  currency: 'EGP',
  platform: 'woocommerce',
};

function post(body: unknown = BODY, headers: Record<string, string> = {}) {
  return POST(new NextRequest('http://localhost/api/woo/pair', {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }));
}

function calls(): Call[] {
  return mocks.calls as Call[];
}

function find(table: string, op: Call['op']) {
  return calls().find((call) => call.table === table && call.op === op);
}

/** A live code, an existing site, and no earlier connection, unless overridden. */
function database(overrides: {
  code?: Record<string, unknown> | null;
  connection?: Record<string, unknown> | null;
  consumed?: Record<string, unknown> | null;
  fail?: string;
} = {}) {
  mocks.handle.mockImplementation((call: Call) => {
    const key = `${call.table}:${call.op}`;
    if (overrides.fail === key) return { data: null, error: { message: 'secret-db-detail' } };
    switch (key) {
      case 'woo_pairing_codes:select':
        return {
          data: overrides.code === undefined
            ? {
                widget_site_id: SITE_ID,
                created_by: 'user_clerk_1',
                expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
                consumed_at: null,
              }
            : overrides.code,
          error: null,
        };
      case 'widget_sites:select':
        return { data: { id: SITE_ID, embed_key: EMBED_KEY }, error: null };
      case 'woo_site_connections:select':
        return { data: overrides.connection ?? null, error: null };
      case 'woo_pairing_codes:update':
        return {
          data: overrides.consumed === undefined ? { widget_site_id: SITE_ID } : overrides.consumed,
          error: null,
        };
      default:
        return { data: null, error: null };
    }
  });
}

beforeEach(() => {
  mocks.calls.length = 0;
  mocks.limit.mockReset().mockResolvedValue({ success: true, reset: Date.now() + 10_000 });
  mocks.handle.mockReset();
  mocks.connectedEmail.mockReset();
  mocks.adoptName.mockReset();
  process.env.GRINDCTRL_CAPABILITY_SECRET = CORE;
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  database();
});

afterEach(() => {
  delete process.env.GRINDCTRL_CAPABILITY_SECRET;
  vi.restoreAllMocks();
});

describe('POST /api/woo/pair', () => {
  it('stores the REST root the plugin reports, and still pairs when it is unusable or cannot be saved', async () => {
    await post({ ...BODY, restUrl: 'https://shop.example.com/?rest_route=/' });
    expect(find('woo_site_connections', 'update')!.payload).toEqual({ rest_base_url: 'https://shop.example.com/?rest_route=/' });

    mocks.calls.length = 0;
    await post({ ...BODY, restUrl: 'https://evil.example.net/wp-json/' });
    expect(find('woo_site_connections', 'update')!.payload).toEqual({ rest_base_url: null });

    // Column not migrated yet: the write fails, the pairing still succeeds.
    database({ fail: 'woo_site_connections:update' });
    expect((await post({ ...BODY, restUrl: 'https://shop.example.com/wp-json/' })).status).toBe(200);
  });

  it('pairs a store: consumes the code once, records the connection and tenant, returns the secret', async () => {
    const response = await post();
    const secret = deriveWooSiteSecret(SITE_ID, 1);

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({
      siteId: SITE_ID,
      embedKey: EMBED_KEY,
      secret,
      secretVersion: 1,
      minPluginVersion: '0.4.0',
    });

    // The plaintext code never reaches the database, only its hash.
    const lookup = calls()[0];
    expect(lookup).toMatchObject({ table: 'woo_pairing_codes', op: 'select' });
    expect(lookup.filters).toContainEqual(['eq', 'code_hash', CODE_HASH]);
    expect(JSON.stringify(calls())).not.toContain(CODE);

    // One guarded update makes concurrent attempts mutually exclusive.
    const consume = find('woo_pairing_codes', 'update')!;
    expect(consume.filters).toEqual(expect.arrayContaining([
      ['eq', 'code_hash', CODE_HASH],
      ['is', 'consumed_at', null],
      ['gt', 'expires_at', expect.any(String)],
    ]));

    expect(find('woo_site_connections', 'upsert')!.payload).toMatchObject({
      widget_site_id: SITE_ID,
      platform: 'woocommerce',
      status: 'active',
      secret_version: 1,
      home_url: 'https://shop.example.com',
      last_home_url: 'https://shop.example.com',
      plugin_version: '0.2.0',
      paired_by: 'user_clerk_1',
      disconnected_at: null,
      redact_after: null,
      redacted_at: null,
    });
    expect(find('tryon_shops', 'upsert')!.payload).toMatchObject({
      shop_domain: `site:${SITE_ID}`,
      platform: 'woocommerce',
      widget_site_id: SITE_ID,
      status: 'installed',
      uninstalled_at: null,
    });
    expect(find('tryon_shops', 'upsert')!.options).toEqual({ onConflict: 'shop_domain' });
    // Live now: the owner hears so (the sender keeps it to once per store).
    expect(mocks.connectedEmail).toHaveBeenCalledExactlyOnceWith(SITE_ID, { path: 'woocommerce', host: 'shop.example.com' });
    expect(mocks.adoptName).toHaveBeenCalledExactlyOnceWith(SITE_ID, 'https://shop.example.com');
  });

  it('accepts the two-part versions WordPress reports', async () => {
    expect((await post({ ...BODY, wpVersion: '6.8', pluginVersion: '0.2.0' })).status).toBe(200);
  });

  it('accepts a WordPress-only site without WooCommerce details', async () => {
    const response = await post({ ...BODY, platform: 'wordpress', wcVersion: null, currency: null });
    expect(response.status).toBe(200);
    expect(find('tryon_shops', 'upsert')!.payload).toMatchObject({ platform: 'wordpress' });
  });

  it('keeps the current secret version when a site pairs again', async () => {
    database({ connection: { secret_version: 3 } });
    const response = await post();
    const body = await response.json();

    expect(body.secretVersion).toBe(3);
    expect(body.secret).toBe(deriveWooSiteSecret(SITE_ID, 3));
    expect(find('woo_site_connections', 'upsert')!.payload).toMatchObject({ secret_version: 3 });
  });

  it('refuses an unknown code without consuming or writing anything', async () => {
    database({ code: null });
    const response = await post();

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_code' });
    expect(find('woo_pairing_codes', 'update')).toBeUndefined();
    expect(find('woo_site_connections', 'upsert')).toBeUndefined();
    expect(mocks.connectedEmail).not.toHaveBeenCalled();
    expect(mocks.adoptName).not.toHaveBeenCalled();
  });

  it('refuses a code that was already used', async () => {
    database({ code: {
      widget_site_id: SITE_ID,
      created_by: 'user_clerk_1',
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      consumed_at: new Date().toISOString(),
    } });
    const response = await post();

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_code' });
    expect(find('woo_pairing_codes', 'update')).toBeUndefined();
  });

  it('refuses an expired code', async () => {
    database({ code: {
      widget_site_id: SITE_ID,
      created_by: 'user_clerk_1',
      expires_at: new Date(Date.now() - 1_000).toISOString(),
      consumed_at: null,
    } });
    const response = await post();

    expect(response.status).toBe(410);
    expect(await response.json()).toEqual({ error: 'expired_code' });
    expect(find('woo_pairing_codes', 'update')).toBeUndefined();
  });

  it('loses a race for the code: the guarded update matches nothing, so nothing is paired', async () => {
    database({ consumed: null });
    const response = await post();

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_code' });
    expect(find('woo_site_connections', 'upsert')).toBeUndefined();
    expect(find('tryon_shops', 'upsert')).toBeUndefined();
  });

  it.each([
    ['a malformed code', { ...BODY, code: 'not a code' }, 'invalid_code'],
    ['an http home URL', { ...BODY, homeUrl: 'http://shop.example.com' }, 'invalid_request'],
    ['a home URL with credentials', { ...BODY, homeUrl: 'https://user:pw@shop.example.com' }, 'invalid_request'],
    ['a missing plugin version', { ...BODY, pluginVersion: undefined }, 'invalid_request'],
    ['a non-version WordPress version', { ...BODY, wpVersion: 'latest' }, 'invalid_request'],
    ['WooCommerce without its version', { ...BODY, wcVersion: null }, 'invalid_request'],
    ['an unknown platform', { ...BODY, platform: 'shopify' }, 'invalid_request'],
    ['a long timezone', { ...BODY, timezone: 'x'.repeat(200) }, 'invalid_request'],
    ['a currency that is not three letters', { ...BODY, currency: 'EGPP' }, 'invalid_request'],
    ['a body that is not an object', [BODY], 'invalid_request'],
  ])('rejects %s before touching the database', async (_label, body, error) => {
    const response = await post(body);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error });
    expect(calls()).toHaveLength(0);
  });

  it('rejects a body that is not JSON or is too large', async () => {
    expect((await post('{not json')).status).toBe(400);
    expect((await post('x'.repeat(20 * 1024))).status).toBe(413);
    expect(calls()).toHaveLength(0);
  });

  it('rate limits per client address and denies when enforcement is unavailable', async () => {
    mocks.limit.mockResolvedValue({ success: false, reset: Date.now() + 5_000 });
    const limited = await post();
    expect(limited.status).toBe(429);
    expect(await limited.json()).toMatchObject({ error: 'rate_limited' });
    expect(mocks.limit).toHaveBeenCalledWith('woo-pair:203.0.113.9');

    mocks.limit.mockRejectedValue(new Error('redis down'));
    const unavailable = await post();
    expect(unavailable.status).toBe(503);
    expect(await unavailable.json()).toMatchObject({ error: 'unavailable' });
    expect(calls()).toHaveLength(0);
  });

  it('fails closed when the core secret is not configured, without burning the code', async () => {
    delete process.env.GRINDCTRL_CAPABILITY_SECRET;
    const response = await post();

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'unavailable' });
    expect(find('woo_pairing_codes', 'update')).toBeUndefined();
  });

  it.each(['woo_pairing_codes:select', 'woo_site_connections:select', 'woo_pairing_codes:update', 'woo_site_connections:upsert', 'tryon_shops:upsert'])(
    'answers unavailable without database detail or secret when %s fails',
    async (failing) => {
      database({ fail: failing });
      const response = await post();
      const text = await response.text();

      expect(response.status).toBe(503);
      expect(JSON.parse(text)).toEqual({ error: 'unavailable' });
      expect(text).not.toContain('secret-db-detail');
      expect(text).not.toContain(deriveWooSiteSecret(SITE_ID, 1)!);
    },
  );

  it('never logs the secret, the code or the core key', async () => {
    await post();
    database({ fail: 'tryon_shops:upsert' });
    await post();

    const logged = JSON.stringify([
      ...vi.mocked(console.error).mock.calls,
      ...vi.mocked(console.warn).mock.calls,
      ...vi.mocked(console.log).mock.calls,
    ]);
    expect(logged).not.toContain(deriveWooSiteSecret(SITE_ID, 1)!);
    expect(logged).not.toContain(CODE);
    expect(logged).not.toContain(CORE);
  });
});
