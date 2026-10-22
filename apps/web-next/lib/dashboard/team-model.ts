/* What the v16 Settings page's Team tab shows (04-dashboard.md, the Team
   board), from the store's team, its invites, its Store Chat alert
   settings and its opening hours. Invite someone, the invited rows with
   Resend, and Edit come with n21_team_invites (N21). Left out until their
   back ends exist, rather than guessed: the WhatsApp alert lines and Shifts
   and alerts (N22), and the WhatsApp card (N19). */

import { intlLocale } from '@/lib/copy/rules';
import { cityTime } from '@/components/messenger/panel-state';
import type { AvailabilityHours, AvailabilityMode } from '@/lib/messenger/types';
import type { DashboardWorkspaceRole } from '@/lib/rbac/dashboard-policy';
import type { InviteRole, TeamInvite } from '@/lib/team/invites';
import type { SiteLocale } from '@/lib/landing/landing-i18n';
import { getShellCopy } from './shell-copy';
import type { TeamCopy } from './team-copy';

export type TeamPerson = {
  profileId: string;
  name: string | null;
  /** A real address; the reader leaves out Clerk's placeholders. */
  email: string | null;
  role: DashboardWorkspaceRole;
  /** The person reading the page. */
  you?: boolean;
};

export type TeamFacts = {
  now?: number;
  people: TeamPerson[];
  /** Pending invites, or null while n21_team_invites is off. */
  invites: TeamInvite[] | null;
  /** The store's Store Chat site, or null when it has none. */
  site: {
    emailOnHandoff: boolean;
    /** The addresses Store Chat was given; empty means the owners and admins. */
    recipients: string[];
    availabilityMode: AvailabilityMode;
    availabilityTimezone: string;
    availabilityHours: AvailabilityHours[];
  } | null;
  /** n23_after_hours is on: outside the hours nobody is alerted. */
  afterHours: boolean;
};

export type TeamView = {
  /** Invite someone, Resend and Edit (n21_team_invites). */
  manage: boolean;
  people: Array<{
    key: string;
    name: string;
    email: string | null;
    role: string;
    roleKey: DashboardWorkspaceRole;
    owner: boolean;
    initials: string;
    /** Edit is offered: not the owner, and not the person reading. */
    editable: boolean;
  }>;
  invites: Array<{ id: string; email: string; role: string; roleKey: InviteRole; sent: string; expired: boolean }>;
  alerts: string | null;
  hours: string | null;
  outsideHours: boolean;
};

const ROLE_ORDER: Record<DashboardWorkspaceRole, number> = { owner: 0, admin: 1, member: 2 };
const DAY = 86_400_000;
/** The board's week, Saturday first; 0 is Sunday, as the hours store it. */
const WEEK = [6, 0, 1, 2, 3, 4, 5];

function initials(name: string): string {
  const words = name.replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean);
  return ((words[0]?.[0] ?? '') + (words[1]?.[0] ?? '')).toUpperCase() || '?';
}

function dayName(day: number, locale: SiteLocale): string {
  // 18 October 2026 is a Sunday.
  return new Intl.DateTimeFormat(locale === 'ar' ? intlLocale('ar') : 'en-GB', { weekday: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(2026, 9, 18 + day)),
  );
}

/** The real addresses Store Chat alerts: the ones it was given, else the
 *  owners and admins, as notify.ts resolves them. */
function alertAddresses(people: TeamPerson[], recipients: string[]): string[] {
  const given = recipients.map((address) => address.trim().toLowerCase()).filter(Boolean);
  if (given.length > 0) return [...new Set(given)];
  const team = people
    .filter((person) => person.role === 'owner' || person.role === 'admin')
    .map((person) => person.email?.trim().toLowerCase() ?? '')
    .filter(Boolean);
  return [...new Set(team)];
}

/** "Saturday to Thursday 10 am to 10 pm, Friday 2 pm to 10 pm, Cairo time." */
export function describeHours(hours: AvailabilityHours[], timeZone: string, copy: TeamCopy, locale: SiteLocale): string {
  const spansOf = (day: number) =>
    hours
      .filter((window) => window.day === day)
      .sort((a, b) => a.startMinute - b.startMinute)
      .map((window) => copy.span(copy.time(window.startMinute), copy.time(window.endMinute)));
  const runs: Array<{ days: number[]; spans: string[] }> = [];
  for (const day of WEEK) {
    const spans = spansOf(day);
    if (spans.length === 0) continue;
    const last = runs[runs.length - 1];
    const follows = last && WEEK.indexOf(last.days[last.days.length - 1]) === WEEK.indexOf(day) - 1;
    if (follows && last.spans.join('|') === spans.join('|')) last.days.push(day);
    else runs.push({ days: [day], spans });
  }
  const parts = runs.map((run, i) =>
    copy.hoursRun(
      copy.dayRun(dayName(run.days[0], locale), dayName(run.days[run.days.length - 1], locale), run.days.length),
      copy.list(run.spans),
      i === 0,
    ),
  );
  return copy.hoursSentence(parts, cityTime(timeZone, locale));
}

export function buildTeamView(facts: TeamFacts, copy: TeamCopy, locale: SiteLocale): TeamView {
  const roles = getShellCopy(locale).roles;
  const now = facts.now ?? Date.now();
  const manage = facts.invites !== null;
  const people = [...facts.people]
    .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || (a.name ?? a.email ?? '').localeCompare(b.name ?? b.email ?? ''))
    .map((person) => {
      const name = person.name?.trim() || person.email?.trim() || '';
      return {
        key: person.profileId,
        name,
        email: person.name?.trim() && person.email ? person.email : null,
        role: roles[person.role],
        roleKey: person.role,
        owner: person.role === 'owner',
        initials: initials(name),
        editable: manage && person.role !== 'owner' && !person.you,
      };
    })
    .filter((person) => person.name);

  const site = facts.site;
  let alerts: string | null = null;
  let hours: string | null = null;
  if (site) {
    const addresses = alertAddresses(facts.people, site.recipients);
    alerts = !site.emailOnHandoff
      ? copy.alertsOff
      : addresses.length
        ? copy.alertsTo(copy.list(addresses))
        : copy.alertsNobody;
    hours =
      site.availabilityMode === 'always'
        ? copy.hoursAlways
        : site.availabilityHours.length
          ? describeHours(site.availabilityHours, site.availabilityTimezone, copy, locale)
          : copy.hoursNone;
  }

  const invites = (facts.invites ?? []).map((invite) => {
    const expired = Date.parse(invite.expiresAt) <= now;
    return {
      id: invite.id,
      email: invite.email,
      role: roles[invite.role],
      roleKey: invite.role,
      sent: expired ? copy.inviteExpired : copy.invitedAgo(Math.max(0, Math.floor((now - Date.parse(invite.invitedAt)) / DAY))),
      expired,
    };
  });

  return {
    manage,
    people,
    invites,
    alerts,
    hours,
    outsideHours: Boolean(site && facts.afterHours && site.availabilityMode === 'hours' && site.availabilityHours.length),
  };
}
