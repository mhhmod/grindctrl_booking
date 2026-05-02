import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TrialWorkspaceActionsCard } from '@/components/dashboard/trial-workspace-actions-card';

describe('TrialWorkspaceActionsCard', () => {
  it('renders required trial action cards and copy', () => {
    render(<TrialWorkspaceActionsCard />);

    expect(screen.getByText(/^support automation$/i)).toBeInTheDocument();
    expect(screen.getByText(/test how grindctrl can answer, classify, and route support requests/i)).toBeInTheDocument();
    expect(screen.getByText(/customer message, file, screenshot/i)).toBeInTheDocument();
    expect(screen.getByText(/answer, ticket route, human handoff/i)).toBeInTheDocument();

    expect(screen.getByText(/^lead capture$/i)).toBeInTheDocument();
    expect(screen.getByText(/turn voice notes, forms, and messages into qualified leads/i)).toBeInTheDocument();

    expect(screen.getByText(/^file\/intake automation$/i)).toBeInTheDocument();
    expect(screen.getByText(/extract useful signals from documents, invoices, and images/i)).toBeInTheDocument();

    expect(screen.getAllByText(/request implementation plan/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/want this connected to your real tools/i)).toBeInTheDocument();
  });

  it('uses required CTA destinations', () => {
    render(<TrialWorkspaceActionsCard />);

    expect(screen.getByRole('link', { name: /preview support workflow/i })).toHaveAttribute('href', '/#try-grindctrl');
    expect(screen.getByRole('link', { name: /preview lead capture/i })).toHaveAttribute('href', '/#try-grindctrl');
    expect(screen.getByRole('link', { name: /preview file intake/i })).toHaveAttribute('href', '/#try-grindctrl');
    expect(screen.getByRole('link', { name: /^request implementation plan/i })).toHaveAttribute('href', '/dashboard/implementation');
  });
});
