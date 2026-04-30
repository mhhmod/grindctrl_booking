import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/dashboard', () => ({
  requireDashboardUser: vi.fn(),
}));

vi.mock('@/lib/adapters/workspace', () => ({
  getWorkspaceBundle: vi.fn(),
}));

vi.mock('@/lib/adapters/widgetEvents', () => ({
  getWidgetEventAnalyticsBundle: vi.fn(),
  normalizeWidgetEventsWindow: vi.fn(),
}));

vi.mock('@/components/dashboard/site-selector', () => ({
  SiteSelector: () => <div data-testid="site-selector" />,
}));

import DashboardInboxPage from '@/app/dashboard/inbox/page';
import { requireDashboardUser } from '@/lib/auth/dashboard';
import { getWorkspaceBundle } from '@/lib/adapters/workspace';
import { getWidgetEventAnalyticsBundle, normalizeWidgetEventsWindow } from '@/lib/adapters/widgetEvents';

describe('DashboardInboxPage', () => {
  beforeEach(() => {
    vi.mocked(requireDashboardUser).mockResolvedValue('user_123');
    vi.mocked(normalizeWidgetEventsWindow).mockReturnValue('7d');
    vi.mocked(getWorkspaceBundle).mockResolvedValue({
      workspace: { id: 'workspace_1', name: 'Workspace' },
      role: 'owner',
      sites: [{ id: 'site_1', workspace_id: 'workspace_1', name: 'Main Site', embed_key: 'gc_live_real_embed', status: 'active', settings_json: {} }],
    });
    vi.mocked(getWidgetEventAnalyticsBundle).mockResolvedValue({
      timeseries: [],
      breakdown: [
        { event_name: 'conversation_start', total_count: 12 },
        { event_name: 'message_sent', total_count: 36 },
        { event_name: 'escalation_trigger', total_count: 3 },
      ],
      funnel: null,
    });
  });

  it('renders inbox workspace shell and summary metrics', async () => {
    const result = await DashboardInboxPage({ searchParams: Promise.resolve({}) });
    render(result);

    expect(requireDashboardUser).toHaveBeenCalledWith('/dashboard/inbox');
    expect(screen.getByText('Inbox')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('36')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText(/Conversation list rows are blocked/)).toBeInTheDocument();
  });
});
