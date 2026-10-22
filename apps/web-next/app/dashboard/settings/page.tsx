import { redirect } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { requireDashboardUser } from '@/lib/auth/dashboard';
import { getRequestLocale } from '@/lib/auth/locale';
import { getActiveStore, getActiveStoreRole } from '@/lib/dashboard/active-store-server';
import { storeFlags } from '@/lib/flags/store-flags';
import { roleCan } from '@/lib/rbac/dashboard-policy';
import { getTeamFacts } from '@/lib/dashboard/team-data';
import { buildTeamView, type TeamView } from '@/lib/dashboard/team-model';
import { getTeamCopy } from '@/lib/dashboard/team-copy';
import { V16Team, V16TeamError } from '@/components/dashboard/v16/settings/v16-team';
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
   an active store whose v16_dashboard flag is on. Members are sent to Today
   on the server, not only by the nav (item 12); their own alert settings
   come with shifts. Every other store keeps the placeholder below. */
export default async function SettingsPage() {
  const userId = await requireDashboardUser('/dashboard/settings');
  const activeStore = await getActiveStore();
  const flagStore = activeStore.shopDomain
    ? { shopDomain: activeStore.shopDomain }
    : activeStore.siteId
      ? { widgetSiteId: activeStore.siteId }
      : null;
  const flags = flagStore ? await storeFlags(flagStore) : [];
  if (!flags.includes('v16_dashboard')) return <SettingsPlaceholder />;
  if (!roleCan(await getActiveStoreRole(activeStore), 'team')) redirect('/dashboard');

  // Invites, Resend and Edit (N21) come with n21_team_invites.
  const invites = flags.includes('n21_team_invites');
  const locale = await getRequestLocale();
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

function SettingsPlaceholder() {
  return (
    <div className="grid min-w-0 gap-4">
      <Card className="border-dashed">
        <CardHeader>
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg">Settings</CardTitle>
            <Badge variant="secondary" className="text-xs">Coming soon</Badge>
          </div>
          <CardDescription>
            Workspace configuration, team member management, API keys, and platform preferences.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-dashed bg-muted/30 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Settings panel will be available in the next platform release.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
