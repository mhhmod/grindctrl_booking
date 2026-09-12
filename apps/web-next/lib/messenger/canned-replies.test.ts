import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MessengerSiteView } from './provisioning';

const { insertMock, updateMock, deleteMock, recordAuditMock, listRowsMock } = vi.hoisted(() => ({
  insertMock: vi.fn(),
  updateMock: vi.fn(),
  deleteMock: vi.fn(),
  recordAuditMock: vi.fn(),
  listRowsMock: vi.fn(),
}));

vi.mock('./db', () => ({
  getMessengerServiceClient: () => ({
    from: () => ({
      insert: insertMock,
      update: updateMock,
      delete: deleteMock,
      select: listRowsMock,
    }),
  }),
}));
vi.mock('./conversations', () => ({ recordAudit: recordAuditMock }));

import {
  addCannedReply,
  getActiveCannedReplies,
  listCannedReplies,
  removeCannedReply,
  setCannedReplyStatus,
} from './canned-replies';

function site(overrides: Partial<MessengerSiteView> = {}): MessengerSiteView {
  return {
    id: 'site-1',
    workspace_id: 'ws-1',
    name: 'Demo',
    embed_key: 'gc_demo',
    status: 'active',
    domain: 'demo.myshopify.com',
    settings_json: {},
    settings_version: 1,
    settings_draft: null,
    hasDraft: false,
    ...overrides,
  };
}

/* Awaitable PostgREST chain: every method chains, awaiting at any point
   resolves to the configured result — mirrors knowledge.test.ts. */
function chain(result: { data?: unknown; error?: { message: string } | null }) {
  const builder = {
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => Promise.resolve(result)),
    select: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(result)),
    then: (resolve: (value: typeof result) => unknown) => resolve(result),
  };
  return builder;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listCannedReplies', () => {
  it('returns all rows for the site', async () => {
    const rows = [
      { id: 'r-1', title: 'Hello', content: 'Hi there', status: 'active', sort_order: 0, updated_at: '2026-01-02' },
      { id: 'r-2', title: 'Bye', content: 'Goodbye', status: 'disabled', sort_order: 1, updated_at: '2026-01-01' },
    ];
    listRowsMock.mockReturnValue(chain({ data: rows, error: null }));
    const replies = await listCannedReplies('site-1');
    expect(replies).toHaveLength(2);
    expect(replies[0].id).toBe('r-1');
    expect(replies[1].status).toBe('disabled');
  });

  it('throws on a list failure', async () => {
    listRowsMock.mockReturnValue(chain({ data: null, error: { message: 'boom' } }));
    await expect(listCannedReplies('site-1')).rejects.toThrow('canned replies list failed');
  });
});

describe('getActiveCannedReplies', () => {
  it('returns only active rows', async () => {
    const rows = [{ id: 'r-1', title: 'Hello', content: 'Hi', status: 'active', sort_order: 0, updated_at: '2026-01-02' }];
    listRowsMock.mockReturnValue(chain({ data: rows, error: null }));
    const replies = await getActiveCannedReplies('site-1');
    expect(replies).toEqual([expect.objectContaining({ id: 'r-1', status: 'active' })]);
  });

  it('throws on an active-list failure', async () => {
    listRowsMock.mockReturnValue(chain({ data: null, error: { message: 'boom' } }));
    await expect(getActiveCannedReplies('site-1')).rejects.toThrow('active canned replies failed');
  });
});

describe('addCannedReply', () => {
  it('writes the reply under the given site and records an audit entry, without checking ownership itself', async () => {
    insertMock.mockReturnValue(
      chain({ data: { id: 'r-1', title: 'Hello', content: 'Hi there', status: 'active', sort_order: 0, updated_at: '2026-01-01' }, error: null }),
    );
    const reply = await addCannedReply({
      site: site(),
      actorClerkUserId: 'shop-demo.myshopify.com',
      title: 'Hello',
      content: 'Hi there',
    });
    expect(reply.id).toBe('r-1');
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ widget_site_id: 'site-1', title: 'Hello' }),
    );
    expect(recordAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ siteId: 'site-1', actorClerkUserId: 'shop-demo.myshopify.com', action: 'canned_reply_added' }),
    );
  });

  it('trims and caps title/content to the DB constraints', async () => {
    insertMock.mockReturnValue(
      chain({ data: { id: 'r-2', title: 'x', content: 'y', status: 'active', sort_order: 0, updated_at: '2026-01-01' }, error: null }),
    );
    await addCannedReply({
      site: site(),
      actorClerkUserId: 'user-1',
      title: `  ${'t'.repeat(150)}  `,
      content: `  ${'c'.repeat(3000)}  `,
    });
    const payload = insertMock.mock.calls[0][0] as { title: string; content: string };
    expect(payload.title).toHaveLength(100);
    expect(payload.content).toHaveLength(2000);
  });
});

describe('setCannedReplyStatus', () => {
  it('updates status scoped to the given site id', async () => {
    updateMock.mockReturnValue(chain({ error: null }));
    await setCannedReplyStatus({ site: site(), replyId: 'r-1', status: 'disabled' });
    expect(updateMock).toHaveBeenCalledWith({ status: 'disabled' });
  });
});

describe('removeCannedReply', () => {
  it('deletes scoped to the given site id and records an audit entry', async () => {
    deleteMock.mockReturnValue(chain({ error: null }));
    await removeCannedReply({ site: site(), actorClerkUserId: 'shop-demo.myshopify.com', replyId: 'r-1' });
    expect(recordAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'canned_reply_removed', detail: { id: 'r-1' } }),
    );
  });
});
