// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ owned: vi.fn(), limit: vi.fn(), save: vi.fn(), revalidate: vi.fn() }));
vi.mock('@/lib/shopify/shops', () => ({ requireManagedTryOnShop: mocks.owned }));
vi.mock('@/lib/try-on/settings', () => ({
  saveTryOnSettings: mocks.save,
  TryOnShowButtonUnavailableError: class extends Error {
    readonly code = 'show_button_unavailable';
    constructor() { super('The Try-On button switch is not available yet. Nothing was saved.'); }
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }));
vi.mock('@/lib/request-rate-limit', async (original) => ({
  ...await original<typeof import('@/lib/request-rate-limit')>(), requireMerchantRateLimit: mocks.limit,
}));
import { RequestRateLimitError } from '@/lib/request-rate-limit';
import { RoleNotAllowedError } from '@/lib/rbac/dashboard-policy';
import { TryOnShowButtonUnavailableError } from '@/lib/try-on/settings';
import { saveTryOnSettingsAction, setTryOnButtonAction } from './actions';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.owned.mockResolvedValue('owned.myshopify.com');
  mocks.save.mockResolvedValue(true);
});

describe('Try-On settings safe action result', () => {
  it('returns rate-limit details without a thrown/redacted server-action error', async () => {
    mocks.limit.mockRejectedValueOnce(new RequestRateLimitError(429, 12));
    expect(await saveTryOnSettingsAction(new FormData())).toMatchObject({ ok: false, code: 'rate_limited', retryAfterSeconds: 12 });
    expect(mocks.limit).toHaveBeenCalledWith('shop:owned.myshopify.com');
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it('refuses unauthorized requests before limiter or storage', async () => {
    mocks.owned.mockRejectedValueOnce(new Error('Unknown Shopify shop'));
    expect(await saveTryOnSettingsAction(new FormData())).toMatchObject({ ok: false, code: 'forbidden' });
    expect(mocks.limit).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it('does not report success when settings persistence returned false', async () => {
    mocks.save.mockResolvedValueOnce(false);
    expect(await saveTryOnSettingsAction(new FormData())).toMatchObject({ ok: false, code: 'unavailable' });
    expect(mocks.revalidate).not.toHaveBeenCalled();
    expect(await saveTryOnSettingsAction(new FormData())).toEqual({ ok: true });
  });
  it('keeps the note under each look to 300 characters, as TryOnStudio shows', async () => {
    const fd = new FormData();
    fd.set('disclaimer_text', `  ${'a'.repeat(320)}  `);
    fd.set('disclaimer_text_ar', 'ملاحظة');
    await saveTryOnSettingsAction(fd);
    expect(mocks.save).toHaveBeenCalledWith('owned.myshopify.com', expect.objectContaining({ disclaimerText: 'a'.repeat(300), disclaimerTextAr: 'ملاحظة' }));
  });
  it('saves the button switch only when the form says on or off', async () => {
    const save = async (value?: string) => {
      const fd = new FormData();
      if (value !== undefined) fd.set('show_button', value);
      await saveTryOnSettingsAction(fd);
      return mocks.save.mock.calls.at(-1)![1] as Record<string, unknown>;
    };
    expect(await save('off')).toMatchObject({ showButton: false });
    expect(await save('on')).toMatchObject({ showButton: true });
    // A form without the switch (today's Set up board) must never turn it back on.
    expect(await save()).not.toHaveProperty('showButton');
    expect(await save('maybe')).not.toHaveProperty('showButton');
  });
  it('says plainly when the switch cannot be saved before the database update', async () => {
    mocks.save.mockRejectedValueOnce(new TryOnShowButtonUnavailableError());
    const fd = new FormData();
    fd.set('show_button', 'off');
    const result = await saveTryOnSettingsAction(fd);
    expect(result).toMatchObject({ ok: false, code: 'unavailable', reason: 'show_button_unavailable', message: expect.stringContaining('Nothing was saved') });
    expect(result).not.toHaveProperty('retryAfterSeconds');
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  // Item 12: setting the shop up is for its owner and admins, not members.
  it('asks for the settings role, and refuses a member before limiter or storage', async () => {
    await saveTryOnSettingsAction(new FormData());
    expect(mocks.owned).toHaveBeenCalledWith('default', { capability: 'settings' });
    mocks.owned.mockRejectedValueOnce(new RoleNotAllowedError('settings'));
    mocks.limit.mockClear();
    mocks.save.mockClear();
    expect(await saveTryOnSettingsAction(new FormData())).toMatchObject({ ok: false, code: 'forbidden' });
    expect(mocks.limit).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });
});

describe('setTryOnButtonAction, the switch on its own', () => {
  it('writes only the switch for the managed shop, then refreshes the dashboard', async () => {
    expect(await setTryOnButtonAction({ shop: 'owned.myshopify.com', showButton: false })).toEqual({ ok: true });
    expect(mocks.owned).toHaveBeenCalledWith('owned.myshopify.com', { capability: 'settings' });
    expect(mocks.limit).toHaveBeenCalledWith('shop:owned.myshopify.com');
    expect(mocks.save).toHaveBeenCalledWith('owned.myshopify.com', { showButton: false });
    expect(mocks.revalidate).toHaveBeenCalledWith('/dashboard', 'layout');
  });
  it('refuses a member, and anything but a boolean, before storage', async () => {
    mocks.owned.mockRejectedValueOnce(new RoleNotAllowedError('settings'));
    expect(await setTryOnButtonAction({ shop: 'owned.myshopify.com', showButton: true })).toMatchObject({ ok: false, code: 'forbidden' });
    expect(await setTryOnButtonAction({ shop: 'owned.myshopify.com', showButton: 'false' as unknown as boolean })).toMatchObject({ ok: false });
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it('passes on the typed failures', async () => {
    mocks.save.mockResolvedValueOnce(false);
    expect(await setTryOnButtonAction({ shop: 'owned.myshopify.com', showButton: true })).toMatchObject({ ok: false, code: 'unavailable' });
    mocks.save.mockRejectedValueOnce(new TryOnShowButtonUnavailableError());
    expect(await setTryOnButtonAction({ shop: 'owned.myshopify.com', showButton: false })).toMatchObject({ reason: 'show_button_unavailable' });
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
});
