// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ connection: vi.fn(), domains: vi.fn(), plan: vi.fn(), launch: vi.fn(), flags: vi.fn() }));
vi.mock('@/lib/paste/store', () => ({ getPasteConnection: m.connection, listPasteDomains: m.domains }));
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
  it('resolves only opted-in paste sites to site tenants, preserving plain own-website behavior', () => {
    const sites = [{ id: SITE, domain: 'merchant.example', paste: true }];
    expect(resolveActiveStore({ shops: [], sites }, [{ site: SITE }])).toMatchObject({ tenantKey: `site:${SITE}`, shopDomain: null, platform: 'paste' });
    expect(resolveActiveStore({ shops: [], sites: [{ ...sites[0], paste: false }] }, [{ site: SITE }])).toMatchObject({ tenantKey: null, platform: null });
  });
});
