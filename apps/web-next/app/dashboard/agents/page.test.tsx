import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DashboardAgentsPage from '@/app/dashboard/agents/page';

describe('DashboardAgentsPage', () => {
  it('renders AI agents catalog and selected detail', async () => {
    const result = await DashboardAgentsPage({ searchParams: Promise.resolve({ agent: 'voice-lead-agent' }) });
    render(result);

    expect(screen.getByText(/ai agents hub/i)).toBeInTheDocument();
    expect(screen.getByText('Website Support Agent')).toBeInTheDocument();
    expect(screen.getAllByText('Voice Lead Agent').length).toBeGreaterThan(0);
    expect(screen.getByText(/selected agent preview/i)).toBeInTheDocument();
    expect(screen.getByText(/prospect leaves 30-second voice note requesting a proposal\./i)).toBeInTheDocument();
  });
});
