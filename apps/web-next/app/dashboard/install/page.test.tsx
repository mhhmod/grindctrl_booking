import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/dashboard', () => ({
  requireDashboardUser: vi.fn(),
}));

vi.mock('@/lib/adapters/workspace', () => ({
  getWorkspaceBundle: vi.fn(),
}));

vi.mock('@/lib/adapters/domains', () => ({
  listDomains: vi.fn(),
}));

vi.mock('@/components/dashboard/site-selector', () => ({
  SiteSelector: () => <div data-testid="site-selector" />,
}));

import DashboardInstallPage from '@/app/dashboard/install/page';
import { requireDashboardUser } from '@/lib/auth/dashboard';
import { listDomains } from '@/lib/adapters/domains';
import { getWorkspaceBundle } from '@/lib/adapters/workspace';

describe('DashboardInstallPage', () => {
  beforeEach(() => {
    vi.mocked(requireDashboardUser).mockResolvedValue('user_123');
    vi.mocked(getWorkspaceBundle).mockResolvedValue({
      workspace: { id: 'workspace_1', name: 'Workspace' },
      role: 'owner',
      sites: [
        {
          id: 'site_1',
          workspace_id: 'workspace_1',
          name: 'Main Site',
          embed_key: 'gc_live_real_embed',
          status: 'active',
          settings_json: { security: { allow_localhost: true } },
        },
      ],
    });
  });

  it('shows domain setup state from the real adapter path on install', async () => {
    vi.mocked(listDomains).mockResolvedValue([]);

    const result = await DashboardInstallPage({ searchParams: Promise.resolve({}) });
    render(result);

    expect(listDomains).toHaveBeenCalledWith('user_123', 'site_1');
    expect(screen.getByText(/No allowed domains are configured yet/)).toBeInTheDocument();
  });
});
