// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ update: vi.fn(), eq: vi.fn(), neq: vi.fn() }));
vi.mock('@/lib/messenger/db', () => ({ getMessengerServiceClient: () => ({ from: () => ({ update: mocks.update }) }) }));
import { rememberDashboardLocale } from './dashboard-locale';
beforeEach(() => { vi.clearAllMocks(); mocks.update.mockReturnValue({ eq: mocks.eq }); mocks.eq.mockReturnValue({ neq: mocks.neq }); mocks.neq.mockResolvedValue({ error: null }); });
it('remembers the authenticated dashboard language on that same Clerk profile, only if changed', async () => {
  await rememberDashboardLocale('user_owner', 'ar');
  expect(mocks.update).toHaveBeenCalledWith({ dashboard_locale: 'ar' });
  expect(mocks.eq).toHaveBeenCalledWith('clerk_user_id', 'user_owner'); expect(mocks.neq).toHaveBeenCalledWith('dashboard_locale', 'ar');
});
it('keeps dashboard navigation working before the migration or on a failed write', async () => {
  mocks.neq.mockResolvedValue({ error: { code: '42703' } }); await expect(rememberDashboardLocale('user_owner', 'en')).resolves.toBeUndefined();
  mocks.neq.mockRejectedValue(new Error('offline')); await expect(rememberDashboardLocale('user_owner', 'en')).resolves.toBeUndefined();
});
