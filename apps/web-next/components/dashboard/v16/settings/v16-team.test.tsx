import React from 'react';
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithMantine as render } from '@/components/mantine/test-utils';
import { getTeamCopy } from '@/lib/dashboard/team-copy';
import { buildTeamView, type TeamFacts } from '@/lib/dashboard/team-model';
import type { SiteLocale } from '@/lib/landing/landing-i18n';
import { V16Team, V16TeamError } from './v16-team';

const FACTS: TeamFacts = {
  people: [
    { profileId: 'p1', name: 'Hana Adel', email: 'hana@maisonnoor.com', role: 'owner' },
    { profileId: 'p2', name: 'Nour Samir', email: 'nour@maisonnoor.com', role: 'member' },
  ],
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
