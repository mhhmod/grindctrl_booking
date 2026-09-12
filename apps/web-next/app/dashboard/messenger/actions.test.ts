// @vitest-environment node
import { revalidatePath } from 'next/cache';
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
    assignConversation: vi.fn(),
    listWorkspaceMembers: vi.fn(),
    appendMessage: vi.fn(async () => ({ message: { id: 'm1' }, replayed: false })),
    pingStaffTyping: vi.fn(async () => {}),
    listMessages: vi.fn(async (): Promise<Array<{ id: string; role: string; content: string; created_at: string; metadata: Record<string, unknown> }>> => []),
    resolveAssigneeNames: vi.fn(async (): Promise<Record<string, string>> => ({})),
    listConversationAttachments: vi.fn(async () => []),
    signAttachmentUrls: vi.fn(async () => ({})),
    update: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
    /** What .single() resolves to, whenever it is awaited. */
    singleResult: { current: { data: { id: 'r-1', title: 'Hello', content: 'Hi there', status: 'active', sort_order: 0, updated_at: '2026-01-01T00:00:00.000Z' }, error: null } as { data: unknown; error: unknown } },
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
    assignConversation: mocks.assignConversation,
    listWorkspaceMembers: mocks.listWorkspaceMembers,
    appendMessage: mocks.appendMessage,
    pingStaffTyping: mocks.pingStaffTyping,
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
        insert(row: Record<string, unknown>) {
          mocks.insert(row);
          return builder;
        },
        delete() {
          mocks.delete();
          return builder;
        },
        update(patch: Record<string, unknown>) {
          mocks.update(patch);
          return builder;
        },
        eq: () => builder,
        select: () => builder,
        single: () => Promise.resolve(mocks.singleResult.current),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(mocks.result.current).then(resolve),
      };
      return builder;
    },
  }),
}));

import { assignConversationAction, takeoverConversation, addCannedReply, addInternalNote, deleteCannedReply, fetchConversationMessages, pingStaffTyping, publishConfig, saveDraftSection, setMessengerEnabled, staffReply, updateCannedReplyStatus } from './actions';

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
      () => pingStaffTyping('site-1', 'conv-1'),
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

/* A typing ping is ephemeral presence, not content: it must prove ownership
   of the site like every other conversation action, then merge the
   timestamp through the shared helper — with no audit entry (far too
   frequent for a trail) and no page revalidation (the shopper polls for
   the boolean independently). */
describe('pingStaffTyping', () => {
  const METADATA = {
    identity: { customer_id: 'c-1', email: 'sara@example.com', name: 'Sara', verified: true },
    agent_last_read_at: '2026-09-01T00:00:00.000Z',
  };

  beforeEach(() => {
    mocks.getConversationForSite.mockResolvedValue({ id: 'conv-1', status: 'handoff_active', metadata: METADATA });
  });

  it('pings through the shared merge helper with the conversation just read', async () => {
    const result = await pingStaffTyping('site-1', 'conv-1');

    expect(result).toEqual({ ok: true });
    expect(mocks.pingStaffTyping).toHaveBeenCalledWith('conv-1', METADATA);
    expect(mocks.recordAudit).not.toHaveBeenCalled();
    expect(mocks.appendMessage).not.toHaveBeenCalled();
  });

  it('refuses a ping on a site the caller does not own, before any write', async () => {
    mocks.requireOwnedSite.mockRejectedValue(new UnauthorizedError());

    const result = await pingStaffTyping('someone-elses-site', 'conv-1');

    expect(result.ok).toBe(false);
    expect(mocks.pingStaffTyping).not.toHaveBeenCalled();
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

/* Canned replies go through the real lib module with the PostgREST-shaped
   db mock above, so the audit action names are asserted for real — the lib
   owns the write + audit, the server action owns the ownership check. */
describe('canned reply actions', () => {
  it('adds a canned reply for an owned site and audits canned_reply_added', async () => {
    const result = await addCannedReply('site-1', '  Hello  ', '  Hi there  ');

    expect(result).toEqual({ ok: true, message: 'Canned reply added.' });
    expect(mocks.requireOwnedSite).toHaveBeenCalledWith('user_owner', 'site-1');
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({ widget_site_id: 'site-1', title: 'Hello', content: 'Hi there' }),
    );
    expect(mocks.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ siteId: 'site-1', actorClerkUserId: 'user_owner', action: 'canned_reply_added' }),
    );
  });

  it('refuses a canned reply add without title or content, before any write', async () => {
    expect(await addCannedReply('site-1', '  ', 'Hi there')).toEqual({ ok: false, error: 'Title and content are required.' });
    expect(await addCannedReply('site-1', 'Hello', '   ')).toEqual({ ok: false, error: 'Title and content are required.' });
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('refuses a canned reply add on a site the caller does not own, before any write', async () => {
    mocks.requireOwnedSite.mockRejectedValue(new UnauthorizedError());

    const result = await addCannedReply('someone-elses-site', 'Hello', 'Hi there');

    expect(result).toEqual({ ok: false, error: 'Unauthorized' });
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('updates a canned reply status for an owned site', async () => {
    const result = await updateCannedReplyStatus('site-1', 'r-1', 'disabled');

    expect(result).toEqual({ ok: true });
    expect(mocks.update).toHaveBeenCalledWith({ status: 'disabled' });
  });

  it('refuses a status update on a site the caller does not own, before any write', async () => {
    mocks.requireOwnedSite.mockRejectedValue(new UnauthorizedError());

    const result = await updateCannedReplyStatus('someone-elses-site', 'r-1', 'disabled');

    expect(result.ok).toBe(false);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('deletes a canned reply and audits canned_reply_removed', async () => {
    const result = await deleteCannedReply('site-1', 'r-1');

    expect(result).toEqual({ ok: true });
    expect(mocks.delete).toHaveBeenCalled();
    expect(mocks.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ siteId: 'site-1', action: 'canned_reply_removed', detail: { id: 'r-1' } }),
    );
  });

  it('refuses every canned reply mutation when the caller is signed out', async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    for (const run of [
      () => addCannedReply('site-1', 'Hello', 'Hi there'),
      () => updateCannedReplyStatus('site-1', 'r-1', 'active'),
      () => deleteCannedReply('site-1', 'r-1'),
    ]) {
      const result = await run();
      expect(result.ok).toBe(false);
    }
    expect(mocks.requireOwnedSite).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.delete).not.toHaveBeenCalled();
  });
});


describe('assignConversationAction', () => {
  beforeEach(() => {
    mocks.getConversationForSite.mockResolvedValue({ id: 'conv-1', status: 'handoff_active' });
    mocks.listWorkspaceMembers.mockResolvedValue([{ profileId: 'p-team', name: 'Teammate' }]);
    mocks.assignConversation.mockResolvedValue({ id: 'conv-1', status: 'handoff_active', assigned_profile_id: 'p-team' });
  });

  it('rejects a profile outside the owned site workspace before assignment', async () => {
    expect(await assignConversationAction('site-1', 'conv-1', 'p-foreign')).toEqual({ ok: false, error: 'Not a member of this workspace.' });
    expect(mocks.listWorkspaceMembers).toHaveBeenCalledWith('ws-1');
    expect(mocks.assignConversation).not.toHaveBeenCalled();
    expect(mocks.recordAudit).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('assigns a workspace member and records conversation_assigned with actor and assignee', async () => {
    expect(await assignConversationAction('site-1', 'conv-1', 'p-team')).toEqual({ ok: true });
    expect(mocks.requireOwnedSite).toHaveBeenCalledWith('user_owner', 'site-1');
    expect(mocks.getConversationForSite).toHaveBeenCalledWith('conv-1', 'site-1');
    expect(mocks.listWorkspaceMembers).toHaveBeenCalledWith('ws-1');
    expect(mocks.assignConversation).toHaveBeenCalledWith('conv-1', 'p-team');
    expect(mocks.recordAudit).toHaveBeenCalledWith({ siteId: 'site-1', actorClerkUserId: 'user_owner', action: 'conversation_assigned', detail: { conversationId: 'conv-1', assignedProfileId: 'p-team' } });
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/messenger');
  });

  it('refuses a concurrent close without auditing success', async () => {
    mocks.assignConversation.mockResolvedValue(null);
    expect(await assignConversationAction('site-1', 'conv-1', 'p-team')).toEqual({ ok: false, error: 'Conversation state changed. Refresh and retry.' });
    expect(mocks.recordAudit).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('fails closed when member lookup yields no members', async () => {
    mocks.listWorkspaceMembers.mockResolvedValue([]);
    expect((await assignConversationAction('site-1', 'conv-1', 'p-team')).ok).toBe(false);
    expect(mocks.assignConversation).not.toHaveBeenCalled();
  });

  it.each(['signed out', 'foreign site', 'foreign conversation'])('rejects %s before member lookup or mutation', async (reason) => {
    if (reason === 'signed out') mocks.auth.mockResolvedValue({ userId: null });
    if (reason === 'foreign site') mocks.requireOwnedSite.mockRejectedValue(new UnauthorizedError());
    if (reason === 'foreign conversation') mocks.getConversationForSite.mockResolvedValue(null);
    expect((await assignConversationAction('site-1', 'conv-1', 'p-team')).ok).toBe(false);
    expect(mocks.listWorkspaceMembers).not.toHaveBeenCalled();
    expect(mocks.assignConversation).not.toHaveBeenCalled();
  });

  it('preserves takeover as a claim for the current staff profile', async () => {
    mocks.takeOverConversation.mockResolvedValue({ id: 'conv-1' });
    expect(await takeoverConversation('site-1', 'conv-1')).toEqual({ ok: true });
    expect(mocks.takeOverConversation).toHaveBeenCalledWith('conv-1', 'profile-1');
    expect(mocks.assignConversation).not.toHaveBeenCalled();
  });
});
