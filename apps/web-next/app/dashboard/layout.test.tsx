import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/* The dashboard layout's gate (N21): someone a team invited joins it on
   their first visit, and a team member is not sent to the questions about a
   store of their own. The shells have their own tests. */
const mocks = vi.hoisted(() => ({
  redirect: vi.fn((href: string) => {
    throw new Error(`redirect:${href}`);
  }),
  onboarded: vi.fn(async () => true),
  memberships: vi.fn(async (): Promise<unknown[]> => []),
  accept: vi.fn(async (): Promise<string[]> => []),
}));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('next/headers', () => ({ headers: async () => ({ get: () => '/dashboard' }) }));
vi.mock('@/lib/auth/dashboard', () => ({ requireDashboardUser: vi.fn(async () => 'user_1') }));
vi.mock('@/lib/auth/locale', () => ({ getRequestLocale: vi.fn(async () => 'en') }));
vi.mock('@/lib/onboarding/profile', () => ({ hasCompletedOnboarding: mocks.onboarded }));
vi.mock('@/lib/rbac/store-role', () => ({ listTeamMemberships: mocks.memberships }));
vi.mock('@/lib/team/accept', () => ({ acceptInvitesForSignedIn: mocks.accept }));
vi.mock('@/lib/dashboard/active-store-server', () => ({
  getActiveStore: vi.fn(async () => ({ shopDomain: null, siteId: null })),
  getActiveStoreRole: vi.fn(async () => 'member'),
}));
vi.mock('@/lib/messenger/provisioning', () => ({ listMessengerSiteIdsReadOnly: vi.fn(async () => []) }));
vi.mock('@/lib/messenger/conversations', () => ({ countAwaitingHandoff: vi.fn(async () => 0) }));
vi.mock('@/lib/flags/store-flags', () => ({ storeFlags: vi.fn(async () => []) }));
vi.mock('@/lib/dashboard/shell-data', () => ({ getV16ShellData: vi.fn() }));
vi.mock('@/components/dashboard/v16/v16-shell', () => ({ V16Shell: () => null }));
vi.mock('@/components/dashboard/dashboard-shell', () => ({
  DashboardShell: ({ children }: { children: React.ReactNode }) => <div data-testid="shell">{children}</div>,
}));
vi.mock('@/components/mantine/provider', () => ({ MantineUiProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

import DashboardLayout from './layout';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.onboarded.mockResolvedValue(true);
  mocks.memberships.mockResolvedValue([]);
});

describe('DashboardLayout', () => {
  it('accepts waiting invites before anything else', async () => {
    render(await DashboardLayout({ children: <p>Page</p> }));
    expect(mocks.accept).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('shell')).toHaveTextContent('Page');
  });

  it('sends someone who has not onboarded and is on no team to onboarding', async () => {
    mocks.onboarded.mockResolvedValue(false);
    await expect(DashboardLayout({ children: <p>Page</p> })).rejects.toThrow('redirect:/onboarding');
  });

  it('lets a team member in without onboarding a store of their own', async () => {
    mocks.onboarded.mockResolvedValue(false);
    mocks.memberships.mockResolvedValue([{ workspaceId: 'ws_1', ownerClerkUserId: 'user_owner', role: 'member' }]);
    render(await DashboardLayout({ children: <p>Page</p> }));
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(screen.getByTestId('shell')).toBeInTheDocument();
  });
});
