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

vi.mock('@/lib/adapters/installVerification', () => ({
  getInstallVerification: vi.fn(),
}));

vi.mock('@/lib/adapters/widgetEvents', () => ({
  getWidgetEventAnalyticsBundle: vi.fn(),
  normalizeWidgetEventsWindow: vi.fn(),
}));

vi.mock('@/components/dashboard/site-selector', () => ({
  SiteSelector: () => <div data-testid="site-selector" />,
}));

import DashboardInstallPage from '@/app/dashboard/install/page';
import { requireDashboardUser } from '@/lib/auth/dashboard';
import { listDomains } from '@/lib/adapters/domains';
import { getInstallVerification } from '@/lib/adapters/installVerification';
import { getWidgetEventAnalyticsBundle, normalizeWidgetEventsWindow } from '@/lib/adapters/widgetEvents';
import { getWorkspaceBundle } from '@/lib/adapters/workspace';

describe('DashboardInstallPage', () => {
  beforeEach(() => {
    vi.mocked(requireDashboardUser).mockResolvedValue('user_123');
    vi.mocked(normalizeWidgetEventsWindow).mockReturnValue('7d');
    vi.mocked(getWidgetEventAnalyticsBundle).mockResolvedValue({
      timeseries: [],
      breakdown: [],
      funnel: null,
    });
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

  it('requires dashboard authentication for the install route', async () => {
    vi.mocked(listDomains).mockResolvedValue([]);
    vi.mocked(getInstallVerification).mockResolvedValue(null);

    const result = await DashboardInstallPage({ searchParams: Promise.resolve({}) });
    render(result);

    expect(requireDashboardUser).toHaveBeenCalledWith('/dashboard/install');
  });

  it('shows domain setup state from the real adapter path on install', async () => {
    vi.mocked(listDomains).mockResolvedValue([]);
    vi.mocked(getInstallVerification).mockResolvedValue(null);

    const result = await DashboardInstallPage({ searchParams: Promise.resolve({}) });
    render(result);

    expect(listDomains).toHaveBeenCalledWith('user_123', 'site_1');
    expect(getInstallVerification).toHaveBeenCalledWith('user_123', 'site_1');
    expect(getWidgetEventAnalyticsBundle).toHaveBeenCalledWith('user_123', 'site_1', '7d');
    expect(screen.getAllByText(/No allowed domains are configured yet/).length).toBeGreaterThan(0);
    expect(screen.getByText('Never seen')).toBeInTheDocument();
  });

  it('shows an install verification error state when the heartbeat contract fails', async () => {
    vi.mocked(listDomains).mockResolvedValue([]);
    vi.mocked(getInstallVerification).mockRejectedValue(new Error('dashboard_get_install_verification failed: boom'));

    const result = await DashboardInstallPage({ searchParams: Promise.resolve({}) });
    render(result);

    expect(screen.getByText('Unable to load install verification.')).toBeInTheDocument();
    expect(screen.getByText('dashboard_get_install_verification failed: boom')).toBeInTheDocument();
  });
});
