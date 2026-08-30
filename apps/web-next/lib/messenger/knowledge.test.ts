import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MessengerSiteView } from './provisioning';

const { insertMock, updateMock, deleteMock, selectSingleMock, recordAuditMock } = vi.hoisted(() => ({
  insertMock: vi.fn(),
  updateMock: vi.fn(),
  deleteMock: vi.fn(),
  selectSingleMock: vi.fn(),
  recordAuditMock: vi.fn(),
}));

vi.mock('./db', () => ({
  getMessengerServiceClient: () => ({
    from: () => ({
      insert: insertMock,
      update: updateMock,
      delete: deleteMock,
    }),
  }),
}));
vi.mock('./conversations', () => ({ recordAudit: recordAuditMock }));

import { addManualKnowledge, removeKnowledge, setKnowledgeStatus } from './knowledge';

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

function chain(result: { data?: unknown; error?: { message: string } | null }) {
  const builder = {
    eq: vi.fn(() => builder),
    select: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(result)),
    then: (resolve: (value: typeof result) => unknown) => resolve(result),
  };
  return builder;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('addManualKnowledge', () => {
  it('writes the entry under the given site and records an audit entry, without checking ownership itself', async () => {
    insertMock.mockReturnValue(
      chain({ data: { id: 'k-1', title: 'Shipping', content: 'Ships in 2 days', source: 'manual', status: 'active', source_url: null, last_synced_at: null, updated_at: '2026-01-01' }, error: null }),
    );
    const entry = await addManualKnowledge({
      site: site(),
      actorClerkUserId: 'shop-demo.myshopify.com',
      title: 'Shipping',
      content: 'Ships in 2 days',
    });
    expect(entry.id).toBe('k-1');
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ widget_site_id: 'site-1', title: 'Shipping' }),
    );
    expect(recordAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ siteId: 'site-1', actorClerkUserId: 'shop-demo.myshopify.com', action: 'knowledge_added' }),
    );
  });
});

describe('setKnowledgeStatus', () => {
  it('updates status scoped to the given site id', async () => {
    updateMock.mockReturnValue(chain({ error: null }));
    await setKnowledgeStatus({ site: site(), entryId: 'k-1', status: 'disabled' });
    expect(updateMock).toHaveBeenCalledWith({ status: 'disabled' });
  });
});

describe('removeKnowledge', () => {
  it('deletes scoped to the given site id and records an audit entry', async () => {
    deleteMock.mockReturnValue(chain({ error: null }));
    await removeKnowledge({ site: site(), actorClerkUserId: 'shop-demo.myshopify.com', entryId: 'k-1' });
    expect(recordAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'knowledge_removed', detail: { id: 'k-1' } }),
    );
  });
});
