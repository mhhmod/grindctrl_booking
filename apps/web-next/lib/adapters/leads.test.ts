import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/adapters/rpc', () => ({
  callRpc: vi.fn(),
}));

import { callRpc } from '@/lib/adapters/rpc';
import { listLeads } from '@/lib/adapters/leads';

describe('leads adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes through canonical list RPC params', async () => {
    vi.mocked(callRpc).mockResolvedValue([]);

    await listLeads('user_1', 'workspace_1', 'site_1');

    expect(callRpc).toHaveBeenCalledWith('dashboard_list_leads', {
      p_clerk_user_id: 'user_1',
      p_workspace_id: 'workspace_1',
      p_site_id: 'site_1',
    });
  });

  it('normalizes operational lead fields when present', async () => {
    vi.mocked(callRpc).mockResolvedValue([
      {
        id: 'lead_1',
        workspace_id: 'workspace_1',
        widget_site_id: 'site_1',
        status: 'qualified',
        sync_status: 'ready',
        booking_status: 'follow_up',
        assigned_profile_id: 'profile_1',
      },
    ]);

    const rows = await listLeads('user_1', 'workspace_1', 'site_1');

    expect(rows[0]?.status).toBe('qualified');
    expect(rows[0]?.sync_status).toBe('ready');
    expect(rows[0]?.booking_status).toBe('follow_up');
    expect(rows[0]?.assigned_profile_id).toBe('profile_1');
  });
});
