import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DashboardLeadsPage from '@/app/dashboard/leads/page';

describe('DashboardLeadsPage', () => {
  it('renders leads preview table with required statuses', () => {
    render(<DashboardLeadsPage />);

    expect(screen.getByText(/leads preview/i)).toBeInTheDocument();
    expect(screen.getByText(/crm-ready preview/i)).toBeInTheDocument();
    expect(screen.getByText('Qualified')).toBeInTheDocument();
    expect(screen.getByText('Needs follow-up')).toBeInTheDocument();
    expect(screen.getByText('Implementation requested')).toBeInTheDocument();
    expect(screen.getByText('Closed')).toBeInTheDocument();
  });
});
