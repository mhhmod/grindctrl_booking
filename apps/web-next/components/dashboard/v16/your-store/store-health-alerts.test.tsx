import React from 'react';
import { act, fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithMantine } from '@/components/mantine/test-utils';
import { StoreHealthAlerts } from './store-health-alerts';

describe('Store check alert preference', () => {
  it('has a labelled switch at #alerts, locks during saving and keeps success', async () => {
    let resolve!: (value: { ok: boolean }) => void;
    const save = vi.fn(() => new Promise<{ ok: boolean }>((done) => { resolve = done; }));
    renderWithMantine(<StoreHealthAlerts siteId="site-1" enabled save={save} locale="en" canChange />);
    const control = screen.getByRole('switch', { name: 'Email me when something stops working' });
    expect(control.closest('#alerts')).toBeTruthy();
    fireEvent.click(control);
    expect(save).toHaveBeenCalledWith('site-1', false); expect(control).toBeDisabled(); expect(control).not.toBeChecked();
    await act(async () => resolve({ ok: true }));
    expect(control).toBeEnabled(); expect(control).not.toBeChecked();
  });
  it('restores the previous value and shows a localized error when saving fails', async () => {
    renderWithMantine(<StoreHealthAlerts siteId="site-1" enabled save={async () => ({ ok: false })} locale="ar" canChange />);
    const control = screen.getByRole('switch', { name: 'أرسل لي بريدًا عندما يتوقف شيء عن العمل' });
    await act(async () => fireEvent.click(control));
    expect(control).toBeChecked(); expect(screen.getByRole('alert')).toBeInTheDocument();
  });
  it('disables the switch for members', () => {
    renderWithMantine(<StoreHealthAlerts siteId="site-1" enabled={false} save={vi.fn()} locale="en" canChange={false} />);
    expect(screen.getByRole('switch')).toBeDisabled();
  });
});
