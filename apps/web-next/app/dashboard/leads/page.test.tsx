import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/dashboard', () => ({
  requireDashboardUser: vi.fn(),
}));

vi.mock('@/lib/adapters/workspace', () => ({
  getWorkspaceBundle: vi.fn(),
}));

vi.mock('@/lib/adapters/leads', async () => {
  const actual = await vi.importActual<typeof import('@/lib/adapters/leads')>('@/lib/adapters/leads');
  return {
    ...actual,
    listLeads: vi.fn(),
  };
});

vi.mock('@/components/dashboard/site-selector', () => ({
  SiteSelector: () => <div data-testid="site-selector" />,
}));

import DashboardLeadsPage from '@/app/dashboard/leads/page';
import { requireDashboardUser } from '@/lib/auth/dashboard';
import { listLeads } from '@/lib/adapters/leads';
import { getWorkspaceBundle } from '@/lib/adapters/workspace';

describe('DashboardLeadsPage', () => {
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
            leads: {
              enabled: true,
              capture_timing: 'post_chat',
              fields: ['name', 'email', 'company'],
              required_fields: ['email'],
              prompt_title: 'Stay in touch',
              prompt_subtitle: 'Share your details for a follow-up.',
              skippable: true,
              dedupe: { mode: 'email' },
              consent: { mode: 'required', text: 'I agree to be contacted.', privacy_url: 'https://example.com/privacy' },
            },
          },
        },
      ],
    });
  });

  it('requires dashboard authentication for the leads route', async () => {
    vi.mocked(listLeads).mockResolvedValue([]);

    const result = await DashboardLeadsPage({ searchParams: Promise.resolve({}) });
    render(result);

    expect(requireDashboardUser).toHaveBeenCalledWith('/dashboard/leads');
  });

  it('loads lead settings initial values from settings_json and reads leads through the adapter', { timeout: 10000 }, async () => {
    vi.mocked(listLeads).mockResolvedValue([
      {
        id: 'lead_1',
        workspace_id: 'workspace_1',
        widget_site_id: 'site_1',
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        company: 'Analytical Engines',
        phone: '+1-555-0101',
        source_domain: 'example.com',
        created_at: '2026-04-22T10:00:00.000Z',
      },
    ]);

    const result = await DashboardLeadsPage({ searchParams: Promise.resolve({}) });
    render(result);

    expect(listLeads).toHaveBeenCalledWith('user_123', 'workspace_1', 'site_1');
    expect(screen.getByRole('checkbox', { name: /Enable lead capture/i })).toBeChecked();
    expect(screen.getByLabelText('Capture timing')).toHaveValue('post_chat');
    expect(screen.getByDisplayValue('Stay in touch')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Share your details for a follow-up.')).toBeInTheDocument();
    expect(screen.getAllByText('Ada Lovelace').length).toBeGreaterThan(0);
    expect(screen.getAllByText('ada@example.com').length).toBeGreaterThan(0);
  });

  it('shows a server error state when the existing leads read contract fails', async () => {
    vi.mocked(listLeads).mockRejectedValue(new Error('dashboard_list_leads failed: boom'));

    const result = await DashboardLeadsPage({ searchParams: Promise.resolve({}) });
    render(result);

    expect(screen.getByText('Unable to load leads.')).toBeInTheDocument();
    expect(screen.getByText('dashboard_list_leads failed: boom')).toBeInTheDocument();
  });
});
