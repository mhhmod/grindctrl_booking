import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DashboardTryOnPage from '@/app/dashboard/try-on/page';

describe('DashboardTryOnPage', () => {
  it('renders journey settings, install, and job history sections', async () => {
    render(await DashboardTryOnPage());

    expect(screen.getByRole('heading', { name: 'Try-On Agent' })).toBeInTheDocument();

    // Journey settings form with current values
    expect(screen.getByText('Journey settings')).toBeInTheDocument();
    expect(screen.getByLabelText('Button label')).toHaveValue('Try it on with AI');
    expect(screen.getByLabelText(/Loading steps/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save settings' })).toBeInTheDocument();

    // Shopify one-click install
    expect(screen.getByText('Shopify install')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add block to product page' })).toHaveAttribute(
      'href',
      expect.stringContaining('addAppBlockId='),
    );

    // Jobs section (empty in test env: no Supabase creds)
    expect(screen.getByText('Recent try-on jobs')).toBeInTheDocument();

    expect(screen.getByRole('link', { name: 'Open public demo' })).toHaveAttribute('href', '/try-on');
    expect(screen.getByRole('link', { name: 'Open embed preview' })).toHaveAttribute('href', '/embed/try-on');
  });
});
