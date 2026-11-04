import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/* The dashboard layout: someone a team invited joins it on their first visit
   (N21), a team member is not sent to the questions about a store of their
   own, and everyone gets the one v16 shell, with or without a store. The
   shell and the states have their own tests. */
const mocks = vi.hoisted(() => ({
  redirect: vi.fn((href: string) => {
    throw new Error(`redirect:${href}`);
  }),
  onboarded: vi.fn(async () => true),
  memberships: vi.fn(async (): Promise<unknown[]> => []),
  accept: vi.fn(async (): Promise<string[]> => []),
  active: vi.fn(),
  lookupFailed: vi.fn(async () => false),
  shell: vi.fn(),
}));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('next/headers', () => ({ headers: async () => ({ get: () => '/dashboard' }) }));
vi.mock('@/lib/auth/dashboard', () => ({ requireDashboardUser: vi.fn(async () => 'user_1') }));
vi.mock('@/lib/auth/locale', () => ({ getRequestLocale: vi.fn(async () => 'en') }));
vi.mock('@/lib/onboarding/profile', () => ({ hasCompletedOnboarding: mocks.onboarded }));
vi.mock('@/lib/rbac/store-role', () => ({ listTeamMemberships: mocks.memberships }));
vi.mock('@/lib/team/accept', () => ({ acceptInvitesForSignedIn: mocks.accept }));
vi.mock('@/lib/dashboard/active-store-server', () => ({
  getActiveStore: mocks.active,
  getActiveStoreRole: vi.fn(async () => 'owner'),
  ensureActiveStorePlan: vi.fn(async () => undefined),
  storeLookupFailed: mocks.lookupFailed,
}));
vi.mock('@/lib/messenger/provisioning', () => ({ listMessengerSiteIdsReadOnly: vi.fn(async () => []) }));
vi.mock('@/lib/messenger/conversations', () => ({ countAwaitingHandoff: vi.fn(async () => 0) }));
vi.mock('@/lib/dashboard/shell-data', () => ({ getV16ShellData: vi.fn(async () => ({ stores: [], meter: null, person: { name: 'Hana', role: 'owner' }, today: { date: '', greeting: '' } })) }));
vi.mock('@/components/dashboard/v16/v16-shell', () => ({
  V16Shell: (props: { hasTenant?: boolean; children: React.ReactNode }) => {
    mocks.shell(props);
    return <div data-testid="v16-shell">{props.children}</div>;
  },
}));
vi.mock('@/components/dashboard/v16/states', () => ({
  V16StoreLookupFailed: ({ locale }: { locale: string }) => <div data-testid="lookup-failed">{locale}</div>,
}));
vi.mock('@/components/mantine/provider', () => ({ MantineUiProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

import DashboardLayout from './layout';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.onboarded.mockResolvedValue(true);
  mocks.memberships.mockResolvedValue([]);
  mocks.lookupFailed.mockResolvedValue(false);
  mocks.active.mockResolvedValue({ shopDomain: null, siteId: null });
});

describe('DashboardLayout', () => {
  it('accepts waiting invites before anything else', async () => {
    render(await DashboardLayout({ children: <p>Page</p> }));
    expect(mocks.accept).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('v16-shell')).toHaveTextContent('Page');
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
    expect(screen.getByTestId('v16-shell')).toBeInTheDocument();
  });
});

/* There is no second shell: the old one is gone, and the v16 shell no longer
   depends on a store or a flag. */
describe('DashboardLayout shell', () => {
  it.each([
    ['a Shopify store', { shopDomain: 'maison.myshopify.com', siteId: 'site_1' }, true],
    ['a paired WooCommerce store', { shopDomain: null, siteId: 'site_3', tenantKey: 'site:11111111-1111-4111-8111-111111111111', platform: 'woocommerce' }, true],
    ['a Store Chat site on another website', { shopDomain: null, siteId: 'site_2' }, false],
    ['no store yet', { shopDomain: null, siteId: null }, false],
  ])('draws the v16 shell and the page for %s', async (_name, store, hasTenant) => {
    mocks.active.mockResolvedValue(store);
    render(await DashboardLayout({ children: <p>Page</p> }));
    expect(screen.getByTestId('v16-shell')).toHaveTextContent('Page');
    expect(screen.queryByTestId('lookup-failed')).not.toBeInTheDocument();
    expect(mocks.shell).toHaveBeenCalledWith(expect.objectContaining({ hasTenant, permissions: expect.any(Object) }));
  });

  it('shows a retry in the shell, not the page and not the empty-account screens, when the stores could not be read', async () => {
    mocks.lookupFailed.mockResolvedValue(true);
    render(await DashboardLayout({ children: <p>Page</p> }));
    expect(screen.getByTestId('v16-shell')).toContainElement(screen.getByTestId('lookup-failed'));
    expect(screen.getByTestId('lookup-failed')).toHaveTextContent('en');
    expect(screen.queryByText('Page')).not.toBeInTheDocument();
  });
});
