// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ connection: vi.fn(), domains: vi.fn(), plan: vi.fn(), launch: vi.fn(), flags: vi.fn() }));
vi.mock('@/lib/paste/store', async (original) => {
  const actual = await original<typeof import('@/lib/paste/store')>();
  return { pasteShopHost: actual.pasteShopHost, pasteTrust: actual.pasteTrust, getPasteConnection: m.connection, listPasteDomains: m.domains };
});
const PROVEN_AT = '2026-11-08T13:00:00.000Z';
vi.mock('@/lib/try-on/entitlement', () => ({ getShopEntitlement: m.plan }));
vi.mock('@/lib/launch/store-launch', () => ({ getStoreLaunch: m.launch }));
vi.mock('@/lib/flags/store-flags', () => ({ storeFlags: m.flags }));
import { readPasteInstallStatus } from '@/lib/paste/status';
import { resolveActiveStore } from './active-store';
const SITE = '11111111-1111-4111-8111-111111111111';
const NOW = new Date('2026-11-08T15:00:00Z');
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv('GRINDCTRL_CAPABILITY_SECRET', 'test-only-independent-core-secret-32-bytes-long');
  vi.stubEnv('TURNSTILE_SECRET_KEY', '1x0000000000000000000000000000000AA');
  vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', '1x00000000000000000000AA');
  m.connection.mockResolvedValue({ status: 'active', platform: 'website', secret_version: 2 });
  m.domains.mockResolvedValue([{ id: 'domain-a', domain: 'merchant.example', state: 'trusted', firstSeenAt: null, lastSeenAt: null }]);
  m.plan.mockResolvedValue({ status: 'active', available: true, totalCreditsRemaining: 5 });
  m.launch.mockResolvedValue(null); m.flags.mockResolvedValue([]);
});
afterEach(() => vi.unstubAllEnvs());
describe('paste read model and dashboard tenant', () => {
  it('does not call typing a domain a live chat install', async () => {
    const result = await readPasteInstallStatus({ id: SITE, status: 'active' }, NOW);
    expect(result).toMatchObject({ chatLive: false, tryOnReady: true, tenantKey: `site:${SITE}`, mode: 'live' });
    expect(JSON.stringify(result)).not.toContain('hmac_sha256');
    expect(m.plan).toHaveBeenCalledWith(`site:${SITE}`);
  });
  it('uses the existing thirty-minute heartbeat window', async () => {
    m.domains.mockResolvedValue([{ state: 'trusted', firstSeenAt: NOW.toISOString(), lastSeenAt: NOW.toISOString() }]);
    expect((await readPasteInstallStatus({ id: SITE, status: 'active' }, NOW)).chatLive).toBe(true);
    expect((await readPasteInstallStatus({ id: SITE, status: 'active' }, new Date(NOW.getTime() + 30 * 60 * 1000 + 1))).chatLive).toBe(false);
  });
  it('reports no trusted domain, inactive plan and disabled site honestly', async () => {
    m.domains.mockResolvedValue([{ state: 'claimed' }]);
    expect(await readPasteInstallStatus({ id: SITE, status: 'active' }, NOW)).toMatchObject({ tryOnReady: false, tryOnReason: 'no_trusted_domain' });
    m.domains.mockResolvedValue([{ state: 'trusted' }]); m.plan.mockResolvedValue({ status: 'none', available: false, totalCreditsRemaining: 0 });
    expect((await readPasteInstallStatus({ id: SITE, status: 'active' }, NOW)).tryOnReason).toBe('plan_inactive');
    expect((await readPasteInstallStatus({ id: SITE, status: 'disabled' }, NOW)).tryOnReason).toBe('site_disabled');
  });
  it('carries preview/live state without changing or granting a plan', async () => {
    m.flags.mockResolvedValue(['n5_preview_mode']); m.launch.mockResolvedValue({ state: 'preview', salt: 'salt' });
    expect((await readPasteInstallStatus({ id: SITE, status: 'active' }, NOW)).mode).toBe('preview');
    expect(m.plan).toHaveBeenCalledTimes(1);
  });
  it('reports the code as seen in setup/preview while chat stays not live for shoppers', async () => {
    m.flags.mockResolvedValue(['n5_preview_mode']); m.launch.mockResolvedValue({ state: 'preview', salt: 'salt' });
    m.domains.mockResolvedValue([{ id: 'a', domain: 'merchant.example', state: 'trusted', firstSeenAt: NOW.toISOString(), lastSeenAt: NOW.toISOString() }]);
    expect(await readPasteInstallStatus({ id: SITE, status: 'active' }, NOW))
      .toMatchObject({ seen: true, seenHost: 'merchant.example', chatLive: false, mode: 'preview' });
    m.launch.mockResolvedValue({ state: 'live', salt: 'salt' });
    expect(await readPasteInstallStatus({ id: SITE, status: 'active' }, NOW)).toMatchObject({ seen: true, chatLive: true });
  });
  it('is not seen outside the window, on an untrusted row, or when disconnected', async () => {
    const old = new Date(NOW.getTime() - 30 * 60 * 1000 - 1).toISOString();
    m.domains.mockResolvedValue([{ id: 'a', domain: 'merchant.example', state: 'trusted', firstSeenAt: old, lastSeenAt: old },
      { id: 'b', domain: 'claimed.example', state: 'claimed', firstSeenAt: NOW.toISOString(), lastSeenAt: NOW.toISOString() }]);
    expect(await readPasteInstallStatus({ id: SITE, status: 'active' }, NOW)).toMatchObject({ seen: false, seenHost: null, chatLive: false });
    m.domains.mockResolvedValue([{ id: 'a', domain: 'merchant.example', state: 'trusted', lastSeenAt: NOW.toISOString() }]);
    m.connection.mockResolvedValue({ status: 'disconnected', platform: 'website', secret_version: 2 });
    expect(await readPasteInstallStatus({ id: SITE, status: 'active' }, NOW)).toMatchObject({ seen: false, seenHost: null });
  });
  it('counts a Shopify store that only uses its .myshopify.com address as installed and Try-On ready', async () => {
    const shop = { widget_site_id: SITE, status: 'active', platform: 'shopify', shop_domain: 'merchant.myshopify.com', secret_version: 1,
      first_seen_at: '2026-11-08T14:00:00.000Z', last_seen_at: '2026-11-08T14:55:00.000Z', shop_proven_at: PROVEN_AT, app_installed: false };
    m.connection.mockResolvedValue(shop); m.domains.mockResolvedValue([]);
    expect(await readPasteInstallStatus({ id: SITE, status: 'active' }, NOW)).toMatchObject({
      shopProof: 'proven', shopProvenAt: PROVEN_AT, trusted: true, connectionReason: null,
      shopDomain: 'merchant.myshopify.com', shopFirstSeenAt: shop.first_seen_at, shopLastSeenAt: shop.last_seen_at,
      seen: true, seenHost: 'merchant.myshopify.com', chatLive: true, tryOnReady: true, tryOnReason: null,
    });
    m.connection.mockResolvedValue({ ...shop, first_seen_at: null, last_seen_at: null });
    expect(await readPasteInstallStatus({ id: SITE, status: 'active' }, NOW)).toMatchObject({ seen: false, chatLive: false, tryOnReady: true });
  });
  it('names the most recently seen host among the shop and trusted domains', async () => {
    m.connection.mockResolvedValue({ widget_site_id: SITE, status: 'active', platform: 'shopify', shop_domain: 'merchant.myshopify.com',
      secret_version: 1, first_seen_at: '2026-11-08T14:50:00.000Z', last_seen_at: '2026-11-08T14:50:00.000Z', shop_proven_at: PROVEN_AT, app_installed: false });
    m.domains.mockResolvedValue([{ id: 'a', domain: 'merchant.example', state: 'trusted', lastSeenAt: '2026-11-08T14:58:00.000Z' }]);
    expect((await readPasteInstallStatus({ id: SITE, status: 'active' }, NOW)).seenHost).toBe('merchant.example');
    m.domains.mockResolvedValue([{ id: 'a', domain: 'merchant.example', state: 'trusted', lastSeenAt: '2026-11-08T14:40:00.000Z' }]);
    expect((await readPasteInstallStatus({ id: SITE, status: 'active' }, NOW)).seenHost).toBe('merchant.myshopify.com');
  });
  it('says a Shopify shop is waiting for its code until a signed render proves it', async () => {
    const pending = { widget_site_id: SITE, status: 'pending', platform: 'shopify', shop_domain: 'merchant.myshopify.com', secret_version: 1,
      first_seen_at: null, last_seen_at: null, shop_proven_at: null, app_installed: false };
    m.connection.mockResolvedValue(pending);
    m.domains.mockResolvedValue([{ id: 'a', domain: 'merchant.example', state: 'trusted', lastSeenAt: NOW.toISOString() }]);
    expect(await readPasteInstallStatus({ id: SITE, status: 'active' }, NOW)).toMatchObject({
      connected: true, trusted: false, connectionReason: 'shop_proof_pending', shopProof: 'pending', shopProvenAt: null,
      seen: false, seenHost: null, chatLive: false, tryOnReady: false, tryOnReason: 'shop_proof_pending',
    });
  });
  it('hands the shop to the Shopify app at read time, and names a displaced claim', async () => {
    const shop = { widget_site_id: SITE, status: 'active', platform: 'shopify', shop_domain: 'merchant.myshopify.com', secret_version: 1,
      first_seen_at: NOW.toISOString(), last_seen_at: NOW.toISOString(), shop_proven_at: PROVEN_AT, app_installed: true };
    m.connection.mockResolvedValue(shop); m.domains.mockResolvedValue([]);
    expect(await readPasteInstallStatus({ id: SITE, status: 'active' }, NOW)).toMatchObject({
      trusted: false, connectionReason: 'shopify_app_installed', tryOnReason: 'shopify_app_installed', seen: false, chatLive: false,
      shopLastSeenAt: null,
    });
    m.connection.mockResolvedValue({ ...shop, status: 'disconnected', app_installed: false, disconnected_reason: 'displaced' });
    expect(await readPasteInstallStatus({ id: SITE, status: 'active' }, NOW)).toMatchObject({
      connected: false, trusted: false, shopProof: null, connectionReason: 'shop_proven_elsewhere', tryOnReason: 'shop_proven_elsewhere',
    });
  });
  it('treats Turnstile as configured from the runtime site key', async () => {
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', '');
    expect((await readPasteInstallStatus({ id: SITE, status: 'active' }, NOW)).turnstileConfigured).toBe(false);
    vi.stubEnv('TURNSTILE_SITE_KEY', '0x4RUNTIME0000000000000');
    expect((await readPasteInstallStatus({ id: SITE, status: 'active' }, NOW)).turnstileConfigured).toBe(true);
  });
  it('never exposes shop signal times for a website connection', async () => {
    m.connection.mockResolvedValue({ status: 'active', platform: 'website', shop_domain: null, secret_version: 1, first_seen_at: NOW.toISOString(), last_seen_at: NOW.toISOString() });
    m.domains.mockResolvedValue([]);
    expect(await readPasteInstallStatus({ id: SITE, status: 'active' }, NOW))
      .toMatchObject({ shopFirstSeenAt: null, shopLastSeenAt: null, seen: false, tryOnReason: 'no_trusted_domain' });
  });
  it('resolves only opted-in paste sites to site tenants, preserving plain own-website behavior', () => {
    const sites = [{ id: SITE, domain: 'merchant.example', paste: true }];
    expect(resolveActiveStore({ shops: [], sites }, [{ site: SITE }])).toMatchObject({ tenantKey: `site:${SITE}`, shopDomain: null, platform: 'paste' });
    expect(resolveActiveStore({ shops: [], sites: [{ ...sites[0], paste: false }] }, [{ site: SITE }])).toMatchObject({ tenantKey: null, platform: null });
  });
});
