// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

vi.mock('server-only', () => ({}));
// Each call runs afresh here; in the app React caches it per request.
vi.mock('react', async () => ({ ...(await vi.importActual<typeof import('react')>('react')), cache: <T,>(fn: T) => fn }));

const mocks = vi.hoisted(() => ({
  pending: { count: 0 as number | null, error: null as { message: string } | null },
  user: vi.fn(),
  accept: vi.fn(async () => ['ws_1']),
  ensure: vi.fn(async () => ({ id: 'p_new' })),
}));

vi.mock('@clerk/nextjs/server', () => ({ currentUser: mocks.user }));
vi.mock('@/lib/messenger/provisioning', () => ({ ensureProfile: mocks.ensure }));
vi.mock('./invites', () => ({ acceptPendingInvites: mocks.accept }));
vi.mock('@/lib/messenger/db', () => {
  const query = {
    select: () => query,
    eq: () => query,
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ count: mocks.pending.count, error: mocks.pending.error }).then(resolve),
  };
  return { getMessengerServiceClient: () => ({ from: () => query }) as unknown as SupabaseClient };
});

import { acceptInvitesForSignedIn } from './accept';

const USER = {
  id: 'user_new',
  primaryEmailAddress: { emailAddress: 'reem@maisonnoor.com' },
  emailAddresses: [
    { emailAddress: 'reem@maisonnoor.com', verification: { status: 'verified' } },
    { emailAddress: 'reem.old@maisonnoor.com', verification: { status: 'unverified' } },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.pending = { count: 1, error: null };
  mocks.user.mockResolvedValue(USER);
});

describe('acceptInvitesForSignedIn', () => {
  it('asks Clerk nothing while no invite is waiting anywhere', async () => {
    mocks.pending = { count: 0, error: null };
    expect(await acceptInvitesForSignedIn()).toEqual([]);
    mocks.pending = { count: null, error: { message: 'relation "public.workspace_invites" does not exist' } };
    expect(await acceptInvitesForSignedIn()).toEqual([]);
    expect(mocks.user).not.toHaveBeenCalled();
    expect(mocks.accept).not.toHaveBeenCalled();
  });

  it('accepts with the verified addresses only, creating the profile from the primary one', async () => {
    expect(await acceptInvitesForSignedIn()).toEqual(['ws_1']);
    const [input] = mocks.accept.mock.calls[0] as unknown as [{ verifiedEmails: string[]; ensureProfileId: () => Promise<string> }];
    expect(input.verifiedEmails).toEqual(['reem@maisonnoor.com']);
    expect(await input.ensureProfileId()).toBe('p_new');
    expect(mocks.ensure).toHaveBeenCalledWith('user_new', 'reem@maisonnoor.com');
  });

  it('never throws', async () => {
    mocks.user.mockRejectedValue(new Error('Clerk is down'));
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await acceptInvitesForSignedIn()).toEqual([]);
    expect(error).toHaveBeenCalledWith('[team] accepting invites failed:', 'Clerk is down');
    error.mockRestore();
    mocks.user.mockResolvedValue(null);
    expect(await acceptInvitesForSignedIn()).toEqual([]);
  });
});
