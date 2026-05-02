import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DashboardImplementationPage from '@/app/dashboard/implementation/page';

describe('DashboardImplementationPage', () => {
  it('renders implementation request form shell', () => {
    render(<DashboardImplementationPage />);

    expect(screen.getByText(/^implementation request$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /prepare implementation request/i })).toBeInTheDocument();
  });
});
