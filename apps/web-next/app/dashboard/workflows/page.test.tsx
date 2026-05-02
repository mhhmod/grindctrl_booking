import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import DashboardWorkflowsPage from '@/app/dashboard/workflows/page';

describe('DashboardWorkflowsPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders workflow catalog and empty preview history state', () => {
    render(<DashboardWorkflowsPage />);

    expect(screen.getByText(/workflow catalog/i)).toBeInTheDocument();
    expect(screen.getByText(/latest trial preview/i)).toBeInTheDocument();
    expect(screen.getByText(/no saved preview yet/i)).toBeInTheDocument();
  });
});
