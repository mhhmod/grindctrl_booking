import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { LeadSettingsFormState } from '@/app/dashboard/leads/state';
import { LeadsDashboard, type LeadsListState } from '@/components/dashboard/leads-dashboard';

const initialSettingsState: LeadSettingsFormState = {
  status: 'idle',
  message: null,
  values: {
    enabled: true,
    captureTiming: 'post_chat',
    fields: ['name', 'email'],
    requiredFields: ['email'],
    promptTitle: 'Stay in touch',
    promptSubtitle: 'Share your details for a follow-up.',
    skippable: false,
    dedupeMode: 'session',
    consentMode: 'required',
    consentText: 'I agree to be contacted.',
    privacyUrl: 'https://example.com/privacy',
  },
};

const populatedLeadsState: LeadsListState = {
  status: 'success',
  message: null,
  leads: [
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
  ],
};

describe('LeadsDashboard', () => {
  it('shows loading and success states for lead settings saves', async () => {
    let resolveSave: ((value: LeadSettingsFormState) => void) | undefined;
    const saveSettingsAction = vi.fn(
      () =>
        new Promise<LeadSettingsFormState>((resolve) => {
          resolveSave = resolve;
        }),
    );

    render(<LeadsDashboard initialSettingsState={initialSettingsState} saveSettingsAction={saveSettingsAction} leadsState={populatedLeadsState} />);

    fireEvent.change(screen.getByLabelText('Prompt title'), { target: { value: 'Contact us next' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Save lead settings' }).closest('form') as HTMLFormElement);

    expect(await screen.findByText('Saving lead capture settings...')).toBeInTheDocument();

    await act(async () => {
      resolveSave?.({
        status: 'success',
        message: 'Lead capture settings saved to settings_json.',
        values: {
          ...initialSettingsState.values,
          promptTitle: 'Contact us next',
        },
      });
    });

    await waitFor(() => expect(screen.getByText('Lead capture settings saved to settings_json.')).toBeInTheDocument());
    expect(screen.getByDisplayValue('Contact us next')).toBeInTheDocument();
  });

  it('shows an error state when saving lead settings fails', async () => {
    const saveSettingsAction = vi.fn().mockResolvedValue({
      ...initialSettingsState,
      status: 'error',
      message: 'dashboard_update_widget_site failed',
    });

    render(<LeadsDashboard initialSettingsState={initialSettingsState} saveSettingsAction={saveSettingsAction} leadsState={populatedLeadsState} />);

    fireEvent.submit(screen.getByRole('button', { name: 'Save lead settings' }).closest('form') as HTMLFormElement);

    expect(await screen.findByText('dashboard_update_widget_site failed')).toBeInTheDocument();
  });

  it('shows loading, empty, and error states for the leads list', () => {
    const saveSettingsAction = vi.fn().mockResolvedValue(initialSettingsState);
    const { container, rerender } = render(<LeadsDashboard initialSettingsState={initialSettingsState} saveSettingsAction={saveSettingsAction} leadsState={{ status: 'loading', message: null, leads: [] }} />);

    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);

    rerender(<LeadsDashboard initialSettingsState={initialSettingsState} saveSettingsAction={saveSettingsAction} leadsState={{ status: 'success', message: null, leads: [] }} />);

    expect(screen.getByText('No leads captured yet.')).toBeInTheDocument();

    rerender(<LeadsDashboard initialSettingsState={initialSettingsState} saveSettingsAction={saveSettingsAction} leadsState={{ status: 'error', message: 'dashboard_list_leads failed', leads: [] }} />);

    expect(screen.getByText('Unable to load leads.')).toBeInTheDocument();
    expect(screen.getByText('dashboard_list_leads failed')).toBeInTheDocument();
  });

  it('keeps the UI read-only for leads and does not introduce a browser-side lead insert path', () => {
    const saveSettingsAction = vi.fn().mockResolvedValue(initialSettingsState);

    render(<LeadsDashboard initialSettingsState={initialSettingsState} saveSettingsAction={saveSettingsAction} leadsState={populatedLeadsState} />);

    expect(screen.queryByRole('button', { name: /add lead/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /create lead/i })).not.toBeInTheDocument();
    expect(screen.getByText(/This screen does not create leads in the browser\./)).toBeInTheDocument();
  });
});
