import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';

vi.mock('@clerk/nextjs', () => ({
  UserButton: () => <button type="button" aria-label="User account" />,
}));

vi.mock('@/components/icons', () => ({
  Icon: () => <span aria-hidden="true" />,
}));

vi.mock('@/components/dashboard/theme-toggle', () => ({
  ThemeToggle: () => <button type="button" aria-label="Switch to light mode" />,
}));

const navItems = [
  { href: '/dashboard/overview', label: 'Overview', icon: {} as never, isActive: true, permissionKey: 'canViewOverview' as const },
  { href: '/dashboard/install', label: 'Install Widget', icon: {} as never, isActive: false, permissionKey: 'canViewInstall' as const },
];

const breadcrumbs = [
  { label: 'Dashboard', href: '/dashboard/overview' },
  { label: 'Overview' },
];

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

describe('DashboardShell', () => {
  it('renders Shadboard-style shell landmarks and top-bar account controls', () => {
    render(
      <DashboardShell navItems={navItems} breadcrumbs={breadcrumbs} title="Overview" description="Real dashboard data.">
        <section aria-label="Dashboard content">Content</section>
      </DashboardShell>,
    );

    const banner = screen.getByRole('banner');
    expect(banner).toHaveClass('sticky', 'top-0');
    expect(banner.firstElementChild).toHaveClass('h-14');
    expect(within(banner).getByRole('button', { name: 'Toggle dashboard navigation' })).toBeInTheDocument();
    expect(within(banner).getByRole('button', { name: 'Switch to light mode' })).toBeInTheDocument();
    expect(within(banner).getByRole('button', { name: 'User account' })).toBeInTheDocument();

    const sidebarNav = screen.getByRole('link', { name: /GRINDCTRL Dashboard/i }).closest('[data-sidebar="sidebar"]');
    expect(sidebarNav).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Install Widget' })).toBeInTheDocument();
    expect(screen.queryByText('Signed in')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Dashboard content')).toBeInTheDocument();
  });
});
