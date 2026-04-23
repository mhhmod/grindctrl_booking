import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DomainsManager } from '@/components/dashboard/domains-manager';
import type { DomainsState } from '@/app/dashboard/domains/actions';

const initialState: DomainsState = {
  domains: [
    {
      id: 'domain_1',
      widget_site_id: 'site_1',
      domain: 'example.com',
      verification_status: 'pending',
    },
  ],
  message: null,
  messageType: null,
  fieldError: null,
};

describe('DomainsManager', () => {
  it('shows inline validation and supports add/remove interaction flows', async () => {
    const addDomainAction = vi.fn().mockResolvedValue({
      ...initialState,
      domains: [...initialState.domains, { id: 'domain_2', widget_site_id: 'site_1', domain: 'grindctrl.com', verification_status: 'pending' }],
      message: 'Added grindctrl.com.',
      messageType: 'success',
      fieldError: null,
    });
    const updateDomainStatusAction = vi.fn().mockResolvedValue(initialState);
    const removeDomainAction = vi.fn().mockResolvedValue({
      ...initialState,
      domains: [],
      message: 'Domain removed.',
      messageType: 'success',
      fieldError: null,
    });

    render(
      <DomainsManager
        initialState={initialState}
        addDomainAction={addDomainAction}
        updateDomainStatusAction={updateDomainStatusAction}
        removeDomainAction={removeDomainAction}
        allowLocalhost={true}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('example.com'), { target: { value: 'https://bad-domain' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add domain' }));
    expect(screen.getByText('Enter a valid hostname like example.com.')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('example.com'), { target: { value: 'grindctrl.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add domain' }));

    await waitFor(() => expect(addDomainAction).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText('Added grindctrl.com.')).toBeInTheDocument());
    expect(screen.getByText('grindctrl.com')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[1]);
    await waitFor(() => expect(removeDomainAction).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText('Domain removed.')).toBeInTheDocument());
  });

  it('shows saving state during status updates', async () => {
    let resolveUpdate: ((value: DomainsState) => void) | undefined;
    const updateDomainStatusAction = vi.fn(
      () =>
        new Promise<DomainsState>((resolve) => {
          resolveUpdate = resolve;
        }),
    );

    render(
      <DomainsManager
        initialState={initialState}
        addDomainAction={vi.fn().mockResolvedValue(initialState)}
        updateDomainStatusAction={updateDomainStatusAction}
        removeDomainAction={vi.fn().mockResolvedValue(initialState)}
        allowLocalhost={true}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save status' }));
    expect(await screen.findByText('Saving domain changes...')).toBeInTheDocument();

    await act(async () => {
      resolveUpdate?.({
        ...initialState,
        domains: [{ ...initialState.domains[0], verification_status: 'verified' }],
        message: 'Domain status updated.',
        messageType: 'success',
        fieldError: null,
      });
    });

    await waitFor(() => expect(screen.getByText('Domain status updated.')).toBeInTheDocument());
    expect(screen.getByLabelText('Status')).toHaveValue('verified');
  });
});
