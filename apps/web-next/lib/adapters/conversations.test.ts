import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/adapters/rpc', () => ({
  callRpc: vi.fn(),
}));

import { callRpc } from '@/lib/adapters/rpc';
import { getConversationDetail, listConversations } from '@/lib/adapters/conversations';

describe('conversations adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls list conversations RPC with canonical params', async () => {
    vi.mocked(callRpc).mockResolvedValue([]);

    await listConversations({
      clerkUserId: 'user_1',
      workspaceId: 'workspace_1',
      siteId: 'site_1',
      query: 'pricing',
      status: 'open',
      owner: 'unassigned',
      page: 2,
      pageSize: 25,
    });

    expect(callRpc).toHaveBeenCalledWith('dashboard_list_conversations', {
      p_clerk_user_id: 'user_1',
      p_workspace_id: 'workspace_1',
      p_site_id: 'site_1',
      p_query: 'pricing',
      p_status: 'open',
      p_owner: 'unassigned',
      p_page: 2,
      p_page_size: 25,
    });
  });

  it('normalizes conversation detail envelope', async () => {
    vi.mocked(callRpc).mockResolvedValue({
      conversation: {
        id: 'conv_1',
        widget_site_id: 'site_1',
        visitor_id: 'visitor_1',
        status: 'open',
        message_count: '3',
        lead_count: 1,
      },
      messages: [
        {
          id: 'msg_1',
          conversation_id: 'conv_1',
          role: 'user',
          content: 'Hello',
        },
      ],
      leads: [
        {
          id: 'lead_1',
          workspace_id: 'workspace_1',
          widget_site_id: 'site_1',
          status: 'qualified',
          sync_status: 'ready',
          booking_status: 'follow_up',
        },
      ],
    });

    const detail = await getConversationDetail({
      clerkUserId: 'user_1',
      workspaceId: 'workspace_1',
      siteId: 'site_1',
      conversationId: 'conv_1',
    });

    expect(detail.conversation?.message_count).toBe(3);
    expect(detail.messages[0]?.content).toBe('Hello');
    expect(detail.leads[0]?.status).toBe('qualified');
    expect(detail.leads[0]?.sync_status).toBe('ready');
  });
});
