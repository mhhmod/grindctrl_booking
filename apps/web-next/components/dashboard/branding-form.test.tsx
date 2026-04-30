import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { BrandingFormState } from '@/app/dashboard/branding/state';
import { BrandingForm } from '@/components/dashboard/branding-form';

const initialState: BrandingFormState = {
  status: 'idle',
  message: null,
  values: {
    brandName: 'GRINDCTRL',
    assistantName: 'Support',
    logoUrl: '',
    avatarUrl: '',
    launcherLabel: 'Need help?',
    launcherIcon: 'chat',
    themeMode: 'auto',
    radiusStyle: 'soft',
    widgetPosition: 'bottom-right',
    attributionMode: 'auto',
    showPoweredBy: false,
  },
};

describe('BrandingForm', () => {
  it('shows loading and round-trips saved values into the UI', async () => {
    let resolveSave: ((value: BrandingFormState) => void) | undefined;
    const saveAction = vi.fn(
      () =>
        new Promise<BrandingFormState>((resolve) => {
          resolveSave = resolve;
        }),
    );

    render(<BrandingForm initialState={initialState} saveAction={saveAction} />);

    fireEvent.change(screen.getByLabelText('Brand name'), { target: { value: 'ACME Labs' } });
    fireEvent.change(screen.getByLabelText('Widget position'), { target: { value: 'bottom-left' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.submit(screen.getByRole('button', { name: 'Save branding' }).closest('form') as HTMLFormElement);

    expect(await screen.findByText('Saving branding...')).toBeInTheDocument();

    await act(async () => {
      resolveSave?.({
        status: 'success',
        message: 'Branding saved to settings_json.',
        values: {
          ...initialState.values,
          brandName: 'ACME Labs',
          widgetPosition: 'bottom-left',
          showPoweredBy: true,
        },
      });
    });

    await waitFor(() => expect(screen.getByText('Branding saved to settings_json.')).toBeInTheDocument());
    expect(screen.getByLabelText('Widget position')).toHaveValue('bottom-left');
    expect(screen.getByDisplayValue('ACME Labs')).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('shows an error state when save fails', async () => {
    const saveAction = vi.fn().mockResolvedValue({
      ...initialState,
      status: 'error',
      message: 'dashboard_update_widget_site failed',
    });

    render(<BrandingForm initialState={initialState} saveAction={saveAction} />);

    fireEvent.change(screen.getByLabelText('Brand name'), { target: { value: 'GRINDCTRL Plus' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Save branding' }).closest('form') as HTMLFormElement);

    expect(await screen.findByText('dashboard_update_widget_site failed')).toBeInTheDocument();
  });

  it('marks invalid URL fields and blocks submit until fixed', () => {
    const saveAction = vi.fn().mockResolvedValue(initialState);

    render(<BrandingForm initialState={initialState} saveAction={saveAction} />);

    fireEvent.change(screen.getByLabelText('Logo URL'), { target: { value: 'not-a-url' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Save branding' }).closest('form') as HTMLFormElement);

    expect(screen.getAllByText('Use valid http/https URLs for logo and avatar fields.').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Logo URL')).toHaveAttribute('aria-invalid', 'true');
    expect(saveAction).not.toHaveBeenCalled();
  });
});
