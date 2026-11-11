// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readInboxPage } from './inbox-query';
const m = vi.hoisted(() => ({ access: vi.fn(), profile: vi.fn(), rpc: vi.fn(), names: vi.fn() }));
vi.mock('@/lib/messenger/provisioning', () => ({ requireSiteAccess: m.access, getProfileId: m.profile }));
vi.mock('@/lib/messenger/conversations', () => ({ resolveAssigneeNames: m.names }));
vi.mock('@/lib/messenger/db', () => ({ getMessengerServiceClient: () => ({ rpc: m.rpc }) }));
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: id(i), status: 'open', started_at: '2026-11-11T10:00:00Z', last_message_at: null, inbox_updated_at: '2026-11-11T10:01:00Z', metadata: {}, unread: 2, preview: 'Hi', visitor_name: 'Amira', visitor_email: 'amira@example.com' }));
beforeEach(() => {
  vi.clearAllMocks(); m.access.mockResolvedValue({ id: 'site', workspace_id: 'workspace' }); m.profile.mockResolvedValue('profile'); m.names.mockResolvedValue({}); m.rpc.mockResolvedValue({ data: rows(31), error: null });
});
describe('authorized Inbox reads', () => {
  it('checks site chats capability before running any query', async () => {
    m.access.mockRejectedValue(new Error('Forbidden'));
    await expect(readInboxPage('user', { siteId: 'someone-else' })).rejects.toThrow('Forbidden');
    expect(m.rpc).not.toHaveBeenCalled(); expect(m.profile).not.toHaveBeenCalled();
  });
  it('caps the page at 30, returns the last visible row cursor and uses server identity for mine', async () => {
    const result = await readInboxPage('user', { siteId: 'site', mineOnly: true, filter: 'needs_you', query: 'أَمـيرة' });
    expect(result.ok && result.conversations).toHaveLength(30);
    expect(result.ok && result.cursor).toEqual({ at: null, id: id(29) });
    expect(m.access).toHaveBeenCalledWith('user', 'site', 'chats');
    expect(m.rpc).toHaveBeenCalledWith('messenger_inbox_page', expect.objectContaining({ p_site: 'site', p_query: 'اميره', p_assignee: 'profile', p_filter: 'needs_you' }));
  });
  it('fails closed when assigned-to-me cannot resolve an identity', async () => {
    m.profile.mockResolvedValue(null);
    const result = await readInboxPage('user', { siteId: 'site', mineOnly: true });
    expect(result.ok && result.conversations).toEqual([]); expect(m.rpc).not.toHaveBeenCalled();
  });
  it('validates cursor and filters and caps search input before querying', async () => {
    await expect(readInboxPage('user', { siteId: 'site', cursor: { id: 'bad', at: 'bad' } })).rejects.toThrow('Invalid cursor');
    await readInboxPage('user', { siteId: 'site', query: 'A'.repeat(500) });
    expect(m.rpc).toHaveBeenCalledWith('messenger_inbox_page', expect.objectContaining({ p_query: 'a'.repeat(200) }));
  });
  it('bounds changes at 50 and carries a stable upper watermark for overflow pages', async () => {
    m.rpc.mockResolvedValue({ data: rows(50), error: null });
    const since = '2026-11-10T00:00:00Z', until = '2026-11-11T00:00:00Z';
    const result = await readInboxPage('user', { siteId: 'site' }, { since, until });
    expect(result.ok && result.conversations).toHaveLength(50);
    expect(result.ok && result.cursor).toEqual({ at: '2026-11-11T10:01:00Z', id: id(49) });
    expect(m.rpc).toHaveBeenCalledWith('messenger_inbox_page', expect.objectContaining({ p_changes: true, p_cursor_at: since, p_until: until }));
  });
});
