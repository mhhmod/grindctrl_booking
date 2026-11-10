// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ from: vi.fn(), select: vi.fn(), eq: vi.fn(), one: vi.fn(), rpc: vi.fn() }));
vi.mock('@/lib/messenger/db', () => ({ getMessengerServiceClient: () => ({ from: mocks.from, rpc: mocks.rpc }) }));
import { connectionByWebhookToken, easyOrdersRpc, loadEasyOrdersConnection } from './store';
import { SITE, TOKEN } from './test-fixtures';
beforeEach(() => {
  vi.resetAllMocks();
  const query = { select: mocks.select, eq: mocks.eq, maybeSingle: mocks.one };
  mocks.from.mockReturnValue(query); mocks.select.mockReturnValue(query); mocks.eq.mockReturnValue(query);
  mocks.one.mockResolvedValue({ data: null, error: null });
});
describe('service-only registry', () => {
  it('rejects malformed tokens before accessing the database', async () => {
    for (const token of ['short', '../secret', 'A'.repeat(64), 'a'.repeat(65)]) expect(await connectionByWebhookToken(token)).toBeNull();
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it('requires the exact active webhook token', async () => {
    await connectionByWebhookToken(TOKEN);
    expect(mocks.eq).toHaveBeenCalledWith('webhook_token', TOKEN);
    expect(mocks.eq).toHaveBeenCalledWith('status', 'active');
  });
  it('scopes connection reads by canonical site id', async () => {
    await loadEasyOrdersConnection(SITE);
    expect(mocks.eq).toHaveBeenCalledWith('widget_site_id', SITE);
  });
  it('does not expose database errors and never treats failed persistence as success', async () => {
    mocks.one.mockResolvedValue({ data: null, error: { message: 'private' } });
    await expect(loadEasyOrdersConnection(SITE)).rejects.toThrow('unavailable');
    mocks.rpc.mockResolvedValue({ data: true, error: { message: 'private' } });
    await expect(easyOrdersRpc('test', {})).rejects.toThrow('unavailable');
  });
});
