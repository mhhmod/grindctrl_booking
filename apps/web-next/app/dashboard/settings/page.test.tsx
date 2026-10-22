import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/* Settings: who may open it and what it renders. The reader, the model and
   the component have their own tests (team-data, team-model, v16-team). */
const mocks = vi.hoisted(() => ({
  redirect: vi.fn((href: string) => {
    throw new Error(`redirect:${href}`);
  }),
  user: vi.fn(),
  active: vi.fn(),
  role: vi.fn(),
  flags: vi.fn(),
  locale: vi.fn(),
  facts: vi.fn(),
}));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('@/lib/auth/dashboard', () => ({ requireDashboardUser: mocks.user }));
vi.mock('@/lib/auth/locale', () => ({ getRequestLocale: mocks.locale }));
vi.mock('@/lib/dashboard/active-store-server', () => ({ getActiveStore: mocks.active, getActiveStoreRole: mocks.role }));
vi.mock('@/lib/flags/store-flags', () => ({ storeFlags: mocks.flags }));
vi.mock('@/lib/dashboard/team-data', () => ({ getTeamFacts: mocks.facts }));
vi.mock('./actions', () => ({
  inviteTeammateAction: vi.fn(),
  resendInviteAction: vi.fn(),
  revokeInviteAction: vi.fn(),
  changeRoleAction: vi.fn(),
  removeMemberAction: vi.fn(),
}));
vi.mock('@/components/dashboard/v16/settings/v16-team', () => ({
  V16Team: ({ view, locale, actions, roles }: { view: { people: Array<{ name: string }> }; locale: string; actions?: object; roles?: object }) => (
    <div data-testid="v16-team" data-actions={actions ? Object.keys(actions).join(',') : ''} data-roles={roles ? JSON.stringify(roles) : ''}>
      {locale}:{view.people.map((person) => person.name).join(',')}
    </div>
  ),
  V16TeamError: ({ locale }: { locale: string }) => <div data-testid="v16-team-error">{locale}</div>,
}));

import SettingsPage from './page';

const SITE_ID = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.mockResolvedValue('user_123');
  mocks.active.mockResolvedValue({ shopDomain: 'maison.myshopify.com', siteId: SITE_ID });
  mocks.role.mockResolvedValue('admin');
  mocks.flags.mockResolvedValue(['v16_dashboard']);
  mocks.locale.mockResolvedValue('en');
  mocks.facts.mockResolvedValue({
    people: [{ profileId: 'p1', name: 'Hana Adel', email: 'hana@maisonnoor.com', role: 'owner' }],
    invites: null,
    site: null,
    afterHours: false,
  });
});

describe('SettingsPage', () => {
  it('shows an admin the active store’s team', async () => {
    render(await SettingsPage());
    expect(mocks.user).toHaveBeenCalledWith('/dashboard/settings');
    expect(mocks.facts).toHaveBeenCalledWith({ userId: 'user_123', siteId: SITE_ID, shopDomain: 'maison.myshopify.com', withInvites: false });
    expect(screen.getByTestId('v16-team')).toHaveTextContent('en:Hana Adel');
    expect(screen.getByTestId('v16-team')).toHaveAttribute('data-actions', '');
  });

  it('reads the invites and hands over the team actions with n21_team_invites', async () => {
    mocks.flags.mockResolvedValue(['v16_dashboard', 'n21_team_invites']);
    mocks.facts.mockResolvedValue({ people: [], invites: [], site: null, afterHours: false });
    render(await SettingsPage());
    expect(mocks.facts).toHaveBeenCalledWith(expect.objectContaining({ withInvites: true }));
    expect(screen.getByTestId('v16-team')).toHaveAttribute('data-actions', 'invite,resend,revoke,changeRole,remove');
    expect(screen.getByTestId('v16-team')).toHaveAttribute('data-roles', JSON.stringify({ admin: 'Admin', member: 'Member' }));
  });

  it('keys the flag on the site for a store without a shop', async () => {
    mocks.active.mockResolvedValue({ shopDomain: null, siteId: SITE_ID });
    render(await SettingsPage());
    expect(mocks.flags).toHaveBeenCalledWith({ widgetSiteId: SITE_ID });
    expect(screen.getByTestId('v16-team')).toBeInTheDocument();
  });

  it('keeps today’s placeholder for a store without the flag, or without a store', async () => {
    mocks.flags.mockResolvedValue([]);
    render(await SettingsPage());
    expect(screen.getByText('Coming soon')).toBeInTheDocument();
    mocks.active.mockResolvedValue({ shopDomain: null, siteId: null });
    render(await SettingsPage());
    expect(mocks.facts).not.toHaveBeenCalled();
  });

  it('sends a member to Today on the server, without reading the team', async () => {
    mocks.role.mockResolvedValue('member');
    await expect(SettingsPage()).rejects.toThrow('redirect:/dashboard');
    expect(mocks.facts).not.toHaveBeenCalled();
  });

  it('says the team could not load when the read fails', async () => {
    mocks.locale.mockResolvedValue('ar');
    mocks.facts.mockRejectedValue(new Error('timeout'));
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(await SettingsPage());
    expect(screen.getByTestId('v16-team-error')).toHaveTextContent('ar');
    expect(error).toHaveBeenCalledWith('[settings] team failed:', 'timeout');
    error.mockRestore();
  });
});
