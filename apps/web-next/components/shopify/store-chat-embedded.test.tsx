import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { setMessengerEnabledMock } = vi.hoisted(() => ({ setMessengerEnabledMock: vi.fn() }));

vi.mock('@/lib/shopify/app-bridge-client', () => ({
  getShopifySessionToken: () => Promise.resolve('tok-abc'),
}));
vi.mock('@/components/shopify/store-chat-actions', () => ({
  useStoreChatActions: () => ({
    saveDraftSection: vi.fn(),
    setMessengerEnabled: setMessengerEnabledMock,
    addKnowledge: vi.fn(),
    updateKnowledgeStatus: vi.fn(),
    deleteKnowledge: vi.fn(),
    syncKnowledge: vi.fn(),
  }),
}));

import { StoreChatEmbedded } from './store-chat-embedded';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const STATE_RESPONSE = {
  site: {
    id: 'site-1',
    name: 'Demo store',
    domain: 'demo.myshopify.com',
    embedKey: 'gc_demo',
    active: true,
    version: 1,
    hasDraft: false,
    detectedAt: null,
  },
  config: {
    appearance: { accentColor: '#2a2826', launcherIcon: 'chat', launcherCustomIconUrl: null, launcherLabel: { en: 'Support', ar: 'الدعم' }, launcherSizePx: 56, position: 'bottom-right', radiusStyle: 'soft', themeMode: 'auto', assistantAvatarUrl: null },
    behaviour: { welcomeTitle: { en: 'Hi', ar: 'مرحباً' }, welcomeSubtitle: { en: 'Ask us', ar: 'اسألنا' }, inputPlaceholder: { en: 'Ask…', ar: 'اكتب…' }, greetingEnabled: true, greetingDelaySeconds: 6, greeting: null, proactiveEnabled: false, proactiveDelaySeconds: 30, proactiveCapPerVisitor: 1, targetingMode: 'everywhere', excludePatterns: [], availabilityMode: 'always', availabilityTimezone: 'UTC', availabilityHours: [] },
    ai: { enabled: false, tone: 'friendly', instructions: '', languageMode: 'auto', escalationEnabled: true },
    notifications: { emailOnHandoff: true, recipients: [] },
    contactCapture: { enabled: true, askOutsideHours: true },
    attachments: { enabled: false, triageEnabled: true },
    orderLookup: { enabled: false },
  },
  payload: { v: 1, key: 'gc_demo', storeName: 'Demo store', active: true, available: true, aiEnabled: false, attachmentsEnabled: false },
  stats: null,
  conversations: [],
  knowledge: [],
};

describe('StoreChatEmbedded', () => {
  it('fetches /state with a Bearer token and renders the overview once loaded', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve(STATE_RESPONSE) });

    render(<StoreChatEmbedded locale="en" />);

    expect(await screen.findByText('Demo store')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/shopify/store-chat/state',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer tok-abc' }) }),
    );
  });

  it('shows an error state when the state fetch fails', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: () => Promise.resolve({ ok: false, error: 'unavailable' }) });

    render(<StoreChatEmbedded locale="en" />);

    await waitFor(() => expect(screen.getByText(/could not load/i)).toBeInTheDocument());
  });

  it('re-pulls /state after a successful mutation, since there is no server revalidatePath here', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ...STATE_RESPONSE, site: { ...STATE_RESPONSE.site, active: false } }),
    });
    setMessengerEnabledMock.mockResolvedValue({ ok: true });

    render(<StoreChatEmbedded locale="en" />);
    await screen.findByText('Demo store');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fireEvent.click(await screen.findByRole('button', { name: 'Installation' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Turn on Store Chat' }));

    await waitFor(() => expect(setMessengerEnabledMock).toHaveBeenCalledWith('site-1', true));
    // The mocked action doesn't hit fetch at all — only the follow-up
    // loadState() call does, so a second /state call proves the wrapper
    // actually re-pulled fresh data rather than trusting the stale prop.
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });
});
