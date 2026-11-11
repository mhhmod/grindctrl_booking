// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ day: vi.fn(), entitlement: vi.fn() }));
vi.mock('@/lib/try-on/daily-budget', () => ({ tryOnDayAvailability: m.day }));
vi.mock('@/lib/try-on/entitlement', () => ({ getShopEntitlement: m.entitlement }));
vi.mock('@/lib/try-on/settings', () => ({ readTryOnShowButton: async () => true, getTryOnSettings: async () => ({}), getTryOnSettingsForEdit: async () => ({}) }));
vi.mock('@/lib/flags/store-flags', () => ({ storeFlags: async () => [] }));
vi.mock('@/lib/try-on/merchant-copy', () => ({ pickMerchantCopy: () => ({}) }));
vi.mock('./garment-url', () => ({ verifiedSiteHosts: async () => ['shop.example'] }));
import { readSiteLaunch } from './tryon-site';
import { buildSiteTryOnConfig } from './tryon-config';
import { clearProxyConfigCache } from '@/lib/shopify/proxy-config-cache';
const site = '123e4567-e89b-42d3-a456-426614174000';
beforeEach(() => { clearProxyConfigCache(); m.day.mockReset().mockResolvedValue('live'); m.entitlement.mockReset().mockResolvedValue({ available: true, status: 'active', totalCreditsRemaining: 3 }); });
it.each(['active', 'none'])('hides a site at the daily cap, including a %s free-plan bootstrap', async status => {
 m.entitlement.mockResolvedValue({ available: status === 'active', status, totalCreditsRemaining: 3 }); m.day.mockResolvedValue('daily_limit');
 expect(await readSiteLaunch(site)).toMatchObject({ launch: { tryOn: 'hidden', reason: 'daily_limit' }, unsubscribed: false });
 expect(await buildSiteTryOnConfig(site, 'en')).toMatchObject({ enabled: false, reason: 'daily_limit' });
});
it('rechecks cached site availability across processes and resumes next UTC day', async () => {
 expect(await buildSiteTryOnConfig(site, 'en')).toMatchObject({ enabled: true });
 m.day.mockResolvedValue('daily_limit'); expect(await buildSiteTryOnConfig(site, 'en')).toMatchObject({ enabled: false, reason: 'daily_limit' });
 m.day.mockResolvedValue('live'); expect(await buildSiteTryOnConfig(site, 'en')).toMatchObject({ enabled: true });
});
