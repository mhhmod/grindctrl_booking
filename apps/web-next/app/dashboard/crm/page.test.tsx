import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DashboardCrmPage from '@/app/dashboard/crm/page';

describe('DashboardCrmPage', () => {
  it('renders crm pipeline stages and sync readiness panel', () => {
    render(<DashboardCrmPage />);

    expect(screen.getByText(/crm pipeline preview/i)).toBeInTheDocument();
    expect(screen.getByText('Captured')).toBeInTheDocument();
    expect(screen.getByText('Qualified')).toBeInTheDocument();
    expect(screen.getByText('Proposal')).toBeInTheDocument();
    expect(screen.getByText('Implementation')).toBeInTheDocument();
    expect(screen.getByText('Converted')).toBeInTheDocument();
    expect(screen.getByText(/preview-only state. no live crm sync action is executed yet/i)).toBeInTheDocument();
  });
});
