import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

/* The page reads through Clerk + Supabase and the panel navigates on shop
   change; stub those edges so the test covers what the owner actually sees. */
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/lib/shopify/shops', () => ({
  listManagedTryOnShops: vi.fn(async () => [
    {
      domain: 'grindctrl.myshopify.com',
      status: 'installed' as const,
      installedAt: '2026-07-01T00:00:00.000Z',
      uninstalledAt: null,
      lastSeenAt: '2026-07-16T00:00:00.000Z',
      jobCount: 3,
      lastJobAt: '2026-07-16T00:00:00.000Z',
    },
  ]),
}));

vi.mock('@/lib/try-on/persistence', () => ({
  listRecentTryOnJobs: vi.fn(async () => []),
}));

import DashboardTryOnPage from '@/app/dashboard/try-on/page';

async function renderPage(shop?: string) {
  render(await DashboardTryOnPage({ searchParams: Promise.resolve({ shop }) }));
}

describe('DashboardTryOnPage', () => {
  it('shows the installed shops and the shared settings controls', async () => {
    await renderPage();

    expect(screen.getByRole('heading', { name: 'Try-On' })).toBeInTheDocument();
    expect(screen.getByText('Installed shops')).toBeInTheDocument();
    // The shop is listed in the table (it also appears as a selector option).
    expect(screen.getByRole('cell', { name: 'grindctrl.myshopify.com' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '3' })).toBeInTheDocument();

    // The same controls the Shopify admin renders, from the shared component.
    expect(screen.getByLabelText('Button label')).toHaveValue('Try it on with AI');
    expect(screen.getByLabelText('Catalog pill label')).toBeInTheDocument();
    expect(screen.getByLabelText('Button icon size')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save settings' })).toBeInTheDocument();
  });

  it('defaults to the global row and offers each installed shop', async () => {
    await renderPage();

    expect(screen.getByLabelText('Editing')).toHaveValue('default');
    expect(
      screen.getByRole('option', { name: /Global defaults/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'grindctrl.myshopify.com' }),
    ).toBeInTheDocument();
  });

  it('selects a known shop from the query string', async () => {
    await renderPage('grindctrl.myshopify.com');

    expect(screen.getByLabelText('Editing')).toHaveValue('grindctrl.myshopify.com');
  });

  // A forged or unknown shop must never become the edit target.
  it('falls back to the global row for an unknown shop', async () => {
    await renderPage('attacker.myshopify.com');

    expect(screen.getByLabelText('Editing')).toHaveValue('default');
  });
});
