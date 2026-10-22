import React from 'react';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithMantine as render } from '@/components/mantine/test-utils';
import { getTeamCopy } from '@/lib/dashboard/team-copy';
import { buildTeamView, type TeamFacts } from '@/lib/dashboard/team-model';
import type { SiteLocale } from '@/lib/landing/landing-i18n';
import { V16Team, V16TeamError, type TeamActions } from './v16-team';

const FACTS: TeamFacts = {
  people: [
    { profileId: 'p1', name: 'Hana Adel', email: 'hana@maisonnoor.com', role: 'owner' },
    { profileId: 'p2', name: 'Nour Samir', email: 'nour@maisonnoor.com', role: 'member' },
  ],
  invites: null,
  site: {
    emailOnHandoff: true,
    recipients: [],
    availabilityMode: 'hours',
    availabilityTimezone: 'Africa/Cairo',
    availabilityHours: [{ day: 5, startMinute: 840, endMinute: 1320 }],
  },
  afterHours: true,
};

function renderTeam(locale: SiteLocale = 'en', facts: TeamFacts = FACTS) {
  return render(<V16Team view={buildTeamView(facts, getTeamCopy(locale), locale)} locale={locale} />);
}

describe('V16Team', () => {
  it('has Team as Settings’ one tab, under the board’s line', () => {
    renderTeam();
    expect(screen.getByText('Who works in GrindCTRL, when they’re alerted, and how shoppers reach you.')).toBeInTheDocument();
    const tabs = screen.getByRole('navigation', { name: 'Settings' });
    expect(within(tabs).getAllByRole('link').map((link) => link.textContent)).toEqual(['Team']);
    expect(within(tabs).getByRole('link', { name: 'Team' })).toHaveAttribute('aria-current', 'page');
  });

  it('lists the people with their role and email, under the rule', () => {
    renderTeam();
    const people = screen.getByRole('region', { name: 'People' });
    expect(people).toHaveTextContent('Owners see everything, including billing.');
    expect(within(people).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'HAHana Adelhana@maisonnoor.comOwner',
      'NSNour Samirnour@maisonnoor.comMember',
    ]);
    // Invites, Edit and Resend wait for N21.
    expect(screen.queryByRole('button', { name: /Invite|Edit|Resend/ })).not.toBeInTheDocument();
  });

  it('says who gets email alerts, with a way to change it in Store Chat', () => {
    renderTeam();
    expect(screen.getByText('Email alerts go to hana@maisonnoor.com when a shopper needs a person.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Change in Store Chat' })).toHaveAttribute('href', '/dashboard/store-chat/setup?tab=behaviour');
  });

  it('states the opening hours and what happens outside them', () => {
    renderTeam();
    const hours = screen.getByRole('region', { name: 'Opening hours' });
    expect(hours).toHaveTextContent('Friday 2 pm to 10 pm, Cairo time.');
    expect(hours).toHaveTextContent('Outside your opening hours nobody is alerted.');
    expect(within(hours).getByRole('link', { name: 'Change' })).toHaveAttribute('href', '/dashboard/store-chat/setup?tab=behaviour');
  });

  it('offers to open Store Chat when the store has none, with no hours', () => {
    renderTeam('en', { ...FACTS, site: null });
    expect(screen.getByText(/Store Chat isn’t set up for this store yet/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Store Chat' })).toHaveAttribute('href', '/dashboard/store-chat');
    expect(screen.queryByRole('region', { name: 'Opening hours' })).not.toBeInTheDocument();
  });

  it('speaks Arabic in Arabic, with Western digits', () => {
    const { container } = renderTeam('ar');
    expect(screen.getByRole('region', { name: 'الأشخاص' })).toHaveTextContent('المالك');
    expect(screen.getByRole('region', { name: 'ساعات العمل' })).toHaveTextContent('الجمعة من 2 م إلى 10 م، بتوقيت القاهرة.');
    expect(container.textContent).not.toMatch(/[٠-٩]/);
  });
});

describe('V16TeamError', () => {
  it('says the team could not load, in the Settings frame', () => {
    render(<V16TeamError locale="en" />);
    expect(screen.getByRole('status')).toHaveTextContent("Your team couldn't load just now. Refresh in a minute.");
    expect(screen.getByRole('navigation', { name: 'Settings' })).toBeInTheDocument();
  });
});

describe('V16Team, managing the team', () => {
  const NOW = Date.parse('2026-10-22T09:00:00Z');
  const MANAGED: TeamFacts = {
    ...FACTS,
    now: NOW,
    people: [
      { profileId: 'p1', name: 'Hana Adel', email: 'hana@maisonnoor.com', role: 'owner', you: true },
      { profileId: 'p2', name: 'Nour Samir', email: 'nour@maisonnoor.com', role: 'member' },
    ],
    invites: [
      { id: 'i1', email: 'youssef@maisonnoor.com', role: 'admin', invitedAt: new Date(NOW - 2 * 86_400_000).toISOString(), expiresAt: new Date(NOW + 5 * 86_400_000).toISOString() },
    ],
  };
  const ok = async () => ({ ok: true as const });
  const actionsWith = (over: Partial<TeamActions> = {}): TeamActions => ({
    invite: vi.fn(ok),
    resend: vi.fn(ok),
    revoke: vi.fn(ok),
    changeRole: vi.fn(ok),
    remove: vi.fn(ok),
    ...over,
  });
  const renderManaged = (actions: TeamActions, locale: SiteLocale = 'en') =>
    render(
      <V16Team
        view={buildTeamView(MANAGED, getTeamCopy(locale), locale)}
        locale={locale}
        roles={locale === 'ar' ? { admin: 'مسؤول', member: 'عضو' } : { admin: 'Admin', member: 'Member' }}
        actions={actions}
      />,
    );

  it('lists the invite as the board does, with Resend and Cancel', async () => {
    const actions = actionsWith();
    renderManaged(actions);
    const row = screen.getByText('youssef@maisonnoor.com').closest('li')!;
    expect(row).toHaveTextContent('Invited 2 days ago · Hasn’t joined yet');
    expect(row).toHaveTextContent('Admin');
    fireEvent.click(within(row).getByRole('button', { name: 'Resend the invite to youssef@maisonnoor.com' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Invite sent again to youssef@maisonnoor.com.'));
    expect(actions.resend).toHaveBeenCalledWith({ inviteId: 'i1' });
    fireEvent.click(within(row).getByRole('button', { name: 'Cancel the invite to youssef@maisonnoor.com' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Invite canceled.'));
    expect(actions.revoke).toHaveBeenCalledWith({ inviteId: 'i1' });
  });

  it('invites someone with a role, and says why when it cannot', async () => {
    const invite = vi
      .fn<TeamActions['invite']>()
      .mockResolvedValueOnce({ ok: false, error: 'already_member' })
      .mockResolvedValueOnce({ ok: true });
    renderManaged(actionsWith({ invite }));
    fireEvent.click(screen.getByRole('button', { name: 'Invite someone' }));
    const dialog = await screen.findByRole('dialog', { name: 'Invite someone' });
    fireEvent.change(within(dialog).getByLabelText(/Email/), { target: { value: 'Reem@MaisonNoor.com' } });
    fireEvent.click(within(dialog).getByRole('radio', { name: /Admin/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send invite' }));
    expect(await within(dialog).findByText('They’re already on your team.')).toBeInTheDocument();
    expect(invite).toHaveBeenLastCalledWith({ email: 'Reem@MaisonNoor.com', role: 'admin' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send invite' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Invite sent to reem@maisonnoor.com.'));
  });

  it('offers Edit on a teammate, not on the owner who is reading, to change the role or remove them', async () => {
    const actions = actionsWith();
    renderManaged(actions);
    expect(screen.queryByRole('button', { name: 'Edit Hana Adel' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Nour Samir' }));
    let dialog = await screen.findByRole('dialog', { name: 'Edit Nour Samir' });
    expect(within(dialog).getByRole('radio', { name: /Member/ })).toBeChecked();
    fireEvent.click(within(dialog).getByRole('radio', { name: /Admin/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(actions.changeRole).toHaveBeenCalledWith({ profileId: 'p2', role: 'admin' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Saved.'));

    fireEvent.click(screen.getByRole('button', { name: 'Edit Nour Samir' }));
    dialog = await screen.findByRole('dialog', { name: 'Edit Nour Samir' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove from the team' }));
    expect(within(dialog).getByText('Remove Nour Samir? They lose access to this store’s dashboard.')).toBeInTheDocument();
    expect(actions.remove).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(actions.remove).toHaveBeenCalledWith({ profileId: 'p2' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Nour Samir is no longer on the team.'));
  });

  it('shows none of it without the actions, as while the flag is off', () => {
    render(<V16Team view={buildTeamView(MANAGED, getTeamCopy('en'), 'en')} locale="en" />);
    expect(screen.queryByRole('button', { name: /Invite someone|Edit|Resend/ })).not.toBeInTheDocument();
    expect(screen.queryByText('youssef@maisonnoor.com')).not.toBeInTheDocument();
  });

  it('speaks Arabic in Arabic', async () => {
    renderManaged(actionsWith(), 'ar');
    expect(screen.getByRole('button', { name: 'ادعُ شخصاً' })).toBeInTheDocument();
    expect(screen.getByText('youssef@maisonnoor.com').closest('li')).toHaveTextContent('أُرسلت الدعوة قبل يومين · لم ينضم بعد');
    expect(screen.getByRole('button', { name: 'تعديل Nour Samir' })).toHaveTextContent('تعديل');
  });
});
