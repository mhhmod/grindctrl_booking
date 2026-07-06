import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TrialWorkspaceReadinessCard } from '@/components/dashboard/trial-workspace-readiness-card';

describe('TrialWorkspaceReadinessCard', () => {
  it('renders welcome badges and done-for-you lines', () => {
    render(<TrialWorkspaceReadinessCard />);

    expect(screen.getByText(/welcome to grindctrl\. your workspace is ready/i)).toBeInTheDocument();
    expect(screen.getByText(/^workspace ready$/i)).toBeInTheDocument();
    expect(screen.getByText(/^done-for-you setup$/i)).toBeInTheDocument();

    expect(screen.getByText(/we build your automations around your tools/i)).toBeInTheDocument();
    expect(screen.getByText(/we run and maintain them in production/i)).toBeInTheDocument();
    expect(screen.getByText(/you watch everything from this dashboard/i)).toBeInTheDocument();
  });

  it('renders next steps and primary CTAs', () => {
    render(<TrialWorkspaceReadinessCard />);

    expect(screen.getByText(/next steps/i)).toBeInTheDocument();
    expect(screen.getByText(/book your kickoff call so we can map your first workflow/i)).toBeInTheDocument();

    expect(screen.getByRole('link', { name: /book your kickoff call/i })).toHaveAttribute(
      'href',
      expect.stringContaining('calendar.app.google'),
    );
    expect(screen.getByRole('link', { name: /try the live demo/i })).toHaveAttribute('href', '/dashboard/try-on');
  });
});
