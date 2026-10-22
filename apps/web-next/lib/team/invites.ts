import 'server-only';

import { getMessengerServiceClient } from '@/lib/messenger/db';
import { isPlaceholderEmail } from '@/lib/messenger/emails';

/* Team invites and the team's roles (v16 N21, 09-backend-contracts.md).

   A team is a workspace: workspace_members, and the invites in
   supabase/workspace_invites.sql. The callers (app/dashboard/settings/
   actions.ts) have already checked that the person may manage the team
   (the 'team' capability, item 12) and that n21_team_invites is on; this
   module keeps the rules that hold whoever calls it: the owner is never
   invited, changed or removed, nobody changes or removes themselves, one
   pending invite per address, twenty invites a day, and seven days to
   accept. Clerk sends the email, through the sender the caller passes. */

export type InviteRole = 'admin' | 'member';
export type InviteErrorCode = 'already_member' | 'not_allowed' | 'invite_expired' | 'not_found' | 'invalid_email' | 'daily_limit';

export class InviteError extends Error {
  constructor(readonly code: InviteErrorCode) {
    super(code);
    this.name = 'InviteError';
  }
}

export type TeamInvite = {
  id: string;
  email: string;
  role: InviteRole;
  invitedAt: string;
  expiresAt: string;
};

/** Sends and withdraws Clerk's invitation emails. */
export type InvitationSender = {
  send: (email: string) => Promise<{ id: string }>;
  revoke: (id: string) => Promise<void>;
};

const DAY = 86_400_000;
export const INVITE_DAYS = 7;
export const INVITES_PER_DAY = 20;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

type InviteRow = {
  id: string;
  email: string;
  role: InviteRole;
  status: string;
  clerk_invitation_id: string | null;
  invited_at: string;
  expires_at: string;
};

const INVITE_COLUMNS = 'id, email, role, status, clerk_invitation_id, invited_at, expires_at';

function db() {
  return getMessengerServiceClient();
}

function fail(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

/** The address as it is stored and compared: trimmed, lower case. */
export function normalizeInviteEmail(raw: string): string {
  const email = raw.trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254 || isPlaceholderEmail(email)) throw new InviteError('invalid_email');
  return email;
}

function toInvite(row: InviteRow): TeamInvite {
  return { id: row.id, email: row.email, role: row.role, invitedAt: row.invited_at, expiresAt: row.expires_at };
}

/** Before the owner applies workspace_invites.sql the table is missing. */
function isMissingTable(error: { code?: string; message?: string }): boolean {
  return error.code === '42P01' || error.code === 'PGRST205' || /workspace_invites.*(does not exist|schema cache)/.test(error.message ?? '');
}

/** The workspace's pending invites, newest first; none until the table exists. */
export async function listPendingInvites(workspaceId: string): Promise<TeamInvite[]> {
  const result = await db()
    .from('workspace_invites')
    .select(INVITE_COLUMNS)
    .eq('workspace_id', workspaceId)
    .eq('status', 'pending')
    .order('invited_at', { ascending: false });
  if (result.error && isMissingTable(result.error)) return [];
  fail(result.error);
  return ((result.data ?? []) as InviteRow[]).map(toInvite);
}

async function isMember(workspaceId: string, email: string): Promise<boolean> {
  const result = await db()
    .from('workspace_members')
    .select('profile_id, profiles!inner(email)')
    .eq('workspace_id', workspaceId)
    .eq('profiles.email', email)
    .limit(1);
  fail(result.error);
  return (result.data ?? []).length > 0;
}

async function sentToday(workspaceId: string, now: number): Promise<number> {
  const result = await db()
    .from('workspace_invites')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .gte('invited_at', new Date(now - DAY).toISOString());
  fail(result.error);
  return result.count ?? 0;
}

async function pendingFor(workspaceId: string, match: { id: string } | { email: string }): Promise<InviteRow | null> {
  const query = db().from('workspace_invites').select(INVITE_COLUMNS).eq('workspace_id', workspaceId).eq('status', 'pending');
  const result = await ('id' in match ? query.eq('id', match.id) : query.eq('email', match.email)).maybeSingle();
  fail(result.error);
  return (result.data as InviteRow | null) ?? null;
}

/** Sends a fresh invitation for a pending invite and restarts its seven days. */
async function resend(row: InviteRow, role: InviteRole, sender: InvitationSender, now: number): Promise<TeamInvite> {
  if (row.clerk_invitation_id) await sender.revoke(row.clerk_invitation_id).catch(() => undefined);
  const sent = await sender.send(row.email);
  const result = await db()
    .from('workspace_invites')
    .update({
      role,
      clerk_invitation_id: sent.id,
      invited_at: new Date(now).toISOString(),
      expires_at: new Date(now + INVITE_DAYS * DAY).toISOString(),
    })
    .eq('id', row.id)
    .eq('status', 'pending')
    .select(INVITE_COLUMNS)
    .maybeSingle();
  fail(result.error);
  if (!result.data) throw new InviteError('not_found');
  return toInvite(result.data as InviteRow);
}

export async function inviteTeammate(input: {
  workspaceId: string;
  invitedByProfileId: string;
  email: string;
  role: InviteRole;
  sender: InvitationSender;
  now?: number;
}): Promise<TeamInvite> {
  const now = input.now ?? Date.now();
  if (input.role !== 'admin' && input.role !== 'member') throw new InviteError('not_allowed');
  const email = normalizeInviteEmail(input.email);
  if (await isMember(input.workspaceId, email)) throw new InviteError('already_member');
  if ((await sentToday(input.workspaceId, now)) >= INVITES_PER_DAY) throw new InviteError('daily_limit');

  // Inviting the same address again is a resend: one pending invite each.
  const pending = await pendingFor(input.workspaceId, { email });
  if (pending) return resend(pending, input.role, input.sender, now);

  const sent = await input.sender.send(email);
  const result = await db()
    .from('workspace_invites')
    .insert({
      workspace_id: input.workspaceId,
      email,
      role: input.role,
      status: 'pending',
      clerk_invitation_id: sent.id,
      invited_by_profile_id: input.invitedByProfileId,
      invited_at: new Date(now).toISOString(),
      expires_at: new Date(now + INVITE_DAYS * DAY).toISOString(),
    })
    .select(INVITE_COLUMNS)
    .single();
  if (result.error) {
    await input.sender.revoke(sent.id).catch(() => undefined);
    throw new Error(result.error.message);
  }
  return toInvite(result.data as InviteRow);
}

export async function resendInvite(input: { workspaceId: string; inviteId: string; sender: InvitationSender; now?: number }): Promise<TeamInvite> {
  const now = input.now ?? Date.now();
  const pending = await pendingFor(input.workspaceId, { id: input.inviteId });
  if (!pending) throw new InviteError('not_found');
  if ((await sentToday(input.workspaceId, now)) >= INVITES_PER_DAY) throw new InviteError('daily_limit');
  return resend(pending, pending.role, input.sender, now);
}

export async function revokeInvite(input: { workspaceId: string; inviteId: string; sender: InvitationSender }): Promise<void> {
  const pending = await pendingFor(input.workspaceId, { id: input.inviteId });
  if (!pending) throw new InviteError('not_found');
  const result = await db().from('workspace_invites').update({ status: 'revoked' }).eq('id', pending.id).eq('status', 'pending');
  fail(result.error);
  if (pending.clerk_invitation_id) await input.sender.revoke(pending.clerk_invitation_id).catch(() => undefined);
}

async function memberRole(workspaceId: string, profileId: string): Promise<string | null> {
  const result = await db()
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('profile_id', profileId)
    .maybeSingle();
  fail(result.error);
  return (result.data as { role: string } | null)?.role ?? null;
}

/** Nobody changes the owner, and nobody changes themselves. */
async function requireChangeable(workspaceId: string, profileId: string, callerProfileId: string): Promise<void> {
  if (profileId === callerProfileId) throw new InviteError('not_allowed');
  const role = await memberRole(workspaceId, profileId);
  if (!role) throw new InviteError('not_found');
  if (role === 'owner') throw new InviteError('not_allowed');
}

export async function changeRole(input: { workspaceId: string; profileId: string; role: InviteRole; callerProfileId: string }): Promise<void> {
  if (input.role !== 'admin' && input.role !== 'member') throw new InviteError('not_allowed');
  await requireChangeable(input.workspaceId, input.profileId, input.callerProfileId);
  const result = await db()
    .from('workspace_members')
    .update({ role: input.role })
    .eq('workspace_id', input.workspaceId)
    .eq('profile_id', input.profileId)
    .neq('role', 'owner');
  fail(result.error);
}

export async function removeMember(input: { workspaceId: string; profileId: string; callerProfileId: string }): Promise<void> {
  await requireChangeable(input.workspaceId, input.profileId, input.callerProfileId);
  const result = await db()
    .from('workspace_members')
    .delete()
    .eq('workspace_id', input.workspaceId)
    .eq('profile_id', input.profileId)
    .neq('role', 'owner');
  fail(result.error);
}

/* When someone signs in with an address a team invited, they join it with
   the role they were invited with: an existing membership keeps its role,
   and an invite past its seven days is marked expired instead. Addresses
   must be ones Clerk has verified. Never throws: a failure leaves the
   invites pending for the next visit, and is logged. Returns the
   workspaces joined. */
export async function acceptPendingInvites(input: {
  verifiedEmails: string[];
  ensureProfileId: () => Promise<string>;
  now?: number;
}): Promise<string[]> {
  const now = input.now ?? Date.now();
  const emails = [...new Set(input.verifiedEmails.map((email) => email.trim().toLowerCase()).filter((email) => EMAIL_RE.test(email)))];
  if (emails.length === 0) return [];
  try {
    const result = await db().from('workspace_invites').select(`workspace_id, ${INVITE_COLUMNS}`).eq('status', 'pending').in('email', emails);
    if (result.error) {
      // Until the owner applies workspace_invites.sql there are no invites.
      if (!isMissingTable(result.error)) console.error('[team] invites read failed:', result.error.message);
      return [];
    }
    const rows = (result.data ?? []) as Array<InviteRow & { workspace_id: string }>;
    if (rows.length === 0) return [];

    const joined: string[] = [];
    let profileId: string | null = null;
    for (const row of rows) {
      if (Date.parse(row.expires_at) <= now) {
        await db().from('workspace_invites').update({ status: 'expired' }).eq('id', row.id).eq('status', 'pending');
        continue;
      }
      profileId ??= await input.ensureProfileId();
      const member = await db()
        .from('workspace_members')
        .upsert({ workspace_id: row.workspace_id, profile_id: profileId, role: row.role }, { onConflict: 'workspace_id,profile_id', ignoreDuplicates: true });
      if (member.error) throw new Error(member.error.message);
      const accepted = await db()
        .from('workspace_invites')
        .update({ status: 'accepted', accepted_at: new Date(now).toISOString() })
        .eq('id', row.id)
        .eq('status', 'pending');
      if (accepted.error) throw new Error(accepted.error.message);
      joined.push(row.workspace_id);
    }
    return joined;
  } catch (error) {
    console.error('[team] accepting invites failed:', error instanceof Error ? error.message : error);
    return [];
  }
}
