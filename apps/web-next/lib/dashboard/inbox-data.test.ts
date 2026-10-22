// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const m = vi.hoisted(() => ({
  access: vi.fn(),
  profile: vi.fn(),
  list: vi.fn(),
  members: vi.fn(),
  names: vi.fn(),
  summaries: vi.fn(),
  canned: vi.fn(),
}));
vi.mock('@/lib/messenger/provisioning', () => ({ requireSiteAccess: m.access, getProfileId: m.profile }));
vi.mock('@/lib/messenger/conversations', () => ({
  listConversationsForSite: m.list,
  listWorkspaceMembers: m.members,
  resolveAssigneeNames: m.names,
  summarizeConversations: m.summaries,
}));
vi.mock('@/lib/messenger/canned-replies', () => ({ listCannedReplies: m.canned }));

import { getInboxData } from './inbox-data';

const row = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  status: 'handoff_requested',
  started_at: '2026-10-22T09:00:00Z',
  last_message_at: '2026-10-22T09:05:00Z',
  visitor_email: 'salma@example.com',
  visitor_name: 'Salma',
  handoff_reason: 'shopper_requested_human',
  assigned_profile_id: null,
  metadata: { tags: ['exchange'] },
  ...over,
});

beforeEach(() => {
  vi.resetAllMocks();
  m.access.mockResolvedValue({ id: 'site_1', workspace_id: 'ws_1', role: 'member' });
  m.profile.mockResolvedValue('profile_me');
  m.list.mockResolvedValue([row('c1'), row('c2', { status: 'handoff_active', assigned_profile_id: 'profile_nour' })]);
  m.members.mockResolvedValue([{ profileId: 'profile_nour', name: 'Nour' }]);
  m.names.mockResolvedValue({ profile_nour: 'Nour Saleh' });
  m.summaries.mockResolvedValue({ c1: { unread: 2, preview: 'Can I exchange the M?' } });
  m.canned.mockResolvedValue([{ id: 'r1', title: 'Hours', content: 'We open at 10.', status: 'active' }]);
});

describe('getInboxData', () => {
  it('checks the person may answer this site’s chats, then lists them with their last line and who has each', async () => {
    const data = await getInboxData({ userId: 'user_1', siteId: 'site_1', withTags: false });
    expect(m.access).toHaveBeenCalledWith('user_1', 'site_1', 'chats');
    expect(m.names).toHaveBeenCalledWith('ws_1', ['profile_nour']);
    expect(data.siteId).toBe('site_1');
    expect(data.currentProfileId).toBe('profile_me');
    expect(data.conversations).toEqual([
      expect.objectContaining({ id: 'c1', status: 'handoff_requested', visitorName: 'Salma', unreadCount: 2, preview: 'Can I exchange the M?', assigneeName: null, tags: undefined }),
      expect.objectContaining({ id: 'c2', status: 'handoff_active', assigneeId: 'profile_nour', assigneeName: 'Nour Saleh', unreadCount: 0, preview: null }),
    ]);
    expect(data.cannedReplies).toHaveLength(1);
  });

  it('passes intent tags only when asked, and leaves out what cannot be read', async () => {
    m.summaries.mockRejectedValue(new Error('down'));
    m.names.mockRejectedValue(new Error('down'));
    m.canned.mockRejectedValue(new Error('down'));
    m.profile.mockRejectedValue(new Error('down'));
    const data = await getInboxData({ userId: 'user_1', siteId: 'site_1', withTags: true });
    expect(data.conversations[0]).toMatchObject({ tags: ['exchange'], unreadCount: 0, preview: null });
    expect(data.conversations[1]).toMatchObject({ assigneeName: null });
    expect(data.cannedReplies).toEqual([]);
    expect(data.currentProfileId).toBeNull();
  });

  it('refuses a site the person may not open, and fails when the conversations cannot be read', async () => {
    m.access.mockRejectedValueOnce(new Error('unauthorized'));
    await expect(getInboxData({ userId: 'user_1', siteId: 'someone-else', withTags: false })).rejects.toThrow('unauthorized');
    expect(m.list).not.toHaveBeenCalled();

    m.list.mockRejectedValue(new Error('db down'));
    await expect(getInboxData({ userId: 'user_1', siteId: 'site_1', withTags: false })).rejects.toThrow('db down');
  });
});
