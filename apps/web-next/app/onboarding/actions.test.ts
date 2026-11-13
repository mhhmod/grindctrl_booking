// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  save: vi.fn(),
  redirect: vi.fn((href: string) => { throw new Error(`redirect:${href}`); }),
  listSites: vi.fn(async (): Promise<unknown[]> => []),
  ensureSite: vi.fn(async () => ({ id: 'site_1' })),
}));
vi.mock('@/lib/messenger/provisioning', () => ({ listMessengerSites: m.listSites, ensureMessengerSite: m.ensureSite }));
vi.mock('server-only', () => ({}));
vi.mock('@clerk/nextjs/server', () => ({ auth: async () => ({ userId: 'owner' }), currentUser: async () => ({ primaryEmailAddress: { emailAddress: 'owner@example.com' } }) }));
vi.mock('next/navigation', () => ({ redirect: m.redirect }));
vi.mock('@/lib/auth/locale', () => ({ getRequestLocale: async () => 'en' }));
vi.mock('@/lib/onboarding/profile', async (original) => ({ ...await original<typeof import('@/lib/onboarding/profile')>(), saveOnboardingProfile: m.save }));
import { submitOnboarding } from './actions';

beforeEach(() => {
  vi.clearAllMocks();
  m.save.mockResolvedValue({ ok: true });
  m.listSites.mockResolvedValue([]);
  m.ensureSite.mockResolvedValue({ id: 'site_1' });
});
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
it('continues to the page a new account was going to, when it is a safe same-site page', async () => {
  const withNext = form();
  withNext.set('next', '/claim?token=abc');
  await expect(submitOnboarding({ errors: {} }, withNext)).rejects.toThrow('redirect:/claim?token=abc');
  const offSite = form();
  offSite.set('next', 'https://evil.example');
  await expect(submitOnboarding({ errors: {} }, offSite)).rejects.toThrow('redirect:/dashboard/store');
});
it('keeps the form and next action when saving fails', async () => {
  m.save.mockResolvedValue({ ok: false, message: 'Try again' });
  expect(await submitOnboarding({ errors: {} }, form())).toMatchObject({ message: 'Try again', values: { website: 'shop.example' } });
  expect(m.redirect).not.toHaveBeenCalled();
  expect(m.ensureSite).not.toHaveBeenCalled();
});

/* Item 3/5: the first store exists, named after the store just given, before
   Store setup's first paint, so the dashboard shell's switcher shows it. */
it('creates a new merchant’s first store, named after their store, before Store setup', async () => {
  await expect(submitOnboarding({ errors: {} }, form())).rejects.toThrow('redirect:/dashboard/store');
  expect(m.listSites).toHaveBeenCalledWith('owner', 'owner@example.com');
  expect(m.ensureSite).toHaveBeenCalledWith('owner', null, 'Store');
  expect(m.ensureSite.mock.invocationCallOrder[0]).toBeLessThan(m.redirect.mock.invocationCallOrder[0]);
});
it('also prepares the first shell when sign-up started from a Store setup deep link', async () => {
  const data = form();
  data.set('next', '/dashboard/store#connect');
  await expect(submitOnboarding({ errors: {} }, data)).rejects.toThrow('redirect:/dashboard/store#connect');
  expect(m.ensureSite).toHaveBeenCalledWith('owner', null, 'Store');
});
it('leaves an account that already has a store, or is going elsewhere, to its own path', async () => {
  m.listSites.mockResolvedValue([{ id: 'existing' }]);
  await expect(submitOnboarding({ errors: {} }, form())).rejects.toThrow('redirect:/dashboard/store');
  expect(m.ensureSite).not.toHaveBeenCalled();
  m.listSites.mockResolvedValue([]);
  const claim = form();
  claim.set('next', '/claim?token=abc');
  await expect(submitOnboarding({ errors: {} }, claim)).rejects.toThrow('redirect:/claim?token=abc');
  expect(m.listSites).toHaveBeenCalledTimes(1);
  expect(m.ensureSite).not.toHaveBeenCalled();
});
it('still continues to Store setup when the store cannot be made here', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  m.ensureSite.mockRejectedValue(new Error('site create failed: secret detail'));
  await expect(submitOnboarding({ errors: {} }, form())).rejects.toThrow('redirect:/dashboard/store');
  expect(log).toHaveBeenCalledWith('[onboarding] first store not prepared', { code: 'onboarding_first_store_failed', error: 'Error' });
  log.mockRestore();
});
