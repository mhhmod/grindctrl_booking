// @vitest-environment node
import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/messenger/db', () => ({ getMessengerServiceClient: vi.fn() }));

import { deriveWooSiteSecret } from './site-secret';
import { wooSignatureCanonicalString } from './signed-request';
import { callWooPlugin, pluginUrl, setWooPluginTransportForTests, WOO_PLUGIN_ORDER_LOOKUP_PATH } from './plugin-client';

const SITE = '123e4567-e89b-12d3-a456-426614174000';
const CORE = 'test-only-independent-core-signing-key-2026';
const connection = { siteId: SITE, homeUrl: 'https://shop.example.com/', secretVersion: 2, pluginVersion: '0.3.0' };

beforeEach(() => {
  process.env.GRINDCTRL_CAPABILITY_SECRET = CORE;
});
afterEach(() => {
  delete process.env.GRINDCTRL_CAPABILITY_SECRET;
});

describe('callWooPlugin', () => {
  it('signs the exact body and path the plugin will verify', async () => {
    const transport = vi.fn(async () => ({ status: 200, contentType: 'application/json; charset=UTF-8', body: '{"ok":true,"orders":[]}' }));
    const restore = setWooPluginTransportForTests(transport);
    const result = await callWooPlugin(connection, WOO_PLUGIN_ORDER_LOOKUP_PATH, { mode: 'guest', email: 'a@b.co', orderNumber: '1027' });
    restore();

    expect(result).toEqual({ ok: true, json: { ok: true, orders: [] } });
    const call = (transport.mock.calls[0] as unknown as [{ url: URL; headers: Record<string, string>; body: string }])[0];
    expect(call.url.toString()).toBe('https://shop.example.com/wp-json/grindctrl/v1/order-lookup');
    const secret = deriveWooSiteSecret(SITE, 2)!;
    const canonical = wooSignatureCanonicalString({
      method: 'POST',
      path: '/wp-json/grindctrl/v1/order-lookup',
      timestamp: call.headers['X-GC-Timestamp'],
      nonce: call.headers['X-GC-Nonce'],
      body: call.body,
    });
    expect(call.headers['X-GC-Signature']).toBe(createHmac('sha256', secret).update(canonical, 'utf8').digest('base64url'));
    expect(call.headers['X-GC-Site']).toBe(SITE);
    expect(JSON.parse(call.body)).toEqual({ mode: 'guest', email: 'a@b.co', orderNumber: '1027' });
  });

  it('keeps a subdirectory install in the signed path', async () => {
    const transport = vi.fn(async () => ({ status: 200, contentType: 'application/json', body: '{}' }));
    const restore = setWooPluginTransportForTests(transport);
    await callWooPlugin({ ...connection, homeUrl: 'https://example.com/store/' }, WOO_PLUGIN_ORDER_LOOKUP_PATH, {});
    restore();
    expect((transport.mock.calls[0] as unknown as [{ url: URL }])[0].url.pathname).toBe('/store/wp-json/grindctrl/v1/order-lookup');
  });

  it('uses the stored plain-permalink REST root and still signs the fixed route path', async () => {
    const transport = vi.fn(async () => ({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
    const restore = setWooPluginTransportForTests(transport);
    await callWooPlugin({ ...connection, restBaseUrl: 'https://shop.example.com/?rest_route=/' }, WOO_PLUGIN_ORDER_LOOKUP_PATH, {});
    await callWooPlugin({ ...connection, homeUrl: 'https://example.com/store/', restBaseUrl: 'https://example.com/store/?rest_route=/' }, WOO_PLUGIN_ORDER_LOOKUP_PATH, {});
    restore();
    const [plain, nested] = transport.mock.calls.map((call) => (call as unknown as [{ url: URL; headers: Record<string, string>; body: string }])[0]);
    expect(plain.url.origin + plain.url.pathname).toBe('https://shop.example.com/');
    expect(plain.url.searchParams.get('rest_route')).toBe('/grindctrl/v1/order-lookup');
    expect(nested.url.pathname).toBe('/store/');
    const secret = deriveWooSiteSecret(SITE, 2)!;
    for (const [call, signedPath] of [[plain, '/wp-json/grindctrl/v1/order-lookup'], [nested, '/store/wp-json/grindctrl/v1/order-lookup']] as const) {
      const canonical = wooSignatureCanonicalString({ method: 'POST', path: signedPath, timestamp: call.headers['X-GC-Timestamp'], nonce: call.headers['X-GC-Nonce'], body: call.body });
      expect(call.headers['X-GC-Signature']).toBe(createHmac('sha256', secret).update(canonical, 'utf8').digest('base64url'));
    }
  });

  it.each([
    'https://other.example.net/wp-json/',
    'https://shop.example.com/wp-json',
    'https://shop.example.com/?rest_route=/other',
    'https://shop.example.com/?rest_route=/&a=b',
    'http://shop.example.com/wp-json/',
  ])('refuses a stored REST root that leaves the paired site: %s', async (restBaseUrl) => {
    const transport = vi.fn();
    const restore = setWooPluginTransportForTests(transport);
    expect(await callWooPlugin({ ...connection, restBaseUrl }, WOO_PLUGIN_ORDER_LOOKUP_PATH, {})).toEqual({ ok: false, reason: 'unavailable' });
    restore();
    expect(transport).not.toHaveBeenCalled();
  });

  it.each([
    ['network failure', null, 'unavailable'],
    ['plugin 401', { status: 401, contentType: 'application/json', body: '{}' }, 'rejected'],
    ['plugin 500', { status: 500, contentType: 'application/json', body: '{}' }, 'unavailable'],
    ['redirect', { status: 302, contentType: 'text/html', body: '' }, 'unavailable'],
    ['html 200', { status: 200, contentType: 'text/html', body: '<html>' }, 'unavailable'],
    ['bad json', { status: 200, contentType: 'application/json', body: '{nope' }, 'unavailable'],
  ])('fails closed on %s', async (_name, response, reason) => {
    const restore = setWooPluginTransportForTests(async () => response);
    const result = await callWooPlugin(connection, WOO_PLUGIN_ORDER_LOOKUP_PATH, {});
    restore();
    expect(result).toEqual({ ok: false, reason });
  });

  it('never calls a host other than the paired https home, or a path outside the allowlist', async () => {
    const transport = vi.fn();
    const restore = setWooPluginTransportForTests(transport);
    for (const homeUrl of ['http://shop.example.com', 'https://169.254.169.254', 'https://u:p@shop.example.com']) {
      expect(await callWooPlugin({ ...connection, homeUrl }, WOO_PLUGIN_ORDER_LOOKUP_PATH, {})).toEqual({ ok: false, reason: 'unavailable' });
    }
    expect(await callWooPlugin(connection, '/wp-json/wp/v2/users', {})).toEqual({ ok: false, reason: 'unavailable' });
    restore();
    expect(transport).not.toHaveBeenCalled();
    expect(pluginUrl('https://shop.example.com', '/etc/passwd')).toBeNull();
  });

  it('fails closed when the site secret cannot be derived', async () => {
    delete process.env.GRINDCTRL_CAPABILITY_SECRET;
    const transport = vi.fn();
    const restore = setWooPluginTransportForTests(transport);
    expect(await callWooPlugin(connection, WOO_PLUGIN_ORDER_LOOKUP_PATH, {})).toEqual({ ok: false, reason: 'unavailable' });
    restore();
    expect(transport).not.toHaveBeenCalled();
  });
});
