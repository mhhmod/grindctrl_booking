import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TrialWorkspaceReadinessCard } from '@/components/dashboard/trial-workspace-readiness-card';

describe('TrialWorkspaceReadinessCard', () => {
  it('renders trial status badges and readiness lines', () => {
    render(<TrialWorkspaceReadinessCard />);

    expect(screen.getByText(/your grindctrl trial workspace is ready/i)).toBeInTheDocument();
    expect(screen.getByText(/preview active/i)).toBeInTheDocument();
    expect(screen.getByText(/ready to connect/i)).toBeInTheDocument();
    expect(screen.getByText(/^implementation-ready$/i)).toBeInTheDocument();

    expect(screen.getByText(/^14-day trial$/i)).toBeInTheDocument();
    expect(screen.getByText(/^guided previews ready$/i)).toBeInTheDocument();
    expect(screen.getByText(/^implementation-ready workflows$/i)).toBeInTheDocument();
    expect(screen.getByText(/^connect tools later$/i)).toBeInTheDocument();
  });

  it('renders review checklist items', () => {
    render(<TrialWorkspaceReadinessCard />);

    expect(screen.getByText(/review checklist/i)).toBeInTheDocument();
    expect(screen.getByText(/^try a landing preview$/i)).toBeInTheDocument();
    expect(screen.getByText(/^sign up$/i)).toBeInTheDocument();
    expect(screen.getByText(/^review saved workflow preview$/i)).toBeInTheDocument();
    expect(screen.getByText(/^explore agents \/ conversations \/ leads$/i)).toBeInTheDocument();
    expect(screen.getByText(/^copy widget snippet$/i)).toBeInTheDocument();
    expect(screen.getByText(/^request implementation plan$/i)).toBeInTheDocument();
  });
});
