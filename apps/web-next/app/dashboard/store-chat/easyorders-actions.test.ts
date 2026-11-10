// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), access: vi.fn(), limit: vi.fn(), install: vi.fn(), load: vi.fn(), disconnect: vi.fn(), sync: vi.fn() }));
vi.mock('@clerk/nextjs/server', () => ({ auth: mocks.auth }));
vi.mock('@/lib/messenger/provisioning', () => ({ requireSiteAccess: mocks.access, UnauthorizedError: class extends Error {} }));
vi.mock('@/lib/request-rate-limit', async (original) => ({ ...(await original<typeof import('@/lib/request-rate-limit')>()), requireMerchantRateLimit: mocks.limit }));
vi.mock('@/lib/easyorders/install', () => ({ createInstallLink: mocks.install }));
vi.mock('@/lib/easyorders/store', () => ({ loadEasyOrdersConnection: mocks.load }));
vi.mock('@/lib/easyorders/disconnect', () => ({ disconnectEasyOrdersConnection: mocks.disconnect }));
vi.mock('@/lib/easyorders/products', () => ({ syncEasyOrdersProducts: mocks.sync }));
import { RoleNotAllowedError } from '@/lib/rbac/dashboard-policy';
import { RequestRateLimitError } from '@/lib/request-rate-limit';
import { SITE, USER, connection } from '@/lib/easyorders/test-fixtures';
import { createEasyOrdersInstallLink, getEasyOrdersStatus, disconnectEasyOrders, syncEasyOrdersProductsAction } from './easyorders-actions';
beforeEach(() => {
  vi.resetAllMocks(); mocks.auth.mockResolvedValue({ userId: USER }); mocks.access.mockResolvedValue({ id: SITE });
  mocks.install.mockResolvedValue('https://app.easy-orders.net/#/install-app'); mocks.load.mockResolvedValue(connection());
  mocks.sync.mockResolvedValue(2);
});
const actions = [createEasyOrdersInstallLink, getEasyOrdersStatus, disconnectEasyOrders, syncEasyOrdersProductsAction];
describe('EasyOrders owner-only action boundary', () => {
  it.each(actions)('checks Clerk identity, site ownership and merchant budget for %s', async (action) => {
    expect(await action(SITE)).toMatchObject({ ok: true });
    expect(mocks.access).toHaveBeenCalledWith(USER, SITE, 'store');
    expect(mocks.limit).toHaveBeenCalledWith(`easyorders:${SITE}:${USER}`, action === getEasyOrdersStatus ? 'read' : 'write');
  });
  it.each(actions)('refuses anonymous and non-owner callers for %s', async (action) => {
    mocks.auth.mockResolvedValueOnce({ userId: null });
    expect(await action(SITE)).toEqual({ ok: false, code: 'forbidden' });
    mocks.access.mockRejectedValueOnce(new RoleNotAllowedError('store'));
    expect(await action(SITE)).toEqual({ ok: false, code: 'forbidden' });
    expect(mocks.install).not.toHaveBeenCalled(); expect(mocks.load).not.toHaveBeenCalled();
    expect(mocks.disconnect).not.toHaveBeenCalled(); expect(mocks.sync).not.toHaveBeenCalled();
  });
  it('never returns credentials, webhook token or signing state from status', async () => {
    const result = await getEasyOrdersStatus(SITE);
    expect(result).toMatchObject({ ok: true, data: { status: 'active', store_id: 'store-1' } });
    expect(JSON.stringify(result)).not.toMatch(/api_key|webhook_token|webhook_secret|callback_origin|ciphertext/);
  });
  it('denies work if rate enforcement is unavailable or exhausted', async () => {
    mocks.limit.mockRejectedValueOnce(new RequestRateLimitError(503, 30)).mockRejectedValueOnce(new RequestRateLimitError(429, 60));
    expect(await createEasyOrdersInstallLink(SITE)).toEqual({ ok: false, code: 'unavailable', retryAfterSeconds: 30 });
    expect(await disconnectEasyOrders(SITE)).toEqual({ ok: false, code: 'rate_limited', retryAfterSeconds: 60 });
    expect(mocks.install).not.toHaveBeenCalled(); expect(mocks.disconnect).not.toHaveBeenCalled();
  });
});
