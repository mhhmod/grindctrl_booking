import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ImplementationRequestForm } from '@/components/dashboard/implementation-request-form';
import { saveLandingPreviewHandoff } from '@/lib/trial/landing-preview-handoff';

describe('ImplementationRequestForm', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('validates required fields before success state', () => {
    render(<ImplementationRequestForm />);

    fireEvent.submit(screen.getByTestId('implementation-request-form'));

    expect(screen.getByText('Company name is required.')).toBeInTheDocument();
    expect(screen.getByText('Work email must be valid.')).toBeInTheDocument();
    expect(screen.getByText('Business type is required.')).toBeInTheDocument();
    expect(screen.getByText('Primary use case is required.')).toBeInTheDocument();
    expect(screen.getByText('Urgency is required.')).toBeInTheDocument();
  });

  it('shows selected preview summary when local handoff exists', () => {
    saveLandingPreviewHandoff({
      source: 'landing_sandbox',
      mode: 'workflow',
      workflowSlug: 'workflow_planner',
      summary: 'Prepared summary for implementation review.',
      confidence: 87,
      extractedEntities: { route: 'support' },
      decision: {
        route: 'support',
        priority: 'medium',
        handoffRequired: false,
      },
      recommendedAction: 'Request implementation plan.',
    });

    render(<ImplementationRequestForm />);

    expect(screen.getByText(/prepared summary for implementation review/i)).toBeInTheDocument();
    expect(screen.getByText(/workflow_planner/i)).toBeInTheDocument();
  });

  it('submits in UI-only mode without network calls', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    render(<ImplementationRequestForm />);

    fireEvent.change(screen.getByLabelText('Company name'), { target: { value: 'North Clinic' } });
    fireEvent.change(screen.getByLabelText('Work email'), { target: { value: 'ops@northclinic.example' } });
    fireEvent.change(screen.getByLabelText('Business type'), { target: { value: 'Healthcare' } });
    fireEvent.change(screen.getByLabelText('Primary use case'), { target: { value: 'Customer support' } });
    fireEvent.change(screen.getByLabelText('Urgency'), { target: { value: 'This week' } });

    fireEvent.submit(screen.getByTestId('implementation-request-form'));

    expect(screen.getByText(/implementation request prepared/i)).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
