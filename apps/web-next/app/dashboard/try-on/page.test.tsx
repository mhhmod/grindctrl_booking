import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DashboardTryOnPage from '@/app/dashboard/try-on/page';

describe('DashboardTryOnPage', () => {
  it('renders try-on management content with mock data', () => {
    render(<DashboardTryOnPage />);

    expect(screen.getByRole('heading', { name: 'Try-On Agent' })).toBeInTheDocument();
    expect(screen.getByText(/Let customers preview products on themselves before buying/i)).toBeInTheDocument();
    expect(screen.getByText('Try-ons generated')).toBeInTheDocument();
    expect(screen.getAllByText('Premium Ringer Tee').length).toBeGreaterThan(0);
    expect(screen.getByText('mock mode active')).toBeInTheDocument();
    expect(screen.getByText('Recent try-on jobs')).toBeInTheDocument();
    expect(screen.getByText('Lead capture flow')).toBeInTheDocument();
    expect(screen.getByText('Embed setup')).toBeInTheDocument();
    expect(screen.getByText('Current mode')).toBeInTheDocument();
    expect(screen.getByText('Mock')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open public demo' })).toHaveAttribute('href', '/try-on');
    expect(screen.getByRole('link', { name: 'Prepare live generation' })).toHaveAttribute('href', '/dashboard/integrations');
    expect(screen.getByRole('link', { name: 'Prepare embed widget' })).toHaveAttribute('href', '/dashboard/install');
  });
});
