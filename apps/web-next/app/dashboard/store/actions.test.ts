// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), access: vi.fn(), rate: vi.fn(), rpc: vi.fn(), revalidate: vi.fn() }));
vi.mock('@clerk/nextjs/server', () => ({ auth: mocks.auth }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }));
vi.mock('@/lib/messenger/provisioning', () => ({ requireSiteAccess: mocks.access }));
vi.mock('@/lib/request-rate-limit', () => ({ requireMerchantRateLimit: mocks.rate }));
vi.mock('@/lib/messenger/db', () => ({ getMessengerServiceClient: () => ({ rpc: mocks.rpc }) }));
import { setStoreHealthAlertsAction } from './actions';
beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockResolvedValue({ userId: 'owner' }); mocks.access.mockResolvedValue({ id: 'site' }); mocks.rpc.mockResolvedValue({ error: null }); mocks.rate.mockResolvedValue(undefined); });
describe('store health alert settings action', () => {
  it('checks Clerk, tenant settings capability and shared rate limiting before atomic preference write', async () => {
    expect(await setStoreHealthAlertsAction('site', false)).toEqual({ ok: true });
    expect(mocks.access).toHaveBeenCalledWith('owner', 'site', 'settings');
    expect(mocks.rate).toHaveBeenCalledWith('store-health:site', 'write');
    expect(mocks.rpc).toHaveBeenCalledWith('set_store_health_alert_preference', { p_site: 'site', p_enabled: false });
  });
  it('refuses another tenant or member without mutating', async () => {
    mocks.access.mockRejectedValue(new Error('forbidden'));
    expect(await setStoreHealthAlertsAction('other', false)).toEqual({ ok: false }); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('refuses missing auth, invalid booleans and rate failures', async () => {
    mocks.auth.mockResolvedValueOnce({ userId: null });
    expect(await setStoreHealthAlertsAction('site', false)).toEqual({ ok: false, signedOut: true });
    expect(await setStoreHealthAlertsAction('site', 'false' as unknown as boolean)).toEqual({ ok: false });
    mocks.rate.mockRejectedValueOnce(new Error('unavailable'));
    expect(await setStoreHealthAlertsAction('site', false)).toEqual({ ok: false }); expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
