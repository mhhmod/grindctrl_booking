import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/dashboard', () => ({
  requireDashboardUser: vi.fn(),
}));

vi.mock('@/lib/adapters/workspace', () => ({
  getWorkspaceBundle: vi.fn(),
}));

vi.mock('@/lib/adapters/widgetEvents', () => ({
  getWidgetEventAnalyticsBundle: vi.fn(),
  normalizeWidgetEventsWindow: vi.fn(),
}));

vi.mock('@/components/dashboard/site-selector', () => ({
  SiteSelector: () => <div data-testid="site-selector" />,
}));

/* The v16 Inbox, behind v16_dashboard. Its reads and panel have their own
   tests (lib/dashboard/inbox-data.test.ts, v16-inbox.test.tsx). */
const v16 = vi.hoisted(() => ({
  active: vi.fn(),
  flags: vi.fn(async (): Promise<string[]> => []),
  data: vi.fn(),
}));
vi.mock('@/lib/dashboard/active-store-server', () => ({ getActiveStore: v16.active }));
vi.mock('@/lib/flags/store-flags', () => ({ storeFlags: v16.flags }));
vi.mock('@/lib/auth/locale', () => ({ getRequestLocale: vi.fn(async () => 'en') }));
vi.mock('@/lib/dashboard/inbox-data', () => ({ getInboxData: v16.data }));
vi.mock('@/app/dashboard/store-chat/actions', () => ({
  fetchConversationMessages: vi.fn(),
  staffReply: vi.fn(),
  pingStaffTyping: vi.fn(),
  addInternalNote: vi.fn(),
  takeoverConversation: vi.fn(),
  assignConversationAction: vi.fn(),
  releaseConversation: vi.fn(),
  closeConversationAction: vi.fn(),
  markConversationRead: vi.fn(),
}));
vi.mock('@/components/dashboard/v16/inbox/v16-inbox', () => ({
  V16Inbox: ({ data }: { data: { siteId: string; conversations: unknown[] } }) => (
    <div data-testid="v16-inbox">
      {data.siteId}:{data.conversations.length}
    </div>
  ),
  V16InboxNoStoreChat: () => <div data-testid="v16-inbox-no-site" />,
  V16InboxError: () => <div data-testid="v16-inbox-error" />,
}));

import DashboardInboxPage from '@/app/dashboard/inbox/page';
import { requireDashboardUser } from '@/lib/auth/dashboard';
import { getWorkspaceBundle } from '@/lib/adapters/workspace';
import { getWidgetEventAnalyticsBundle, normalizeWidgetEventsWindow } from '@/lib/adapters/widgetEvents';

describe('DashboardInboxPage', () => {
  beforeEach(() => {
    v16.active.mockResolvedValue({ shopDomain: 'alpha.myshopify.com', siteId: 'site_1' });
    v16.flags.mockResolvedValue([]);
    vi.mocked(requireDashboardUser).mockResolvedValue('user_123');
    vi.mocked(normalizeWidgetEventsWindow).mockReturnValue('7d');
    vi.mocked(getWorkspaceBundle).mockResolvedValue({
      workspace: { id: 'workspace_1', name: 'Workspace' },
      role: 'owner',
      sites: [{ id: 'site_1', workspace_id: 'workspace_1', name: 'Main Site', embed_key: 'gc_live_real_embed', status: 'active', settings_json: {} }],
    });
    vi.mocked(getWidgetEventAnalyticsBundle).mockResolvedValue({
      timeseries: [],
      breakdown: [
        { event_name: 'conversation_start', total_count: 12 },
        { event_name: 'message_sent', total_count: 36 },
        { event_name: 'escalation_trigger', total_count: 3 },
      ],
      funnel: null,
    });
  });

  it('renders inbox workspace shell and summary metrics', async () => {
    const result = await DashboardInboxPage({ searchParams: Promise.resolve({}) });
    render(result);

    expect(requireDashboardUser).toHaveBeenCalledWith('/dashboard/inbox');
    expect(screen.getByText('Inbox')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('36')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText(/Conversation list rows are blocked/)).toBeInTheDocument();
  });

  describe('under v16_dashboard', () => {
    beforeEach(() => {
      v16.flags.mockResolvedValue(['v16_dashboard']);
      v16.data.mockReset().mockResolvedValue({ siteId: 'site_1', conversations: [{}, {}], cannedReplies: [], currentProfileId: null, assignableMembers: [] });
    });

    it('draws the v16 Inbox for the active store’s Store Chat site, and reads no analytics', async () => {
      vi.mocked(getWorkspaceBundle).mockClear();
      render(await DashboardInboxPage({ searchParams: Promise.resolve({ site: 'site_1' }) }));
      expect(v16.active).toHaveBeenCalledWith({ site: 'site_1' });
      expect(v16.data).toHaveBeenCalledWith({ userId: 'user_123', siteId: 'site_1', withTags: false });
      expect(screen.getByTestId('v16-inbox')).toHaveTextContent('site_1:2');
      expect(getWorkspaceBundle).not.toHaveBeenCalled();
    });

    it('says Store Chat is not set up for a store without a site, and says so when the inbox cannot load', async () => {
      v16.active.mockResolvedValue({ shopDomain: 'alpha.myshopify.com', siteId: null });
      render(await DashboardInboxPage({}));
      expect(screen.getByTestId('v16-inbox-no-site')).toBeInTheDocument();

      v16.active.mockResolvedValue({ shopDomain: 'alpha.myshopify.com', siteId: 'site_1' });
      v16.data.mockRejectedValue(new Error('down'));
      vi.spyOn(console, 'error').mockImplementation(() => {});
      render(await DashboardInboxPage({}));
      expect(screen.getByTestId('v16-inbox-error')).toBeInTheDocument();
    });

    it('passes intent tags only while n25_handoff_rules is on', async () => {
      v16.flags.mockResolvedValue(['v16_dashboard', 'n25_handoff_rules']);
      render(await DashboardInboxPage({}));
      expect(v16.data).toHaveBeenCalledWith(expect.objectContaining({ withTags: true }));
    });
  });
});
