// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

/* The Team actions: who may run them, for which team, and what they
   answer. The rules inside each (one pending invite, the owner untouchable,
   twenty a day) are tested in lib/team/invites.test.ts. */
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  active: vi.fn(),
  role: vi.fn(),
  flags: vi.fn(),
  workspace: vi.fn(),
  profile: vi.fn(),
  rate: vi.fn(),
  revalidate: vi.fn(),
  invite: vi.fn(),
  resend: vi.fn(),
  revoke: vi.fn(),
  change: vi.fn(),
  remove: vi.fn(),
  sender: vi.fn((origin: string) => ({ origin })),
  headers: new Map<string, string>(),
}));

vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }));
vi.mock('next/headers', () => ({ headers: async () => ({ get: (name: string) => mocks.headers.get(name) ?? null }) }));
vi.mock('@clerk/nextjs/server', () => ({ auth: mocks.auth }));
vi.mock('@/lib/dashboard/active-store-server', () => ({ getActiveStore: mocks.active, getActiveStoreRole: mocks.role }));
vi.mock('@/lib/dashboard/team-data', () => ({ teamWorkspaceId: mocks.workspace }));
vi.mock('@/lib/flags/store-flags', () => ({ storeFlags: mocks.flags }));
vi.mock('@/lib/messenger/provisioning', () => {
  class UnauthorizedError extends Error {}
  return { getProfileId: mocks.profile, UnauthorizedError };
});
vi.mock('@/lib/request-rate-limit', () => {
  class RequestRateLimitError extends Error {}
  return { requireMerchantRateLimit: mocks.rate, RequestRateLimitError };
});
vi.mock('@/lib/team/clerk-invitations', () => ({ clerkInvitationSender: mocks.sender }));
vi.mock('@/lib/team/invites', async () => {
  const actual = await vi.importActual<typeof import('@/lib/team/invites')>('@/lib/team/invites');
  return {
    InviteError: actual.InviteError,
    inviteTeammate: mocks.invite,
    resendInvite: mocks.resend,
    revokeInvite: mocks.revoke,
    changeRole: mocks.change,
    removeMember: mocks.remove,
  };
});
vi.mock('server-only', () => ({}));

import { InviteError } from '@/lib/team/invites';
import { RoleNotAllowedError } from '@/lib/rbac/dashboard-policy';
import {
  changeRoleAction,
  inviteTeammateAction,
  removeMemberAction,
  resendInviteAction,
  revokeInviteAction,
} from './actions';

const SITE_ID = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.headers = new Map([['x-forwarded-host', 'grindctrl.cloud'], ['x-forwarded-proto', 'https']]);
  mocks.auth.mockResolvedValue({ userId: 'user_1' });
  mocks.active.mockResolvedValue({ shopDomain: 'maison.myshopify.com', siteId: SITE_ID });
  mocks.role.mockResolvedValue('admin');
  mocks.flags.mockResolvedValue(['v16_dashboard', 'n21_team_invites']);
  mocks.workspace.mockResolvedValue('ws_1');
  mocks.profile.mockResolvedValue('p_caller');
  mocks.rate.mockResolvedValue(undefined);
  for (const fn of [mocks.invite, mocks.resend, mocks.revoke, mocks.change, mocks.remove]) fn.mockResolvedValue(undefined);
});

describe('the Team actions', () => {
  it('invites for the active store’s team, from the caller, with Clerk sending to this site’s sign-up', async () => {
    expect(await inviteTeammateAction({ email: 'reem@maisonnoor.com', role: 'member' })).toEqual({ ok: true });
    expect(mocks.workspace).toHaveBeenCalledWith({ userId: 'user_1', siteId: SITE_ID, shopDomain: 'maison.myshopify.com' });
    expect(mocks.rate).toHaveBeenCalledWith('team:ws_1', 'write');
    expect(mocks.sender).toHaveBeenCalledWith('https://grindctrl.cloud');
    expect(mocks.invite).toHaveBeenCalledWith({
      workspaceId: 'ws_1',
      invitedByProfileId: 'p_caller',
      email: 'reem@maisonnoor.com',
      role: 'member',
      sender: { origin: 'https://grindctrl.cloud' },
    });
    expect(mocks.revalidate).toHaveBeenCalledWith('/dashboard', 'layout');
  });

  it('runs resend, cancel, change role and remove against the same team and caller', async () => {
    await resendInviteAction({ inviteId: 'i1' });
    await revokeInviteAction({ inviteId: 'i1' });
    await changeRoleAction({ profileId: 'p2', role: 'admin' });
    await removeMemberAction({ profileId: 'p2' });
    expect(mocks.resend).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: 'ws_1', inviteId: 'i1' }));
    expect(mocks.revoke).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: 'ws_1', inviteId: 'i1' }));
    expect(mocks.change).toHaveBeenCalledWith({ workspaceId: 'ws_1', profileId: 'p2', role: 'admin', callerProfileId: 'p_caller' });
    expect(mocks.remove).toHaveBeenCalledWith({ workspaceId: 'ws_1', profileId: 'p2', callerProfileId: 'p_caller' });
  });

  it('refuses without the flags, for a member, signed out, or for a site the person may not manage', async () => {
    mocks.flags.mockResolvedValue(['v16_dashboard']);
    expect(await inviteTeammateAction({ email: 'a@b.co', role: 'member' })).toEqual({ ok: false, error: 'not_allowed' });
    mocks.flags.mockResolvedValue(['v16_dashboard', 'n21_team_invites']);
    mocks.role.mockResolvedValue('member');
    expect(await removeMemberAction({ profileId: 'p2' })).toEqual({ ok: false, error: 'not_allowed' });
    mocks.role.mockResolvedValue('admin');
    mocks.workspace.mockRejectedValue(new RoleNotAllowedError('team'));
    expect(await changeRoleAction({ profileId: 'p2', role: 'admin' })).toEqual({ ok: false, error: 'not_allowed' });
    mocks.auth.mockResolvedValue({ userId: null });
    expect(await resendInviteAction({ inviteId: 'i1' })).toEqual({ ok: false, error: 'not_allowed' });
    expect(mocks.invite).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });

  it('answers with the rule that stopped it, and a plain failure otherwise', async () => {
    mocks.invite.mockRejectedValueOnce(new InviteError('already_member'));
    expect(await inviteTeammateAction({ email: 'nour@maisonnoor.com', role: 'member' })).toEqual({ ok: false, error: 'already_member' });
    mocks.invite.mockRejectedValueOnce(new Error('Clerk is down'));
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await inviteTeammateAction({ email: 'reem@maisonnoor.com', role: 'member' })).toEqual({ ok: false, error: 'failed' });
    expect(error).toHaveBeenCalledWith('[team] invite failed:', 'Clerk is down');
    error.mockRestore();
  });

  it('falls back to grindctrl.cloud when the request names a host it does not trust', async () => {
    mocks.headers = new Map([['host', 'evil.example']]);
    const previous = process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    await inviteTeammateAction({ email: 'reem@maisonnoor.com', role: 'member' });
    expect(mocks.sender).toHaveBeenCalledWith('https://grindctrl.cloud');
    if (previous !== undefined) process.env.NEXT_PUBLIC_APP_URL = previous;
  });
});
