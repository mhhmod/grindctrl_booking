import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/dashboard', () => ({
  requireDashboardUser: vi.fn(),
}));

/* The v16 Inbox page: which state it draws. Its reads and panel have their
   own tests (lib/dashboard/inbox-data.test.ts, v16-inbox.test.tsx). */
const v16 = vi.hoisted(() => ({
  active: vi.fn(),
  flags: vi.fn(async (): Promise<string[]> => []),
  data: vi.fn(),
  customer: vi.fn(),
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
vi.mock('./actions', () => ({ fetchInboxCustomer: v16.customer }));
vi.mock('@/components/dashboard/v16/states', () => ({
  V16NoStore: ({ locale }: { locale: string }) => <div data-testid="no-store">{locale}</div>,
}));
vi.mock('@/components/dashboard/v16/inbox/v16-inbox', () => ({
  V16Inbox: ({ data, fetchCustomer }: { data: { siteId: string; conversations: unknown[] }; fetchCustomer?: unknown }) => (
    <div data-testid="v16-inbox" data-customer={fetchCustomer === v16.customer ? 'yes' : 'no'}>
      {data.siteId}:{data.conversations.length}
    </div>
  ),
  V16InboxNoStoreChat: () => <div data-testid="v16-inbox-no-site" />,
  V16InboxError: () => <div data-testid="v16-inbox-error" />,
}));

import DashboardInboxPage from '@/app/dashboard/inbox/page';
import { requireDashboardUser } from '@/lib/auth/dashboard';

describe('DashboardInboxPage', () => {
  beforeEach(() => {
    v16.active.mockResolvedValue({ shopDomain: 'alpha.myshopify.com', siteId: 'site_1' });
    v16.flags.mockResolvedValue([]);
    v16.data.mockReset().mockResolvedValue({ siteId: 'site_1', conversations: [{}, {}], cannedReplies: [], currentProfileId: null, assignableMembers: [] });
    vi.mocked(requireDashboardUser).mockResolvedValue('user_123');
  });

  it('draws the v16 Inbox for the active store’s Store Chat site, with no flag to switch it on', async () => {
    render(await DashboardInboxPage({ searchParams: Promise.resolve({ site: 'site_1' }) }));
    expect(requireDashboardUser).toHaveBeenCalledWith('/dashboard/inbox');
    expect(v16.active).toHaveBeenCalledWith({ site: 'site_1' });
    expect(v16.data).toHaveBeenCalledWith({ userId: 'user_123', siteId: 'site_1', withTags: false });
    expect(screen.getByTestId('v16-inbox')).toHaveTextContent('site_1:2');
    // The customer column reads the open conversation's shopper through this action.
    expect(screen.getByTestId('v16-inbox')).toHaveAttribute('data-customer', 'yes');
  });

  it('tells a new account with no store how to connect one', async () => {
    v16.active.mockResolvedValue({ shopDomain: null, siteId: null });
    render(await DashboardInboxPage({}));
    expect(screen.getByTestId('no-store')).toHaveTextContent('en');
    expect(v16.data).not.toHaveBeenCalled();
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
