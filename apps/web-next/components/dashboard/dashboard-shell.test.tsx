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

/* The language toggle flips the locale cookie and then refreshes, because
   the language is resolved server-side. That needs the app router, which is
   not mounted when the shell is rendered directly. */
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

const navItems = [
  { href: '/dashboard/overview', label: 'Overview', icon: {} as never, isActive: true, permissionKey: 'canViewOverview' as const, group: 'core' as const },
  { href: '/dashboard/agents', label: 'AI Agents', icon: {} as never, isActive: false, permissionKey: 'canViewAgents' as const, group: 'core' as const },
  { href: '/dashboard/install', label: 'Widget / Embed', icon: {} as never, isActive: false, permissionKey: 'canViewInstall' as const, group: 'journey' as const },
  { href: '/dashboard/implementation', label: 'Implementation', icon: {} as never, isActive: false, permissionKey: 'canViewImplementation' as const, group: 'platform' as const },
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
  it('renders shell landmarks and top-bar account controls', () => {
    render(
      <DashboardShell navItems={navItems} breadcrumbs={breadcrumbs} title="Overview" description="Trial workspace overview.">
        <section aria-label="Dashboard content">Content</section>
      </DashboardShell>,
    );

    const banner = screen.getByRole('banner');
    expect(banner).toHaveClass('sticky', 'top-0');
    expect(banner.firstElementChild).toHaveClass('h-14');
    expect(within(banner).getByRole('button', { name: 'Toggle dashboard navigation' })).toBeInTheDocument();
    expect(within(banner).getByRole('button', { name: 'Switch to light mode' })).toBeInTheDocument();
    expect(within(banner).getByRole('button', { name: 'User account' })).toBeInTheDocument();

    const sidebarNav = screen.getByRole('link', { name: /GRINDCTRL\s*Operations Platform/i }).closest('[data-sidebar="sidebar"]');
    expect(sidebarNav).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'AI Agents' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Widget / Embed' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Implementation' })).toBeInTheDocument();
    expect(screen.getByLabelText('Dashboard content')).toBeInTheDocument();
  });
});

describe('DashboardShell sidebar direction', () => {
  /* Regression: the sidebar pins itself with `fixed` and a PHYSICAL
     left/right offset, while the spacer reserving its width sits in normal
     flow and follows the writing direction. Left them disagreeing in Arabic:
     an empty column on one side, the sidebar covering content on the other.
     `side` is what keeps the two together, so it must follow the locale. */
  it('keeps the sidebar on the left in English', () => {
    const { container } = render(
      <DashboardShell
        locale="en"
        navItems={navItems}
        breadcrumbs={breadcrumbs}
        title="Overview"
        description="Test"
      >
        <div />
      </DashboardShell>,
    );
    expect(container.querySelector('[data-slot="sidebar"]')?.getAttribute('data-side')).toBe('left');
  });

  it('moves the sidebar to the right in Arabic', () => {
    const { container } = render(
      <DashboardShell
        locale="ar"
        navItems={navItems}
        breadcrumbs={breadcrumbs}
        title="نظرة عامة"
        description="اختبار"
      >
        <div />
      </DashboardShell>,
    );
    expect(container.querySelector('[data-slot="sidebar"]')?.getAttribute('data-side')).toBe('right');
  });
});
