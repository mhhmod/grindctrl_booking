// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requireMerchantRateLimit, RequestRateLimitError } from '@/lib/request-rate-limit';
vi.mock('@/lib/request-rate-limit', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/request-rate-limit')>(),
  requireMerchantRateLimit: vi.fn(),
}));

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
    listMessages: vi.fn(async (): Promise<Array<{ id: string; role: string; content: string; created_at: string; metadata: Record<string, unknown> }>> => []),
    resolveAssigneeNames: vi.fn(async (): Promise<Record<string, string>> => ({})),
    listConversationAttachments: vi.fn(async () => []),
    signAttachmentUrls: vi.fn(async () => ({})),
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
    listMessages: mocks.listMessages,
    resolveAssigneeNames: mocks.resolveAssigneeNames,
  };
});
vi.mock('@/lib/messenger/attachments', () => ({
  listConversationAttachments: mocks.listConversationAttachments,
  signAttachmentUrls: mocks.signAttachmentUrls,
}));
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

import { addInternalNote, fetchConversationMessages, publishConfig, saveDraftSection, setMessengerEnabled, staffReply } from './actions';

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
  it('blocks a limited owned shop before any mutation and gives actionable retry copy', async () => {
    vi.mocked(requireMerchantRateLimit).mockRejectedValueOnce(new RequestRateLimitError(429, 12));
    expect(await publishConfig(SITE.id)).toEqual({ ok: false, error: 'Too many requests. Please try again in 12 seconds.' });
    expect(requireMerchantRateLimit).toHaveBeenCalledWith('shop:sara.myshopify.com', 'write');
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('never charges a foreign shop bucket and fails closed on unavailable protection', async () => {
    mocks.requireOwnedSite.mockRejectedValueOnce(new UnauthorizedError());
    await publishConfig('foreign');
    expect(requireMerchantRateLimit).not.toHaveBeenCalled();
    vi.mocked(requireMerchantRateLimit).mockRejectedValueOnce(new RequestRateLimitError(503, 30));
    expect(await publishConfig(SITE.id)).toEqual({ ok: false, error: 'Service temporarily unavailable. Please try again shortly.' });
    expect(mocks.update).not.toHaveBeenCalled();
  });
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

describe('publishConfig', () => {  it('refuses to publish an empty draft', async () => {
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

/* A staff note is metadata about the conversation, not a turn in it: it
   must land as a role:'system' + metadata.internal row, must not take over
   the thread or change its status, and the moderator read must resolve the
   author id to a display name without ever leaking the raw profile id. */
describe('addInternalNote', () => {
  beforeEach(() => {
    mocks.getConversationForSite.mockResolvedValue({ id: 'conv-1', status: 'handoff_active' });
  });

  it('appends a system/internal note without taking over, and audits it', async () => {
    const result = await addInternalNote('site-1', 'conv-1', '  VIP — comp shipping  ');

    expect(result).toEqual({ ok: true });
    expect(mocks.appendMessage).toHaveBeenCalledWith({
      conversationId: 'conv-1',
      role: 'system',
      content: 'VIP — comp shipping',
      metadata: { internal: true, noteAuthorProfileId: 'profile-1' },
    });
    expect(mocks.takeOverConversation).not.toHaveBeenCalled();
    expect(mocks.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ siteId: 'site-1', action: 'internal_note_added' }),
    );
  });

  it('refuses an empty note', async () => {
    const result = await addInternalNote('site-1', 'conv-1', '   ');

    expect(result.ok).toBe(false);
    expect(mocks.appendMessage).not.toHaveBeenCalled();
  });
});

describe('fetchConversationMessages with notes', () => {
  it('reads with includeInternal and resolves the note author name', async () => {
    mocks.getConversationForSite.mockResolvedValue({ id: 'conv-1', status: 'open' });
    mocks.listMessages.mockResolvedValue([
      { id: 'm-1', role: 'user', content: 'hi', created_at: '2026-08-30T10:00:00.000Z', metadata: {} },
      {
        id: 'm-2',
        role: 'system',
        content: 'VIP — comp shipping',
        created_at: '2026-08-30T10:01:00.000Z',
        metadata: { internal: true, noteAuthorProfileId: 'profile-9' },
      },
    ]);
    mocks.resolveAssigneeNames.mockResolvedValue({ 'profile-9': 'Sara Khan' });

    const result = await fetchConversationMessages('site-1', 'conv-1');

    expect(mocks.listMessages).toHaveBeenCalledWith('conv-1', { limit: 200, includeInternal: true });
    expect(mocks.resolveAssigneeNames).toHaveBeenCalledWith('ws-1', ['profile-9']);
    expect(result).toEqual({
      ok: true,
      status: 'open',
      messages: [
        {
          id: 'm-1',
          role: 'user',
          content: 'hi',
          createdAt: '2026-08-30T10:00:00.000Z',
          author: undefined,
          internal: undefined,
          noteAuthorName: undefined,
        },
        {
          id: 'm-2',
          role: 'system',
          content: 'VIP — comp shipping',
          createdAt: '2026-08-30T10:01:00.000Z',
          author: undefined,
          internal: true,
          noteAuthorName: 'Sara Khan',
        },
      ],
      attachments: {},
    });
  });
});
