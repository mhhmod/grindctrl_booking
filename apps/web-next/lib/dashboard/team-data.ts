import 'server-only';

import { getMessengerServiceClient } from '@/lib/messenger/db';
import { isPlaceholderEmail } from '@/lib/messenger/emails';
import { requireSiteAccess } from '@/lib/messenger/provisioning';
import { resolveMessengerConfig } from '@/lib/messenger/config';
import { flagStoreForSite, storeFlags } from '@/lib/flags/store-flags';
import { normalizeDashboardWorkspaceRole } from '@/lib/rbac/dashboard-policy';
import { listPendingInvites } from '@/lib/team/invites';
import type { TeamFacts, TeamPerson } from './team-model';

type MemberRow = {
  profile_id: string;
  role: string | null;
  profiles: { first_name?: string | null; last_name?: string | null; email?: string | null; clerk_user_id?: string | null } | null;
};

/** The workspace of the account that owns a Shopify shop: its team. */
async function shopWorkspaceId(shopDomain: string): Promise<string | null> {
  const supabase = getMessengerServiceClient();
  const shop = await supabase.from('tryon_shops').select('owner_clerk_user_id').eq('shop_domain', shopDomain).maybeSingle();
  if (shop.error) throw new Error(shop.error.message);
  const owner = (shop.data as { owner_clerk_user_id: string | null } | null)?.owner_clerk_user_id;
  if (!owner) return null;
  const workspace = await supabase
    .from('workspaces')
    .select('id, profiles!inner(clerk_user_id)')
    .eq('profiles.clerk_user_id', owner)
    .limit(1)
    .maybeSingle();
  if (workspace.error) throw new Error(workspace.error.message);
  return (workspace.data as { id: string } | null)?.id ?? null;
}

/** Everyone the workspace lists, with their role and a real address, and
 *  which of them is the person reading. */
async function readPeople(workspaceId: string, userId: string): Promise<TeamPerson[]> {
  const result = await getMessengerServiceClient()
    .from('workspace_members')
    .select('profile_id, role, profiles(first_name, last_name, email, clerk_user_id)')
    .eq('workspace_id', workspaceId);
  if (result.error) throw new Error(result.error.message);
  const people: TeamPerson[] = [];
  for (const row of (result.data ?? []) as unknown as MemberRow[]) {
    const role = normalizeDashboardWorkspaceRole(row.role);
    if (!role) continue;
    const name = [row.profiles?.first_name?.trim(), row.profiles?.last_name?.trim()].filter(Boolean).join(' ');
    const email = row.profiles?.email?.trim() ?? '';
    people.push({
      profileId: row.profile_id,
      name: name || null,
      email: email && !isPlaceholderEmail(email) ? email : null,
      role,
      you: row.profiles?.clerk_user_id === userId,
    });
  }
  return people;
}

/* The facts behind the v16 Team tab for the active store. A store's team is
   its owner's workspace (lib/rbac/store-role.ts): through its Store Chat
   site, after checking the person may manage the team there (item 12), or,
   for a shop without a site, through the shop's owner, which the page has
   already checked the person's role on. A failure throws, and the page says
   so. */
export async function getTeamFacts({
  userId,
  siteId,
  shopDomain,
  withInvites = false,
}: {
  userId: string;
  siteId: string | null;
  shopDomain: string | null;
  /** n21_team_invites is on: read the pending invites too. */
  withInvites?: boolean;
}): Promise<TeamFacts> {
  if (siteId) {
    const site = await requireSiteAccess(userId, siteId, 'team');
    const config = resolveMessengerConfig(site.settings_json);
    const [people, flags, invites] = await Promise.all([
      readPeople(site.workspace_id, userId),
      storeFlags(flagStoreForSite(site)),
      withInvites ? listPendingInvites(site.workspace_id) : null,
    ]);
    return {
      people,
      invites,
      site: {
        emailOnHandoff: config.notifications.emailOnHandoff,
        recipients: config.notifications.recipients,
        availabilityMode: config.behaviour.availabilityMode,
        availabilityTimezone: config.behaviour.availabilityTimezone,
        availabilityHours: config.behaviour.availabilityHours,
      },
      afterHours: flags.includes('n23_after_hours'),
    };
  }
  const workspaceId = shopDomain ? await shopWorkspaceId(shopDomain) : null;
  const [people, invites] = workspaceId
    ? await Promise.all([readPeople(workspaceId, userId), withInvites ? listPendingInvites(workspaceId) : null])
    : [[], withInvites ? [] : null];
  return { people, invites, site: null, afterHours: false };
}

/** The workspace that is the active store's team, for the team actions:
 *  through the site after checking the person may manage the team there,
 *  or the shop owner's for a shop without a site (the caller has checked
 *  the person's role on the shop). */
export async function teamWorkspaceId({
  userId,
  siteId,
  shopDomain,
}: {
  userId: string;
  siteId: string | null;
  shopDomain: string | null;
}): Promise<string | null> {
  if (siteId) return (await requireSiteAccess(userId, siteId, 'team')).workspace_id;
  return shopDomain ? shopWorkspaceId(shopDomain) : null;
}
