// @vitest-environment node
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ network: vi.fn(), siteLimit: vi.fn(), site: vi.fn(), connection: vi.fn(), active: vi.fn(),
  config: vi.fn(), storeLaunch: vi.fn() }));
vi.mock('@/lib/ratelimit', () => ({ clientIp: () => '203.0.113.5', publicApiRatelimit: { limit: m.network },
  proxyShopReadRatelimit: { limit: m.siteLimit } }));
vi.mock('@/lib/woo/tryon-site', () => ({ siteByEmbedKey: m.site }));
vi.mock('@/lib/paste/store', async (original) => ({ pasteTrust: (await original<typeof import('@/lib/paste/store')>()).pasteTrust,
  getPasteConnection: m.connection }));
vi.mock('@/lib/shopify/tokens', () => ({ isActiveTenant: m.active }));
vi.mock('@/lib/woo/tryon-config', () => ({ buildSiteTryOnConfig: m.config, siteConfigLocale: (v: unknown) => v === 'ar' ? 'ar' : 'en' }));
vi.mock('@/lib/launch/store-launch', () => ({ getStoreLaunch: m.storeLaunch }));

import { StorefrontConfigCache } from '@/lib/storefront-config-cache';
import { GET, OPTIONS } from './route';
import { signPreviewToken } from '@/lib/launch/preview-token';
import { PasteError } from '@/lib/paste/types';

const SITE = '11111111-1111-4111-8111-111111111111';
const CORE = 'test-only-independent-core-signing-secret-for-paste';
const proven = { widget_site_id: SITE, platform: 'shopify', shop_domain: 'merchant.myshopify.com', status: 'active', secret_version: 1,
  shop_proven_at: '2026-11-08T00:00:00.000Z', app_installed: false };
const config = { enabled: true, reason: null, locale: 'ar', showCardPill: true, catalogLabel: 'جرّب', catalogIconPx: 14, catalogFontPx: 12,
  catalogPadPx: 6, accentBg: '#2a2826', accentFg: '#f0ede9', radiusPx: 999, buttonLabel: 'جرّبها الآن', iconBgFrom: '#ff9a3d',
  iconBgTo: '#ffd76e', buttonIconPx: 30, widgetTheme: 'light', features: [] };
const get = (query = 'key=gc_public_key_42&locale=ar&vid=visitor_abcdefghijklmnop') =>
  GET(new NextRequest(`https://grindctrl.cloud/api/try-on/paste-config?${query}`));

beforeEach(() => {
  StorefrontConfigCache.clearAll();
  vi.resetAllMocks(); vi.stubEnv('GRINDCTRL_CAPABILITY_SECRET', CORE);
  m.network.mockResolvedValue({ success: true, reset: Date.now() + 1000 });
  m.siteLimit.mockResolvedValue({ success: true, reset: Date.now() + 1000 });
  m.site.mockResolvedValue({ id: SITE, status: 'active' }); m.connection.mockResolvedValue(proven); m.active.mockResolvedValue(true);
  m.config.mockResolvedValue(config); m.storeLaunch.mockResolvedValue(null);
});
afterEach(() => vi.unstubAllEnvs());

describe('GET /api/try-on/paste-config', () => {
  it('profiles independent config reads without a network', async () => {
    const delayed = <T,>(value: T, ms: number) => new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));
    m.site.mockImplementation(() => delayed({ id: SITE, status: 'active' }, 100));
    m.connection.mockImplementation(() => delayed(proven, 100));
    m.active.mockImplementation(() => delayed(true, 100));
    m.config.mockImplementation(() => delayed({ ...config, features: ['n5_preview_mode'] }, 400));
    m.storeLaunch.mockImplementation(() => delayed(null, 100));
    let coldMs = 0;
    {
      const start = performance.now();
      const response = GET(new NextRequest('https://app.example/api/try-on/paste-config?key=gc_test_key'));
      expect((await response).status).toBe(200);
      coldMs = performance.now() - start;
    }
    const hitStart = performance.now();
    const hit = GET(new NextRequest('https://app.example/api/try-on/paste-config?key=gc_test_key'));
    expect((await hit).status).toBe(200);
    const hitMs = performance.now() - hitStart;
    expect(m.config).toHaveBeenCalledTimes(1);
    process.stdout.write(JSON.stringify({ route: 'paste-config', uncachedMs: Math.round(coldMs), cachedMs: Math.round(hitMs) }) + '\n');
  });
  it('answers live with the card pill switch and only the pill and button styling, CORS-open and briefly cacheable', async () => {
    const response = await get();
    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ tryOn: 'live', reason: null, showCardPill: true, locale: 'ar', catalogLabel: 'جرّب',
      catalogIconPx: 14, catalogFontPx: 12, catalogPadPx: 6, accentBg: '#2a2826', accentFg: '#f0ede9', radiusPx: 999,
      buttonLabel: 'جرّبها الآن', iconBgFrom: '#ff9a3d', iconBgTo: '#ffd76e', buttonIconPx: 30 });
    // The config paste-context returns as its settings, for the request's locale.
    expect(m.config).toHaveBeenCalledWith(SITE, 'ar', expect.objectContaining({ fresh: true }));
    expect(m.siteLimit).toHaveBeenCalledWith(`paste-config:${SITE}`);
  });

  it("returns the button label resolved for the request's locale", async () => {
    m.config.mockImplementation(async (_site: string, locale: string) => ({ ...config, locale, buttonLabel: locale === 'ar' ? 'جرّبها الآن' : 'Try it now' }));
    expect(await (await get('key=gc_public_key_42&locale=en')).json()).toMatchObject({ locale: 'en', buttonLabel: 'Try it now' });
    expect(await (await get('key=gc_public_key_42&locale=ar')).json()).toMatchObject({ locale: 'ar', buttonLabel: 'جرّبها الآن' });
  });

  it('carries the card pill switch, and the main switch off hides the pills with Try-On', async () => {
    m.config.mockResolvedValue({ ...config, showCardPill: false });
    expect(await (await get()).json()).toMatchObject({ tryOn: 'live', showCardPill: false });
    StorefrontConfigCache.clearAll();
    m.config.mockResolvedValue({ ...config, enabled: false, reason: 'paused', showCardPill: false });
    expect(await (await get()).json()).toMatchObject({ tryOn: 'hidden', reason: 'paused', showCardPill: false });
    // Even a stale cached answer saying pills are on cannot show them while Try-On is hidden.
    m.config.mockResolvedValue({ ...config, enabled: false, reason: 'out_of_looks', showCardPill: true });
    expect(await (await get()).json()).toMatchObject({ tryOn: 'hidden', reason: 'out_of_looks', showCardPill: false });
  });

  it.each([
    ['not connected', null, 'paste_not_connected'],
    ['pending its storefront proof', { ...proven, status: 'pending', shop_proven_at: null }, 'shop_proof_pending'],
    ['held by the Shopify app', { ...proven, app_installed: true }, 'shopify_app_installed'],
  ])('hides pills for a store %s, without reading its settings', async (_name, connection, reason) => {
    m.connection.mockResolvedValue(connection);
    expect(await (await get()).json()).toEqual({ tryOn: 'hidden', reason, showCardPill: false });
    expect(m.config).not.toHaveBeenCalled();
  });

  it('hides pills for a disconnected tenant, an unknown key and a failed read', async () => {
    m.active.mockResolvedValue(false);
    expect(await (await get()).json()).toMatchObject({ tryOn: 'hidden', reason: 'site_disconnected' });
    m.site.mockResolvedValue(null);
    expect((await get()).status).toBe(404);
    m.site.mockResolvedValue({ id: SITE, status: 'active' });
    m.connection.mockRejectedValue(new PasteError('unavailable'));
    const failed = await get();
    expect(failed.status).toBe(503);
    expect(failed.headers.get('cache-control')).toBe('no-store');
    expect(await failed.json()).toMatchObject({ tryOn: 'hidden', showCardPill: false });
  });

  it('applies the store launch per visitor: preview hides, the owner\'s preview link shows', async () => {
    m.config.mockResolvedValue({ ...config, features: ['n5_preview_mode'] });
    m.storeLaunch.mockResolvedValue({ state: 'preview', salt: 'salt' });
    expect(await (await get()).json()).toMatchObject({ tryOn: 'hidden', reason: 'preview', showCardPill: false });
    const preview = signPreviewToken(CORE, `site:${SITE}`).token;
    expect(await (await get(`key=gc_public_key_42&locale=en&vid=visitor_abcdefghijklmnop&preview=${preview}`)).json())
      .toMatchObject({ tryOn: 'live', showCardPill: true });
    // The owner's test looks do not spend the store's looks.
    m.config.mockResolvedValue({ ...config, enabled: false, reason: 'out_of_looks', features: ['n5_preview_mode'] });
    expect(await (await get(`key=gc_public_key_42&preview=${preview}`)).json()).toMatchObject({ tryOn: 'live', showCardPill: true });
    expect(await (await get('key=gc_public_key_42')).json()).toMatchObject({ tryOn: 'hidden' });
  });

  it('denies rate-limited traffic before any site read, with CORS so the page can tell', async () => {
    m.network.mockResolvedValue({ success: false, reset: Date.now() + 2000 });
    const response = await get();
    expect(response.status).toBe(429);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    expect(m.site).not.toHaveBeenCalled();
  });

  it('answers a preflight without doing any work', () => {
    expect(OPTIONS().status).toBe(204);
    expect(m.site).not.toHaveBeenCalled();
  });
});

describe('paste config site cache boundaries', () => {
  it('hits, invalidates by settings version and expires within 20 seconds', async () => {
    vi.useFakeTimers();
    try {
      const response = await get();
      expect(response.headers.get('server-timing')).toMatch(/site;dur=[0-9.]+, settings;dur=[0-9.]+, plan;dur=[0-9.]+, flags;dur=[0-9.]+/);
      await get(); expect(m.config).toHaveBeenCalledTimes(1);
      m.site.mockResolvedValue({ id: SITE, status: 'active', settings_version: 2 });
      await get(); expect(m.config).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(20000);
      await get(); expect(m.config).toHaveBeenCalledTimes(3);
      expect(m.network).toHaveBeenCalledTimes(4); expect(m.active).toHaveBeenCalledTimes(4);
    } finally { vi.useRealTimers(); }
  });
  it('does not cache errors or unavailable answers', async () => {
    m.config.mockRejectedValueOnce(new Error('temporary'));
    expect((await get()).status).toBe(503);
    m.config.mockResolvedValueOnce({ ...config, enabled: false, reason: 'unavailable' });
    expect(await (await get()).json()).toMatchObject({ reason: 'unavailable' });
    expect(await (await get()).json()).toMatchObject({ tryOn: 'live' });
    expect(m.config).toHaveBeenCalledTimes(3);
  });
  it('applies preview and trust checks on top of a cached site config', async () => {
    m.config.mockResolvedValue({ ...config, features: ['n5_preview_mode'] });
    m.storeLaunch.mockResolvedValue({ state: 'preview', salt: 'salt' });
    const preview = signPreviewToken(CORE, 'site:' + SITE).token;
    expect(await (await get('key=gc_public_key_42&locale=ar&preview=' + preview)).json()).toMatchObject({ tryOn: 'live' });
    expect(await (await get()).json()).toMatchObject({ tryOn: 'hidden', reason: 'preview' });
    expect(m.config).toHaveBeenCalledTimes(1);
    m.active.mockResolvedValue(false);
    expect(await (await get()).json()).toMatchObject({ reason: 'site_disconnected' });
  });
});

it('assigns holdout by vid on a cache hit without reusing the first visitor answer', async () => {
  const { holdoutBucket } = await import('@/lib/launch/audience');
  const visitors = Array.from({ length: 100 }, (_, i) => 'visitor_abcdefghijkl_' + i);
  const on = visitors.find((id) => holdoutBucket(id, 'salt', 0.5) === 'on')!;
  const off = visitors.find((id) => holdoutBucket(id, 'salt', 0.5) === 'off')!;
  m.config.mockResolvedValue({ ...config, features: ['n5_preview_mode', 'n6_holdout'] });
  m.storeLaunch.mockResolvedValue({ state: 'holdout', holdoutShare: 0.5, holdoutEndsAt: new Date(Date.now() + 86400000).toISOString(), salt: 'salt' });
  expect(await (await get('key=gc_public_key_42&locale=ar&vid=' + on)).json()).toMatchObject({ tryOn: 'live' });
  expect(await (await get('key=gc_public_key_42&locale=ar&vid=' + off)).json()).toMatchObject({ tryOn: 'hidden', reason: 'holdout' });
  expect(m.config).toHaveBeenCalledTimes(1);
});

vi.mock('@/lib/try-on/daily-budget', () => ({ tryOnDayAvailability: vi.fn(async () => 'live'), readTryOnDayStatus: vi.fn(async () => ({ used: 0, limit: 300, reached: false })) }));
import { tryOnDayAvailability, readTryOnDayStatus } from '@/lib/try-on/daily-budget';
beforeEach(() => {
  vi.mocked(tryOnDayAvailability).mockResolvedValue('live');
  vi.mocked(readTryOnDayStatus).mockResolvedValue({ used: 0, limit: 300, reached: false });
});

it('hides button and pills despite a live cached config once the daily ceiling is reached', async () => {
  expect((await (await get()).json()).tryOn).toBe('live');
  vi.mocked(tryOnDayAvailability).mockResolvedValue('daily_limit');
  expect(await (await get()).json()).toMatchObject({ tryOn: 'hidden', reason: 'daily_limit', showCardPill: false });
  vi.mocked(tryOnDayAvailability).mockResolvedValue('live');
  expect((await (await get()).json()).tryOn).toBe('live');
});
