import 'server-only';

import { cache } from 'react';
import { getMessengerServiceClient } from '@/lib/messenger/db';
import { isShopProfileId } from '@/lib/messenger/shop-tenancy';
import {
  normalizeDashboardWorkspaceRole,
  strongestRole,
  type DashboardWorkspaceRole,
} from './dashboard-policy';

/* A person's role on a store (v16 phase zero item 12).

   A store's team is its owner's workspace. The owner owns the store
   (tryon_shops.owner_clerk_user_id for a Shopify shop, the workspace for a
   Store Chat site) and everyone else the workspace lists in
   workspace_members has the role it lists them with. Store checks accept
   the owner exactly as before and then, only for a store they do not own,
   the person's teams. */

export type TeamMembership = {
  workspaceId: string;
  /** The Clerk id of the account that owns the workspace. */
  ownerClerkUserId: string;
  role: DashboardWorkspaceRole;
};

/** workspace_members.workspace_id and workspaces.owner_profile_id are single
 *  NOT NULL foreign keys, so both embeds come back as one object, the same
 *  shape findSiteByDomain reads in shop-tenancy.ts. */
type MembershipRow = {
  workspace_id: string;
  role: string | null;
  workspaces: { profiles: { clerk_user_id: string | null } | null } | null;
};

/** The teams this person is on: each workspace that lists them and that
 *  someone else owns, with their role there. Their own workspace is not a
 *  team, it is theirs, and a shop's synthetic profile is not an account.
 *  Fails closed: a failed read means no teams, so the person keeps their own
 *  stores and nothing more. */
async function readTeamMemberships(clerkUserId: string): Promise<TeamMembership[]> {
  try {
    const supabase = getMessengerServiceClient();
    const profile = await supabase
      .from('profiles')
      .select('id')
      .eq('clerk_user_id', clerkUserId)
      .maybeSingle();
    if (profile.error || !profile.data) return [];

    const rows = await supabase
      .from('workspace_members')
      .select('workspace_id, role, workspaces!inner(profiles!inner(clerk_user_id))')
      .eq('profile_id', (profile.data as { id: string }).id);
    if (rows.error) return [];

    const memberships: TeamMembership[] = [];
    for (const row of (rows.data ?? []) as unknown as MembershipRow[]) {
      const role = normalizeDashboardWorkspaceRole(row.role);
      const owner = row.workspaces?.profiles?.clerk_user_id ?? null;
      if (!role || !owner || owner === clerkUserId || isShopProfileId(owner)) continue;
      memberships.push({ workspaceId: row.workspace_id, ownerClerkUserId: owner, role });
    }
    return memberships;
  } catch {
    return [];
  }
}

/** Read once per request when called during a render. */
export const listTeamMemberships = cache(readTeamMemberships);

/** The accounts whose stores this person works on as a team member. */
export function teamOwnerIds(memberships: readonly TeamMembership[]): string[] {
  return [...new Set(memberships.map((membership) => membership.ownerClerkUserId))];
}

/** The person's role on a Shopify shop owned by `shopOwnerClerkUserId`. */
export function shopRoleFor(
  clerkUserId: string,
  shopOwnerClerkUserId: string | null | undefined,
  memberships: readonly TeamMembership[],
): DashboardWorkspaceRole | null {
  if (!shopOwnerClerkUserId) return null;
  if (shopOwnerClerkUserId === clerkUserId) return 'owner';
  return strongestRole(
    memberships
      .filter((membership) => membership.ownerClerkUserId === shopOwnerClerkUserId)
      .map((membership) => membership.role),
  );
}

/** The person's role on a Store Chat site in someone else's workspace. Their
 *  own sites are listed, and owned, by provisioning.ts. */
export function teamSiteRoleFor(
  siteWorkspaceId: string,
  memberships: readonly TeamMembership[],
): DashboardWorkspaceRole | null {
  return strongestRole(
    memberships
      .filter((membership) => membership.workspaceId === siteWorkspaceId)
      .map((membership) => membership.role),
  );
}
