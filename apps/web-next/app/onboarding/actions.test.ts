// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ save: vi.fn(), redirect: vi.fn((href: string) => { throw new Error(`redirect:${href}`); }) }));
vi.mock('server-only', () => ({}));
vi.mock('@clerk/nextjs/server', () => ({ auth: async () => ({ userId: 'owner' }), currentUser: async () => ({ primaryEmailAddress: { emailAddress: 'owner@example.com' } }) }));
vi.mock('next/navigation', () => ({ redirect: m.redirect }));
vi.mock('@/lib/auth/locale', () => ({ getRequestLocale: async () => 'en' }));
vi.mock('@/lib/onboarding/profile', async (original) => ({ ...await original<typeof import('@/lib/onboarding/profile')>(), saveOnboardingProfile: m.save }));
import { submitOnboarding } from './actions';

beforeEach(() => { vi.clearAllMocks(); m.save.mockResolvedValue({ ok: true }); });
const form = () => {
  const data = new FormData();
  Object.entries({ fullName: 'Store Owner', phone: '+201001234567', website: 'shop.example', companyName: 'Store', storePlatform: 'Shopify', monthlyOrders: 'Under 100 a month', primaryGoal: '' })
    .forEach(([key, value]) => data.set(key, value));
  return data;
};
it('m2: saves the platform and address before continuing to Store setup', async () => {
  await expect(submitOnboarding({ errors: {} }, form())).rejects.toThrow('redirect:/dashboard/store');
  expect(m.save).toHaveBeenCalledWith('owner', 'owner@example.com', expect.objectContaining({ storePlatform: 'Shopify', website: 'shop.example' }), expect.any(Object));
});
it('keeps the form and next action when saving fails', async () => {
  m.save.mockResolvedValue({ ok: false, message: 'Try again' });
  expect(await submitOnboarding({ errors: {} }, form())).toMatchObject({ message: 'Try again', values: { website: 'shop.example' } });
  expect(m.redirect).not.toHaveBeenCalled();
});
