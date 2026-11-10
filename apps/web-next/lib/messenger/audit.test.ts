// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ client: vi.fn(), insert: vi.fn() }));
vi.mock('@/lib/messenger/db', () => ({ getMessengerServiceClient: m.client }));
import { recordAudit } from './conversations';
beforeEach(() => {
  vi.resetAllMocks();
  m.client.mockReturnValue({ from: () => ({ insert: m.insert }) });
  m.insert.mockResolvedValue({ error: null });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());
it('records the server actor and target, including teams without a site', async () => {
  await recordAudit({ siteId: null, actorClerkUserId: 'clerk_actor', action: 'member_removed', detail: { workspace_id: 'workspace', profile_id: 'target' } });
  expect(m.insert).toHaveBeenCalledWith({ widget_site_id: null, actor_profile_id: null, actor_clerk_user_id: 'clerk_actor', action: 'member_removed', detail: { workspace_id: 'workspace', profile_id: 'target' } });
});
it.each(['result', 'rejection', 'configuration'])('never rejects on %s failures or logs sensitive details', async (failure) => {
  const error = new Error('private@example.com');
  if (failure === 'result') m.insert.mockResolvedValue({ error });
  if (failure === 'rejection') m.insert.mockRejectedValue(error);
  if (failure === 'configuration') m.client.mockImplementation(() => { throw error; });
  await expect(recordAudit({ siteId: 'site', action: 'site_key_regenerated' })).resolves.toBeUndefined();
  expect(console.error).toHaveBeenCalledWith('[messenger] audit insert failed');
});
