import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/dashboard', () => ({ requireDashboardUser: vi.fn() }));
vi.mock('@/lib/adapters/workspace', () => ({ getWorkspaceBundle: vi.fn() }));
vi.mock('@/lib/adapters/intents', async () => {
  const actual = await vi.importActual<typeof import('@/lib/adapters/intents')>('@/lib/adapters/intents');
  return { ...actual, listIntents: vi.fn() };
});
vi.mock('@/components/dashboard/site-selector', () => ({ SiteSelector: () => <div data-testid="site-selector" /> }));

import DashboardIntentsPage from '@/app/dashboard/intents/page';
import { requireDashboardUser } from '@/lib/auth/dashboard';
import { listIntents } from '@/lib/adapters/intents';
import { getWorkspaceBundle } from '@/lib/adapters/workspace';

describe('DashboardIntentsPage', () => {
  beforeEach(() => {
    vi.mocked(requireDashboardUser).mockResolvedValue('user_123');
    vi.mocked(getWorkspaceBundle).mockResolvedValue({
      workspace: { id: 'workspace_1', name: 'Workspace' },
      role: 'owner',
      sites: [{ id: 'site_1', workspace_id: 'workspace_1', name: 'Main Site', embed_key: 'gc_live_real_embed', status: 'active', settings_json: {} }],
    });
  });

  it('requires dashboard authentication for the intents route', async () => {
    vi.mocked(listIntents).mockResolvedValue([]);
    const result = await DashboardIntentsPage({ searchParams: Promise.resolve({}) });
    render(result);

    expect(requireDashboardUser).toHaveBeenCalledWith('/dashboard/intents');
  });

  it('loads initial intents through the real adapter path', async () => {
    vi.mocked(listIntents).mockResolvedValue([{ id: 'intent_1', widget_site_id: 'site_1', label: 'Talk to sales', action_type: 'send_message', sort_order: 0 }]);
    const result = await DashboardIntentsPage({ searchParams: Promise.resolve({}) });
    render(result);

    expect(listIntents).toHaveBeenCalledWith('user_123', 'site_1');
    expect(screen.getByText('Talk to sales')).toBeInTheDocument();
  });

  it('renders the empty state when no intents exist', async () => {
    vi.mocked(listIntents).mockResolvedValue([]);
    const result = await DashboardIntentsPage({ searchParams: Promise.resolve({}) });
    render(result);

    expect(screen.getByText('No intents configured yet.')).toBeInTheDocument();
  });
});
