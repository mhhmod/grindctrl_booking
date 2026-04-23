import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/dashboard', () => ({
  requireDashboardUser: vi.fn(),
}));

vi.mock('@/lib/adapters/workspace', () => ({
  getWorkspaceBundle: vi.fn(),
}));

vi.mock('@/lib/adapters/domains', async () => {
  const actual = await vi.importActual<typeof import('@/lib/adapters/domains')>('@/lib/adapters/domains');
  return {
    ...actual,
    listDomains: vi.fn(),
  };
});

vi.mock('@/components/dashboard/site-selector', () => ({
  SiteSelector: () => <div data-testid="site-selector" />,
}));

import DashboardDomainsPage from '@/app/dashboard/domains/page';
import { requireDashboardUser } from '@/lib/auth/dashboard';
import { listDomains } from '@/lib/adapters/domains';
import { getWorkspaceBundle } from '@/lib/adapters/workspace';

describe('DashboardDomainsPage', () => {
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
    vi.mocked(listDomains).mockResolvedValue([
      {
        id: 'domain_1',
        widget_site_id: 'site_1',
        domain: 'example.com',
        verification_status: 'verified',
      },
    ]);
  });

  it('requires dashboard authentication for the domains route', async () => {
    const result = await DashboardDomainsPage({ searchParams: Promise.resolve({}) });
    render(result);

    expect(requireDashboardUser).toHaveBeenCalledWith('/dashboard/domains');
  });

  it('loads domains from the real adapter path for the active site', async () => {
    const result = await DashboardDomainsPage({ searchParams: Promise.resolve({}) });
    render(result);

    expect(listDomains).toHaveBeenCalledWith('user_123', 'site_1');
    expect(screen.getByText('example.com')).toBeInTheDocument();
    expect(screen.getByLabelText('Status')).toHaveValue('verified');
  });
});
