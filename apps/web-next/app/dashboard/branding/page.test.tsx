import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/dashboard', () => ({
  requireDashboardUser: vi.fn(),
}));

vi.mock('@/lib/adapters/workspace', () => ({
  getWorkspaceBundle: vi.fn(),
}));

vi.mock('@/components/dashboard/site-selector', () => ({
  SiteSelector: () => <div data-testid="site-selector" />,
}));

import DashboardBrandingPage from '@/app/dashboard/branding/page';
import { requireDashboardUser } from '@/lib/auth/dashboard';
import { getWorkspaceBundle } from '@/lib/adapters/workspace';

describe('DashboardBrandingPage', () => {
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
          settings_json: {
            branding: {
              brand_name: 'ACME Labs',
              assistant_name: 'Nova',
              launcher_label: 'Chat with ACME',
              launcher_icon: 'sparkles',
              theme_mode: 'dark',
              radius_style: 'rounded',
              attribution: {
                mode: 'always',
                show_powered_by: true,
              },
            },
            widget: {
              position: 'bottom-left',
            },
          },
        },
      ],
    });
  });

  it('requires dashboard authentication for the branding route', async () => {
    const result = await DashboardBrandingPage({ searchParams: Promise.resolve({}) });
    render(result);

    expect(requireDashboardUser).toHaveBeenCalledWith('/dashboard/branding');
  });

  it('loads initial branding values from settings_json', async () => {
    const result = await DashboardBrandingPage({ searchParams: Promise.resolve({}) });
    render(result);

    expect(screen.getByDisplayValue('ACME Labs')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Nova')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Chat with ACME')).toBeInTheDocument();
    expect(screen.getByLabelText('Widget position')).toHaveValue('bottom-left');
    expect(screen.getByRole('checkbox')).toBeChecked();
  });
});
