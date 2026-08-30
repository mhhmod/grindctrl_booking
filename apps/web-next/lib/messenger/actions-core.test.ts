import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MessengerSiteView } from './provisioning';

const { updateMock, recordAuditMock } = vi.hoisted(() => ({
  updateMock: vi.fn(),
  recordAuditMock: vi.fn(),
}));

vi.mock('./db', () => ({
  getMessengerServiceClient: () => ({
    from: () => ({
      update: updateMock,
    }),
  }),
}));
vi.mock('./conversations', () => ({ recordAudit: recordAuditMock }));

import { publishConfigForSite, saveDraftSectionForSite, setMessengerEnabledForSite } from './actions-core';

function site(overrides: Partial<MessengerSiteView> = {}): MessengerSiteView {
  return {
    id: 'site-1',
    workspace_id: 'ws-1',
    name: 'Demo',
    embed_key: 'gc_demo',
    status: 'draft',
    domain: 'demo.myshopify.com',
    settings_json: {},
    settings_version: 3,
    settings_draft: null,
    hasDraft: false,
    ...overrides,
  };
}

function chain(result: { data?: unknown; error?: { message: string } | null }) {
  const builder = {
    eq: vi.fn(() => builder),
    select: vi.fn(() => builder),
    then: (resolve: (value: typeof result) => unknown) => resolve(result),
  };
  return builder;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('saveDraftSectionForSite', () => {
  it('rejects a section name outside the registry', async () => {
    updateMock.mockReturnValue(chain({ error: null }));
    const result = await saveDraftSectionForSite(site(), 'not-a-real-section' as never, {});
    expect(result).toEqual({ ok: false, error: 'Unknown section.' });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('merges the section into the existing draft and writes it', async () => {
    updateMock.mockReturnValue(chain({ error: null }));
    const result = await saveDraftSectionForSite(
      site({ settings_draft: { messenger_appearance: { accentColor: '#000000' } } }),
      'behaviour',
      { greetingEnabled: false },
    );
    expect(result).toEqual({ ok: true });
    expect(updateMock).toHaveBeenCalledWith({
      settings_draft: {
        messenger_appearance: { accentColor: '#000000' },
        messenger_behaviour: { greetingEnabled: false },
      },
    });
  });
});

describe('publishConfigForSite', () => {
  it('refuses to publish an empty draft', async () => {
    const result = await publishConfigForSite(site({ settings_draft: null }), 'actor-1');
    expect(result).toEqual({ ok: false, error: 'Nothing to publish yet.' });
  });

  it('reports a concurrent publish instead of overwriting it silently', async () => {
    updateMock.mockReturnValue(chain({ data: [], error: null }));
    const result = await publishConfigForSite(
      site({ settings_draft: { messenger_ai: { enabled: true } } }),
      'actor-1',
    );
    expect(result).toEqual({
      ok: false,
      error: 'Someone else published while you were editing. Refresh and try again.',
    });
    expect(recordAuditMock).not.toHaveBeenCalled();
  });

  it('publishes, bumps the version, and records an audit entry', async () => {
    updateMock.mockReturnValue(chain({ data: [{ id: 'site-1' }], error: null }));
    const result = await publishConfigForSite(
      site({ settings_version: 3, settings_draft: { messenger_ai: { enabled: true } } }),
      'actor-1',
    );
    expect(result).toEqual({ ok: true, message: 'Published — live on your store within a minute.' });
    expect(recordAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ siteId: 'site-1', actorClerkUserId: 'actor-1', action: 'config_published' }),
    );
  });
});

describe('setMessengerEnabledForSite', () => {
  it('flips status and records the matching audit action', async () => {
    updateMock.mockReturnValue(chain({ error: null }));
    const result = await setMessengerEnabledForSite(site(), 'actor-1', true);
    expect(result).toEqual({ ok: true });
    expect(updateMock).toHaveBeenCalledWith({ status: 'active' });
    expect(recordAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'messenger_enabled' }),
    );
  });
});
