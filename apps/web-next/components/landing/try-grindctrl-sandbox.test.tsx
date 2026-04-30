import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, beforeEach } from 'vitest';
import { TryGrindctrlSandbox } from '@/components/landing/try-grindctrl-sandbox';

describe('TryGrindctrlSandbox', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('shows generated workflow result and sign-in CTAs only after generation', () => {
    render(<TryGrindctrlSandbox />);

    expect(screen.queryByRole('link', { name: /start 14-day trial/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /sign in to unlock actions/i })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/business workflow prompt/i), {
      target: { value: 'Route support messages and sync qualified leads to CRM.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /generate structured result/i }));

    expect(screen.getByText(/workflow blueprint generated/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /start 14-day trial/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sign in to unlock actions/i })).toBeInTheDocument();
  });

  it('supports voice mode and renders structured lead fields', () => {
    render(<TryGrindctrlSandbox />);

    fireEvent.click(screen.getByRole('button', { name: /voice lead capture/i }));
    fireEvent.change(screen.getByLabelText(/voice transcript/i), {
      target: { value: 'Hi I am Sara from Bright Dental and need AI lead capture support.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /generate structured result/i }));

    expect(screen.getByText(/voice lead capture complete/i)).toBeInTheDocument();
    expect(screen.getByText('company')).toBeInTheDocument();
    expect(screen.getByText(/lead_priority/i)).toBeInTheDocument();
  });

  it('supports file mode and shows locked action chips', () => {
    render(<TryGrindctrlSandbox />);

    fireEvent.click(screen.getByRole('button', { name: /file\/image intake/i }));
    const input = screen.getByLabelText(/upload one file\/image/i) as HTMLInputElement;
    const file = new File(['demo'], 'invoice.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });

    fireEvent.change(screen.getByLabelText(/intake context/i), {
      target: { value: 'Extract fields and route to finance' },
    });
    fireEvent.click(screen.getByRole('button', { name: /generate structured result/i }));

    expect(screen.getByText(/file\/image intake completed/i)).toBeInTheDocument();
    expect(screen.getByText('Sync CRM/Sheets')).toBeInTheDocument();
    expect(screen.getByText('Export report')).toBeInTheDocument();
  });

  it('blocks the fourth anonymous run inside 24h cap', () => {
    render(<TryGrindctrlSandbox />);

    const prompt = screen.getByLabelText(/business workflow prompt/i);
    const generate = screen.getByRole('button', { name: /generate structured result/i });
    fireEvent.change(prompt, { target: { value: 'Build support workflow' } });

    fireEvent.click(generate);
    fireEvent.click(generate);
    fireEvent.click(generate);
    fireEvent.click(generate);

    expect(screen.getByText(/daily anonymous sandbox cap reached/i)).toBeInTheDocument();
  });
});
