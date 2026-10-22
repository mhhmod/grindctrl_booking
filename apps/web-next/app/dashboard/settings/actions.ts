'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { auth } from '@clerk/nextjs/server';
import { getActiveStore, getActiveStoreRole } from '@/lib/dashboard/active-store-server';
import { teamWorkspaceId } from '@/lib/dashboard/team-data';
import { storeFlags } from '@/lib/flags/store-flags';
import { getProfileId, UnauthorizedError } from '@/lib/messenger/provisioning';
import { RequestRateLimitError, requireMerchantRateLimit } from '@/lib/request-rate-limit';
import { RoleNotAllowedError, roleCan } from '@/lib/rbac/dashboard-policy';
import { resolveCallbackBase } from '@/lib/shopify/oauth';
import { clerkInvitationSender } from '@/lib/team/clerk-invitations';
import {
  changeRole,
  InviteError,
  inviteTeammate,
  removeMember,
  resendInvite,
  revokeInvite,
  type InviteErrorCode,
  type InviteRole,
} from '@/lib/team/invites';

/* The Team tab's actions (N21): invite, resend, cancel an invite, change a
   role, remove someone. Each runs for the active store's team, only while
   v16_dashboard and n21_team_invites are on for it, and only for someone
   whose role there may manage the team (the 'team' capability: owners and
   admins, item 12). lib/team/invites.ts keeps the rules that hold whoever
   calls it. */

export type TeamActionResult = { ok: true } | { ok: false; error: InviteErrorCode | 'failed' };

class NotAllowed extends Error {}

async function teamContext() {
  const { userId } = await auth();
  if (!userId) throw new NotAllowed();
  const active = await getActiveStore();
  const flagStore = active.shopDomain ? { shopDomain: active.shopDomain } : active.siteId ? { widgetSiteId: active.siteId } : null;
  const flags = flagStore ? await storeFlags(flagStore) : [];
  if (!flags.includes('v16_dashboard') || !flags.includes('n21_team_invites')) throw new NotAllowed();
  if (!roleCan(await getActiveStoreRole(active), 'team')) throw new NotAllowed();
  const workspaceId = await teamWorkspaceId({ userId, siteId: active.siteId, shopDomain: active.shopDomain });
  if (!workspaceId) throw new NotAllowed();
  await requireMerchantRateLimit(`team:${workspaceId}`, 'write');
  return { workspaceId, callerProfileId: await getProfileId(userId) };
}

async function senderForRequest() {
  const list = await headers();
  const origin =
    resolveCallbackBase({
      forwardedHost: list.get('x-forwarded-host'),
      host: list.get('host'),
      forwardedProto: list.get('x-forwarded-proto'),
      fallbackAppUrl: process.env.NEXT_PUBLIC_APP_URL ?? null,
    }) ?? 'https://grindctrl.cloud';
  return clerkInvitationSender(origin);
}

async function run(action: string, work: () => Promise<void>): Promise<TeamActionResult> {
  try {
    await work();
    revalidatePath('/dashboard', 'layout');
    return { ok: true };
  } catch (error) {
    if (error instanceof InviteError) return { ok: false, error: error.code };
    if (error instanceof NotAllowed || error instanceof RoleNotAllowedError || error instanceof UnauthorizedError) return { ok: false, error: 'not_allowed' };
    if (error instanceof RequestRateLimitError) return { ok: false, error: 'failed' };
    console.error(`[team] ${action} failed:`, error instanceof Error ? error.message : error);
    return { ok: false, error: 'failed' };
  }
}

export async function inviteTeammateAction(input: { email: string; role: InviteRole }): Promise<TeamActionResult> {
  return run('invite', async () => {
    const { workspaceId, callerProfileId } = await teamContext();
    await inviteTeammate({ workspaceId, invitedByProfileId: callerProfileId, email: String(input.email ?? ''), role: input.role, sender: await senderForRequest() });
  });
}

export async function resendInviteAction(input: { inviteId: string }): Promise<TeamActionResult> {
  return run('resend', async () => {
    const { workspaceId } = await teamContext();
    await resendInvite({ workspaceId, inviteId: String(input.inviteId ?? ''), sender: await senderForRequest() });
  });
}

export async function revokeInviteAction(input: { inviteId: string }): Promise<TeamActionResult> {
  return run('revoke', async () => {
    const { workspaceId } = await teamContext();
    await revokeInvite({ workspaceId, inviteId: String(input.inviteId ?? ''), sender: await senderForRequest() });
  });
}

export async function changeRoleAction(input: { profileId: string; role: InviteRole }): Promise<TeamActionResult> {
  return run('change role', async () => {
    const { workspaceId, callerProfileId } = await teamContext();
    await changeRole({ workspaceId, profileId: String(input.profileId ?? ''), role: input.role, callerProfileId });
  });
}

export async function removeMemberAction(input: { profileId: string }): Promise<TeamActionResult> {
  return run('remove', async () => {
    const { workspaceId, callerProfileId } = await teamContext();
    await removeMember({ workspaceId, profileId: String(input.profileId ?? ''), callerProfileId });
  });
}
