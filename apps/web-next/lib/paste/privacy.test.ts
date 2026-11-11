// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ connection: vi.fn(), rpc: vi.fn(), export: vi.fn(), erase: vi.fn(), drain: vi.fn() }));
vi.mock('./store', () => ({ getPasteConnection: m.connection }));
vi.mock('@/lib/messenger/db', () => ({ getMessengerServiceClient: () => ({ rpc: m.rpc }) }));
vi.mock('@/lib/woo/privacy', async (original) => ({
  ...await original<object>(), exportShopperData: m.export, eraseShopperData: m.erase, drainWooPrivacyStorageQueue: m.drain,
}));
import { disconnectPasteSite, pasteShopperPrivacy } from './privacy';
beforeEach(() => {
  vi.resetAllMocks();
  m.connection.mockResolvedValue({ platform: 'website', status: 'active', shop_domain: null });
  m.rpc.mockResolvedValue({ data: true, error: null });
  m.export.mockResolvedValue({ items: [], done: true });
  m.erase.mockResolvedValue({ removed: 2, done: true, counts: { leads: 2 } });
  m.drain.mockResolvedValue({ removed: 0, failed: 0 });
});
describe('paste privacy uses the stored installation, never guesses from the domain', () => {
  it.each(['website', 'shopify'])('exports and erases %s paste through the existing bounded privacy path', async (platform) => {
    m.connection.mockResolvedValue({ platform, status: 'active' });
    expect(await pasteShopperPrivacy('site-a', 'export', { email: ' A@Example.com ', page: 2 })).toEqual({ items: [], done: true });
    expect(m.export).toHaveBeenCalledWith('site-a', 'a@example.com', 2);
    expect(await pasteShopperPrivacy('site-a', 'erase', { email: 'a@example.com' })).toMatchObject({ removed: 2 });
    expect(m.erase).toHaveBeenCalledWith('site-a', 'a@example.com');
    expect(m.drain).toHaveBeenCalledTimes(1);
  });
  it('rejects missing installation records and invalid requests before privacy work', async () => {
    await expect(pasteShopperPrivacy('site-a', 'erase', { email: 'invalid' })).rejects.toMatchObject({ code: 'invalid_request' });
    m.connection.mockResolvedValue(null);
    await expect(pasteShopperPrivacy('site-a', 'erase', { email: 'a@example.com' })).rejects.toMatchObject({ code: 'not_found' });
    expect(m.erase).not.toHaveBeenCalled();
  });
  it('keeps a failed Storage deletion retryable', async () => {
    m.drain.mockResolvedValue({ removed: 0, failed: 1 });
    await expect(pasteShopperPrivacy('site-a', 'erase', { email: 'a@example.com' })).rejects.toMatchObject({ code: 'unavailable' });
  });
  it('durably schedules disconnect with the authenticated actor', async () => {
    expect(await disconnectPasteSite('site-a', 'clerk_actor')).toBe(true);
    expect(m.rpc).toHaveBeenCalledWith('disconnect_paste_site', { p_site: 'site-a', p_actor_user_id: 'clerk_actor' });
    m.rpc.mockResolvedValue({ data: false, error: null });
    await expect(disconnectPasteSite('site-a', 'clerk_actor')).rejects.toMatchObject({ code: 'unavailable' });
  });
  it('leaves the plugin/app disconnect path to its caller when no paste record exists', async () => {
    m.connection.mockResolvedValue(null);
    expect(await disconnectPasteSite('site-a', 'clerk_actor')).toBe(false);
    expect(m.rpc).not.toHaveBeenCalled();
  });
});
