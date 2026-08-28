// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

/* Server-action contracts for the Messenger control centre. The point of
   these tests is the authorization boundary: every mutation must prove the
   caller owns the site before it touches anything, because hiding a button
   is not authorization. Publishing is also asserted to be race-safe. */

const mocks = vi.hoisted(() => {
  class UnauthorizedError extends Error {
    constructor() {
      super('Unauthorized');
      this.name = 'UnauthorizedError';
    }
  }
  return {
    UnauthorizedError,
    auth: vi.fn(),
    requireOwnedSite: vi.fn(),
    getProfileId: vi.fn(async () => 'profile-1'),
    recordAudit: vi.fn(async () => {}),
    getConversationForSite: vi.fn(),
    takeOverConversation: vi.fn(),
    appendMessage: vi.fn(async () => ({ message: { id: 'm1' }, replayed: false })),
    update: vi.fn(),
    /** What the mocked query chain resolves to, whenever it is awaited. */
    result: { current: { data: [{ id: 'site-1' }], error: null } as { data: unknown[]; error: unknown } },
  };
});

const UnauthorizedError = mocks.UnauthorizedError;

vi.mock('@clerk/nextjs/server', () => ({ auth: mocks.auth }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/messenger/provisioning', () => ({
  requireOwnedSite: mocks.requireOwnedSite,
  getProfileId: mocks.getProfileId,
  UnauthorizedError: mocks.UnauthorizedError,
}));
vi.mock('@/lib/messenger/conversations', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/messenger/conversations')>();
  return {
    ...actual,
    recordAudit: mocks.recordAudit,
    getConversationForSite: mocks.getConversationForSite,
    takeOverConversation: mocks.takeOverConversation,
    appendMessage: mocks.appendMessage,
  };
});
/* Minimal PostgREST-shaped builder: every method chains, and awaiting it at
   any point yields the configured result — actions await after .eq() or
   after .select(), and both must work. */
vi.mock('@/lib/messenger/db', () => ({
  getMessengerServiceClient: () => ({
    from: () => {
      const builder = {
        update(patch: Record<string, unknown>) {
          mocks.update(patch);
          return builder;
        },
        eq: () => builder,
        select: () => builder,
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(mocks.result.current).then(resolve),
      };
      return builder;
    },
  }),
}));

import { publishConfig, saveDraftSection, setMessengerEnabled, staffReply } from './actions';

const SITE = {
  id: 'site-1',
  workspace_id: 'ws-1',
  name: 'Sara’s Store',
  embed_key: 'gc_test_key',
  status: 'active' as const,
  domain: 'sara.myshopify.com',
  settings_json: {},
  settings_version: 3,
  settings_draft: { messenger_appearance: { accentColor: '#2a2826' } },
  hasDraft: true,
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ userId: 'user_owner' });
  mocks.requireOwnedSite.mockResolvedValue(SITE);
  mocks.getProfileId.mockResolvedValue('profile-1');
  mocks.result.current = { data: [{ id: 'site-1' }], error: null };
});

describe('messenger server actions — authorization', () => {
  it('refuses every mutation when the caller is signed out', async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    for (const run of [
      () => saveDraftSection('site-1', 'appearance', {}),
      () => publishConfig('site-1'),
      () => setMessengerEnabled('site-1', true),
      () => staffReply('site-1', 'conv-1', 'hello'),
    ]) {
      const result = await run();
      expect(result.ok).toBe(false);
    }
    expect(mocks.requireOwnedSite).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("refuses a site the caller does not own, before any write", async () => {
    mocks.requireOwnedSite.mockRejectedValue(new UnauthorizedError());

    const result = await publishConfig('someone-elses-site');

    expect(result).toEqual({ ok: false, error: 'Unauthorized' });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('checks ownership of the site for every conversation action', async () => {
    mocks.requireOwnedSite.mockRejectedValue(new UnauthorizedError());

    const result = await staffReply('someone-elses-site', 'conv-1', 'hi');

    expect(result.ok).toBe(false);
    expect(mocks.appendMessage).not.toHaveBeenCalled();
  });
});

describe('publishConfig', () => {
  it('refuses to publish an empty draft', async () => {
    mocks.requireOwnedSite.mockResolvedValue({ ...SITE, settings_draft: null });

    const result = await publishConfig('site-1');

    expect(result).toEqual({ ok: false, error: 'Nothing to publish yet.' });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('bumps the version and clears the draft in one write', async () => {
    const result = await publishConfig('site-1');

    expect(result.ok).toBe(true);
    const patch = mocks.update.mock.calls[0][0];
    expect(patch.settings_version).toBe(SITE.settings_version + 1);
    expect(patch.settings_draft).toBeNull();
    expect(patch.settings_json).toHaveProperty('messenger_appearance');
  });

  it('reports a conflict instead of clobbering a concurrent publish', async () => {
    // Zero rows updated = the guarded version no longer matched.
    mocks.result.current = { data: [], error: null };

    const result = await publishConfig('site-1');

    expect(result.ok).toBe(false);
    expect(result).toHaveProperty('error', expect.stringMatching(/refresh/i));
  });
});
