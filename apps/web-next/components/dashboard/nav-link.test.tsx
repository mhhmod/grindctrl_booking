import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { DashboardSidebarNav } from '@/components/dashboard/nav-link';
import { SidebarProvider } from '@/components/ui/sidebar';
import type { DashboardResolvedNavItem } from '@/lib/dashboard/nav-config';

/* Regression: app/dashboard/layout.tsx only computes the waiting-count badge
   once per full page load, and Next.js reuses that layout's server render
   across client-side navigation between routes sharing it (see
   lib/dashboard/use-route-meta.ts) — so a merchant who clears the queue, or
   gets a new handoff mid-session, saw the same stale number all session.
   These pin: the server count renders immediately (no flash of "no badge"),
   and a client-side refresh replaces it once the fetch resolves. */

vi.mock('@/components/icons', () => ({
  Icon: () => <span aria-hidden="true" />,
}));

let mockPathname = '/dashboard/messenger';
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

const navItems: DashboardResolvedNavItem[] = [
  {
    href: '/dashboard/overview',
    label: 'Overview',
    icon: {} as never,
    isActive: false,
    permissionKey: 'canViewOverview',
    group: 'core',
  },
  {
    href: '/dashboard/messenger',
    label: 'Store Chat',
    icon: {} as never,
    isActive: true,
    permissionKey: 'canViewMessenger',
    group: 'core',
    badgeCount: 3,
  },
];

beforeEach(() => {
  mockPathname = '/dashboard/messenger';
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

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderNav(items: DashboardResolvedNavItem[] = navItems) {
  return render(
    <SidebarProvider defaultOpen>
      <DashboardSidebarNav navItems={items} />
    </SidebarProvider>,
  );
}

describe('DashboardSidebarNav waiting badge', () => {
  it('renders the server-computed count immediately, then refreshes it after a client fetch', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ count: 7 }) })),
    );

    renderNav();

    // Seeded from the prop before the fetch has any chance to resolve.
    expect(screen.getByRole('status')).toHaveTextContent('3');

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('7');
    });
    expect(fetch).toHaveBeenCalledWith('/api/dashboard/store-chat-waiting');
  });

  it('keeps the last count when the refresh fetch fails — a badge must never break the shell', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('network down'))));

    renderNav();

    expect(screen.getByRole('status')).toHaveTextContent('3');
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(screen.getByRole('status')).toHaveTextContent('3');
  });

  it('does not fetch when Store Chat is not in the nav (no permission)', async () => {
    vi.stubGlobal('fetch', vi.fn());

    renderNav([navItems[0]]);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
});
