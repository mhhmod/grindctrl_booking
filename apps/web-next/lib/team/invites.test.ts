// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

vi.mock('server-only', () => ({}));

/* A small in-memory stand-in for the two tables, enough for the queries
   invites.ts makes: filters, one embedded profile email, counts, and the
   writes. */
type Row = Record<string, unknown>;
const db = vi.hoisted(() => ({
  tables: {} as Record<string, Row[]>,
  profiles: {} as Record<string, { email: string }>,
  failOn: null as string | null,
  nextId: 1,
}));

vi.mock('@/lib/messenger/db', () => {
  class Query {
    private filters: Array<(row: Row) => boolean> = [];
    private op: 'select' | 'update' | 'insert' | 'upsert' | 'delete' = 'select';
    private payload: Row | null = null;
    private countOnly = false;
    private one = false;
    private ignoreDuplicates = false;
    constructor(readonly table: string) {}
    select(_columns?: string, options?: { count?: string; head?: boolean }) {
      if (options?.head) this.countOnly = true;
      return this;
    }
    insert(row: Row) { this.op = 'insert'; this.payload = row; return this; }
    upsert(row: Row, options: { ignoreDuplicates?: boolean }) { this.op = 'upsert'; this.payload = row; this.ignoreDuplicates = Boolean(options.ignoreDuplicates); return this; }
    update(row: Row) { this.op = 'update'; this.payload = row; return this; }
    delete() { this.op = 'delete'; return this; }
    eq(column: string, value: unknown) {
      if (column === 'profiles.email') this.filters.push((row) => db.profiles[row.profile_id as string]?.email === value);
      else this.filters.push((row) => row[column] === value);
      return this;
    }
    neq(column: string, value: unknown) { this.filters.push((row) => row[column] !== value); return this; }
    gte(column: string, value: string) { this.filters.push((row) => String(row[column]) >= value); return this; }
    in(column: string, values: unknown[]) { this.filters.push((row) => values.includes(row[column])); return this; }
    order() { return this; }
    limit() { return this; }
    maybeSingle() { this.one = true; return this; }
    single() { this.one = true; return this; }
    then(resolve: (value: unknown) => unknown) {
      return Promise.resolve(this.run()).then(resolve);
    }
    private run() {
      if (db.failOn === this.table) return { data: null, error: { message: `${this.table} unavailable` } };
      const rows = (db.tables[this.table] ??= []);
      const matching = rows.filter((row) => this.filters.every((filter) => filter(row)));
      if (this.op === 'insert' || this.op === 'upsert') {
        const row = this.payload!;
        if (this.table === 'workspace_invites' && rows.some((r) => r.status === 'pending' && r.workspace_id === row.workspace_id && r.email === row.email)) {
          return { data: null, error: { message: 'duplicate key value violates unique constraint "workspace_invites_one_pending"' } };
        }
        if (this.op === 'upsert' && rows.some((r) => r.workspace_id === row.workspace_id && r.profile_id === row.profile_id)) {
          return { data: null, error: this.ignoreDuplicates ? null : { message: 'duplicate' } };
        }
        const stored = { id: `inv_${db.nextId++}`, ...row };
        rows.push(stored);
        return { data: stored, error: null };
      }
      if (this.op === 'update') {
        for (const row of matching) Object.assign(row, this.payload);
        return { data: this.one ? matching[0] ?? null : matching, error: null };
      }
      if (this.op === 'delete') {
        db.tables[this.table] = rows.filter((row) => !matching.includes(row));
        return { data: null, error: null };
      }
      if (this.countOnly) return { data: null, count: matching.length, error: null };
      return { data: this.one ? matching[0] ?? null : matching, error: null };
    }
  }
  return { getMessengerServiceClient: () => ({ from: (table: string) => new Query(table) }) as unknown as SupabaseClient };
});

import {
  acceptPendingInvites,
  changeRole,
  INVITES_PER_DAY,
  InviteError,
  inviteTeammate,
  listPendingInvites,
  removeMember,
  resendInvite,
  revokeInvite,
  type InvitationSender,
} from './invites';

const NOW = Date.parse('2026-10-22T09:00:00Z');
const DAY = 86_400_000;
const WS = 'ws_1';
const sender = () => {
  let n = 0;
  return { send: vi.fn(async () => ({ id: `clerk_${++n}` })), revoke: vi.fn(async () => undefined) } satisfies InvitationSender;
};

beforeEach(() => {
  db.failOn = null;
  db.nextId = 1;
  db.profiles = { p_owner: { email: 'hana@maisonnoor.com' }, p_admin: { email: 'youssef@maisonnoor.com' }, p_member: { email: 'nour@maisonnoor.com' } };
  db.tables = {
    workspace_members: [
      { workspace_id: WS, profile_id: 'p_owner', role: 'owner' },
      { workspace_id: WS, profile_id: 'p_admin', role: 'admin' },
      { workspace_id: WS, profile_id: 'p_member', role: 'member' },
    ],
    workspace_invites: [],
  };
});

const invite = (email: string, s = sender(), now = NOW, role: 'admin' | 'member' = 'member') =>
  inviteTeammate({ workspaceId: WS, invitedByProfileId: 'p_owner', email, role, sender: s, now });

describe('inviting someone', () => {
  it('sends a Clerk invitation and keeps a pending invite for seven days', async () => {
    const s = sender();
    const result = await invite('  Reem@MaisonNoor.com ', s);
    expect(s.send).toHaveBeenCalledWith('reem@maisonnoor.com');
    expect(result).toMatchObject({ email: 'reem@maisonnoor.com', role: 'member', invitedAt: new Date(NOW).toISOString(), expiresAt: new Date(NOW + 7 * DAY).toISOString() });
    expect(db.tables.workspace_invites).toEqual([expect.objectContaining({ status: 'pending', clerk_invitation_id: 'clerk_1', invited_by_profile_id: 'p_owner' })]);
    expect(await listPendingInvites(WS)).toHaveLength(1);
  });

  it('refuses someone already on the team, the owner role, and an address that is not one', async () => {
    await expect(invite('nour@maisonnoor.com')).rejects.toMatchObject({ code: 'already_member' });
    await expect(inviteTeammate({ workspaceId: WS, invitedByProfileId: 'p_owner', email: 'a@b.co', role: 'owner' as never, sender: sender(), now: NOW })).rejects.toMatchObject({ code: 'not_allowed' });
    await expect(invite('not-an-address')).rejects.toBeInstanceOf(InviteError);
    await expect(invite('user_1@users.noreply.clerk.dev')).rejects.toMatchObject({ code: 'invalid_email' });
    expect(db.tables.workspace_invites).toEqual([]);
  });

  it('keeps one pending invite when the same address is invited or resent, with a new invitation each time', async () => {
    const s = sender();
    const first = await invite('reem@maisonnoor.com', s);
    const again = await invite('reem@maisonnoor.com', s, NOW + DAY, 'admin');
    expect(again).toMatchObject({ id: first.id, role: 'admin', expiresAt: new Date(NOW + 8 * DAY).toISOString() });
    const resent = await resendInvite({ workspaceId: WS, inviteId: first.id, sender: s, now: NOW + 2 * DAY });
    expect(resent.id).toBe(first.id);
    expect(db.tables.workspace_invites.filter((row) => row.status === 'pending')).toHaveLength(1);
    expect(s.revoke.mock.calls).toEqual([['clerk_1'], ['clerk_2']]);
    expect(db.tables.workspace_invites[0].clerk_invitation_id).toBe('clerk_3');
  });

  it('stops at twenty invites a day per team', async () => {
    db.tables.workspace_invites = Array.from({ length: INVITES_PER_DAY }, (_, i) => ({
      id: `old_${i}`, workspace_id: WS, email: `x${i}@maisonnoor.com`, role: 'member', status: 'accepted', invited_at: new Date(NOW - 60_000).toISOString(),
    }));
    await expect(invite('reem@maisonnoor.com')).rejects.toMatchObject({ code: 'daily_limit' });
    // A day later the count starts again.
    await expect(invite('reem@maisonnoor.com', sender(), NOW + DAY)).resolves.toMatchObject({ email: 'reem@maisonnoor.com' });
  });

  it('withdraws the Clerk invitation when the invite cannot be saved', async () => {
    const s = sender();
    // A pending row added between the check and the insert, by another request.
    s.send.mockImplementationOnce(async () => {
      db.tables.workspace_invites.push({ id: 'other', workspace_id: WS, email: 'reem@maisonnoor.com', status: 'pending', invited_at: new Date(NOW).toISOString() });
      return { id: 'clerk_x' };
    });
    await expect(invite('reem@maisonnoor.com', s)).rejects.toThrow('workspace_invites_one_pending');
    expect(s.revoke).toHaveBeenCalledWith('clerk_x');
  });

  it('revokes a pending invite and its invitation', async () => {
    const s = sender();
    const sent = await invite('reem@maisonnoor.com', s);
    await revokeInvite({ workspaceId: WS, inviteId: sent.id, sender: s });
    expect(db.tables.workspace_invites[0].status).toBe('revoked');
    expect(s.revoke).toHaveBeenCalledWith('clerk_1');
    await expect(revokeInvite({ workspaceId: WS, inviteId: sent.id, sender: s })).rejects.toMatchObject({ code: 'not_found' });
    await expect(resendInvite({ workspaceId: 'ws_other', inviteId: sent.id, sender: s })).rejects.toMatchObject({ code: 'not_found' });
  });
});

describe('roles on the team', () => {
  it('changes an admin or member, and removes them', async () => {
    await changeRole({ workspaceId: WS, profileId: 'p_member', role: 'admin', callerProfileId: 'p_owner' });
    expect(db.tables.workspace_members.find((row) => row.profile_id === 'p_member')?.role).toBe('admin');
    await removeMember({ workspaceId: WS, profileId: 'p_member', callerProfileId: 'p_admin' });
    expect(db.tables.workspace_members.map((row) => row.profile_id)).toEqual(['p_owner', 'p_admin']);
  });

  it('never changes or removes the owner, nor lets anyone change themselves', async () => {
    await expect(changeRole({ workspaceId: WS, profileId: 'p_owner', role: 'member', callerProfileId: 'p_admin' })).rejects.toMatchObject({ code: 'not_allowed' });
    await expect(removeMember({ workspaceId: WS, profileId: 'p_owner', callerProfileId: 'p_admin' })).rejects.toMatchObject({ code: 'not_allowed' });
    await expect(changeRole({ workspaceId: WS, profileId: 'p_admin', role: 'member', callerProfileId: 'p_admin' })).rejects.toMatchObject({ code: 'not_allowed' });
    await expect(changeRole({ workspaceId: WS, profileId: 'p_member', role: 'owner' as never, callerProfileId: 'p_owner' })).rejects.toMatchObject({ code: 'not_allowed' });
    await expect(removeMember({ workspaceId: WS, profileId: 'p_nobody', callerProfileId: 'p_owner' })).rejects.toMatchObject({ code: 'not_found' });
    expect(db.tables.workspace_members).toHaveLength(3);
  });
});

describe('accepting', () => {
  it('adds the person to the team with the invited role when they sign in with that verified address', async () => {
    await invite('reem@maisonnoor.com', sender(), NOW, 'admin');
    const ensure = vi.fn(async () => 'p_reem');
    const joined = await acceptPendingInvites({ verifiedEmails: ['Reem@maisonnoor.com'], ensureProfileId: ensure, now: NOW + DAY });
    expect(joined).toEqual([WS]);
    expect(db.tables.workspace_members).toContainEqual({ id: expect.any(String), workspace_id: WS, profile_id: 'p_reem', role: 'admin' });
    expect(db.tables.workspace_invites[0]).toMatchObject({ status: 'accepted', accepted_at: new Date(NOW + DAY).toISOString() });
    // Nothing left to accept the next time.
    expect(await acceptPendingInvites({ verifiedEmails: ['reem@maisonnoor.com'], ensureProfileId: ensure, now: NOW + DAY })).toEqual([]);
    expect(ensure).toHaveBeenCalledTimes(1);
  });

  it('keeps an existing membership’s role, and marks an invite past seven days expired', async () => {
    db.tables.workspace_invites.push(
      { id: 'i1', workspace_id: WS, email: 'nour@maisonnoor.com', role: 'admin', status: 'pending', expires_at: new Date(NOW + DAY).toISOString() },
      { id: 'i2', workspace_id: 'ws_2', email: 'nour@maisonnoor.com', role: 'member', status: 'pending', expires_at: new Date(NOW - DAY).toISOString() },
    );
    const joined = await acceptPendingInvites({ verifiedEmails: ['nour@maisonnoor.com'], ensureProfileId: async () => 'p_member', now: NOW });
    expect(joined).toEqual([WS]);
    expect(db.tables.workspace_members.find((row) => row.profile_id === 'p_member')?.role).toBe('member');
    expect(db.tables.workspace_invites.map((row) => row.status)).toEqual(['accepted', 'expired']);
  });

  it('does nothing without a verified address, and never throws', async () => {
    const ensure = vi.fn(async () => 'p_x');
    expect(await acceptPendingInvites({ verifiedEmails: [], ensureProfileId: ensure })).toEqual([]);
    db.failOn = 'workspace_invites';
    expect(await acceptPendingInvites({ verifiedEmails: ['reem@maisonnoor.com'], ensureProfileId: ensure })).toEqual([]);
    expect(ensure).not.toHaveBeenCalled();
  });
});
