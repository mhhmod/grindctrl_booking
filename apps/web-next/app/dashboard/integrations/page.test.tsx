import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DashboardIntegrationsPage from '@/app/dashboard/integrations/page';

describe('DashboardIntegrationsPage', () => {
  it('renders grouped integration catalog with implementation CTA', async () => {
    const result = await DashboardIntegrationsPage({ searchParams: Promise.resolve({}) });
    render(result);

    expect(screen.getByText(/integrations and channels center/i)).toBeInTheDocument();
    expect(screen.getAllByText('AI Models').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Social/Chat').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: /request connection/i })[0]).toHaveAttribute('href', '/dashboard/implementation');
  });

  it('filters by selected category through query params', async () => {
    const result = await DashboardIntegrationsPage({ searchParams: Promise.resolve({ category: 'CRM' }) });
    render(result);

    expect(screen.getByRole('link', { name: /^crm$/i })).toHaveAttribute('href', '/dashboard/integrations?category=CRM');
    expect(screen.queryByText('OpenAI')).not.toBeInTheDocument();
    expect(screen.getByText('HubSpot')).toBeInTheDocument();
  });
});
