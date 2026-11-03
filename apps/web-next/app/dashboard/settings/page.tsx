import { redirect } from 'next/navigation';
import { requireDashboardUser } from '@/lib/auth/dashboard';
import { getRequestLocale } from '@/lib/auth/locale';
import { getActiveStore, getActiveStoreRole } from '@/lib/dashboard/active-store-server';
import { flagStoreOf } from '@/lib/dashboard/active-store';
import { storeFlags } from '@/lib/flags/store-flags';
import { roleCan } from '@/lib/rbac/dashboard-policy';
import { getTeamFacts } from '@/lib/dashboard/team-data';
import { buildTeamView, type TeamView } from '@/lib/dashboard/team-model';
import { getTeamCopy } from '@/lib/dashboard/team-copy';
import { V16Team, V16TeamError } from '@/components/dashboard/v16/settings/v16-team';
import { V16NoStore } from '@/components/dashboard/v16/states';
import { getShellCopy } from '@/lib/dashboard/shell-copy';
import {
  changeRoleAction,
  inviteTeammateAction,
  removeMemberAction,
  resendInviteAction,
  revokeInviteAction,
} from './actions';

export const dynamic = 'force-dynamic';

/* The v16 Settings page (04-dashboard.md), Team, for owners and admins of
   the active store. Members are sent to Today on the server, not only by the
   nav (item 12); their own alert settings come with shifts. A new account
   has no store to hold a team yet. */
export default async function SettingsPage() {
  const userId = await requireDashboardUser('/dashboard/settings');
  const activeStore = await getActiveStore();
  const flagStore = flagStoreOf(activeStore);
  const locale = await getRequestLocale();
  if (!flagStore) return <V16NoStore locale={locale} />;
  const flags = await storeFlags(flagStore);
  if (!roleCan(await getActiveStoreRole(activeStore), 'team')) redirect('/dashboard');

  // Invites, Resend and Edit (N21) come with n21_team_invites.
  const invites = flags.includes('n21_team_invites');
  let view: TeamView | null = null;
  try {
    const facts = await getTeamFacts({ userId, siteId: activeStore.siteId, shopDomain: activeStore.shopDomain, withInvites: invites });
    view = buildTeamView(facts, getTeamCopy(locale), locale);
  } catch (error) {
    console.error('[settings] team failed:', error instanceof Error ? error.message : error);
  }
  if (!view) return <V16TeamError locale={locale} />;
  if (!invites) return <V16Team view={view} locale={locale} />;
  const roles = getShellCopy(locale).roles;
  return (
    <V16Team
      view={view}
      locale={locale}
      roles={{ admin: roles.admin, member: roles.member }}
      actions={{
        invite: inviteTeammateAction,
        resend: resendInviteAction,
        revoke: revokeInviteAction,
        changeRole: changeRoleAction,
        remove: removeMemberAction,
      }}
    />
  );
}
