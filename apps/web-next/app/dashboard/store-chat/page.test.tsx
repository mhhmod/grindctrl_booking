import React from 'react';
import { cleanup, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithMantine as render } from '@/components/mantine/test-utils';

/* Which page each Store Chat route draws, behind v16_dashboard. The reads
   behind them are stubbed: each has its own tests. */

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/dashboard/store-chat',
  redirect: vi.fn((href: string) => {
    throw new Error(`redirect:${href}`);
  }),
}));
vi.mock('@clerk/nextjs/server', () => ({ currentUser: vi.fn(async () => ({ primaryEmailAddress: { emailAddress: 'hana@maisonnoor.com' }, emailAddresses: [] })) }));
vi.mock('@/lib/auth/dashboard', () => ({ requireDashboardUser: vi.fn(async () => 'user_owner') }));
vi.mock('@/lib/auth/locale', () => ({ getRequestLocale: vi.fn(async () => 'en') }));

const SITE = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Maison Noor',
  domain: 'maison.myshopify.com',
  status: 'active',
  embed_key: 'emb_test',
  settings_version: 3,
  settings_json: {},
  settings_draft: null,
  workspace_id: 'ws_1',
};

vi.mock('@/lib/messenger/provisioning', () => ({
  ensureMessengerSite: vi.fn(),
  getProfileId: vi.fn(async () => 'profile_1'),
  listMessengerSites: vi.fn(async () => [SITE]),
  listTeamSites: vi.fn(async () => []),
  provisionableShopDomain: vi.fn(() => null),
  resolveProvisionedSites: vi.fn((sites: unknown[]) => sites),
  shouldEnsureMessengerSite: vi.fn(() => false),
  wasDisconnectedBySelf: vi.fn(async () => false),
}));
vi.mock('@/lib/messenger/conversations', () => ({
  resolveAssigneeNames: vi.fn(async () => ({})),
  listWorkspaceMembers: vi.fn(async () => []),
  summarizeConversations: vi.fn(async () => ({})),
  getOverviewStats: vi.fn(async () => ({ aiResolved7d: 120, handedOff7d: 20 })),
  getWidgetLastSeenAt: vi.fn(async () => null),
  listConversationsForSite: vi.fn(async () => []),
}));
vi.mock('@/lib/messenger/knowledge', () => ({ listKnowledge: vi.fn(async () => []) }));
vi.mock('@/lib/messenger/canned-replies', () => ({ listCannedReplies: vi.fn(async () => []) }));
vi.mock('@/lib/shopify/shops', () => ({ listManagedTryOnShops: vi.fn(async () => []) }));
vi.mock('@/lib/dashboard/active-store-server', () => ({
  getActiveStore: vi.fn(async () => ({ shopDomain: 'maison.myshopify.com', siteId: SITE.id })),
}));
vi.mock('@/lib/shopify/tokens', () => ({ hasShopOrderAccess: vi.fn(async () => false) }));
vi.mock('@/lib/shopify/platform-operator', () => ({ isTryOnPlatformOperator: vi.fn(async () => false) }));
vi.mock('@/lib/shopify/shop-timezone', () => ({ getShopTimezone: vi.fn(async () => 'Africa/Cairo') }));
vi.mock('@/lib/flags/store-flags', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/flags/store-flags')>()),
  storeFlags: vi.fn(async () => []),
  storeFlagRows: vi.fn(async () => []),
}));
vi.mock('./actions', () => ({
  addKnowledge: vi.fn(),
  updateKnowledgeStatus: vi.fn(),
  deleteKnowledge: vi.fn(),
  syncKnowledge: vi.fn(),
  saveDraftSections: vi.fn(),
  publishConfig: vi.fn(),
  revertConfigAction: vi.fn(),
  setMessengerEnabled: vi.fn(),
  disconnectSiteAction: vi.fn(),
  discardDraft: vi.fn(),
  listDomainsAction: vi.fn(),
  addDomainAction: vi.fn(),
  checkDomainAction: vi.fn(),
  removeDomainAction: vi.fn(),
}));
// ChatStudio has its own tests (v16-chat-studio.test.tsx); here only what it is handed.
vi.mock('@/components/dashboard/v16/store-chat/v16-chat-studio', () => ({
  V16ChatStudio: ({ meta, actions }: { meta: { version: number; domain: string | null }; actions: object }) => (
    <div data-testid="chat-studio" data-actions={Object.keys(actions).sort().join(',')}>
      {meta.domain}:{meta.version}
    </div>
  ),
}));
// Today's tabs are covered by messenger-tabs.test.tsx; here only which tab opens.
vi.mock('@/components/dashboard/messenger/messenger-tabs', () => ({
  MessengerTabs: ({ initialTab }: { initialTab: string }) => <div data-testid="todays-store-chat">{initialTab}</div>,
}));

import MessengerPage from './page';
import StoreChatSetupPage from './setup/page';
import { storeFlags } from '@/lib/flags/store-flags';
import { listKnowledge } from '@/lib/messenger/knowledge';
import { listConversationsForSite } from '@/lib/messenger/conversations';
import { listMessengerSites, listTeamSites } from '@/lib/messenger/provisioning';

const knows = (query: { tab?: string } = {}) => MessengerPage({ searchParams: Promise.resolve(query) });
const setup = (query: { tab?: string } = {}) => StoreChatSetupPage({ searchParams: Promise.resolve(query) });
const tabs = () => screen.queryByRole('navigation', { name: 'Store Chat' });

beforeEach(() => {
  vi.mocked(storeFlags).mockResolvedValue(['v16_dashboard']);
  vi.mocked(listKnowledge).mockReset().mockResolvedValue([]);
  vi.mocked(listConversationsForSite).mockClear();
});

describe('the Store Chat routes under v16_dashboard', () => {
  it('opens on What it knows, reading only the 7-day numbers and the knowledge', async () => {
    render(await knows());
    expect(within(tabs()!).getByRole('link', { name: 'What it knows' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('In the last 7 days the assistant answered 86% of 140 chats on its own.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'What it learns from' })).toBeInTheDocument();
    expect(listKnowledge).toHaveBeenCalledWith(SITE.id);
    expect(listConversationsForSite).not.toHaveBeenCalled();
    expect(screen.queryByTestId('todays-store-chat')).not.toBeInTheDocument();
  });

  it('draws ChatStudio as Set up, on the draft and publish actions, without today’s reads', async () => {
    render(await setup());
    expect(within(tabs()!).getByRole('link', { name: 'Set up' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Every change shows in the preview first. Shoppers see it when you publish.')).toBeInTheDocument();
    expect(screen.getByTestId('chat-studio')).toHaveTextContent('maison.myshopify.com:3');
    expect(screen.getByTestId('chat-studio')).toHaveAttribute(
      'data-actions',
      'addDomainAction,checkDomainAction,discardDraft,disconnectSiteAction,listDomainsAction,publishConfig,removeDomainAction,revertConfigAction,saveDraftSections,setMessengerEnabled',
    );
    expect(screen.queryByTestId('todays-store-chat')).not.toBeInTheDocument();
    expect(listConversationsForSite).not.toHaveBeenCalled();
  });

  it('sends a member to What it knows, which has no Set up tab', async () => {
    vi.mocked(listMessengerSites).mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    vi.mocked(listTeamSites).mockResolvedValueOnce([{ ...SITE, role: 'member' }] as never).mockResolvedValueOnce([{ ...SITE, role: 'member' }] as never);
    await expect(setup()).rejects.toThrow('redirect:/dashboard/store-chat');
    render(await knows());
    expect(within(tabs()!).queryByRole('link', { name: 'Set up' })).not.toBeInTheDocument();
  });

  it('opens a linked tab of today’s page under Set up, so old links keep working', async () => {
    render(await setup({ tab: 'behaviour' }));
    expect(screen.getByTestId('todays-store-chat')).toHaveTextContent('behaviour');
    cleanup();

    render(await knows({ tab: 'conversations' }));
    expect(within(tabs()!).getByRole('link', { name: 'Set up' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByTestId('todays-store-chat')).toHaveTextContent('conversations');
  });

  it('says so when the knowledge cannot be read', async () => {
    vi.mocked(listKnowledge).mockRejectedValue(new Error('down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(await knows());
    expect(screen.getByRole('status')).toHaveTextContent("What the assistant knows couldn't load just now.");
  });

  it('draws today’s page with no tabs on either route when the flag is off', async () => {
    vi.mocked(storeFlags).mockResolvedValue([]);
    render(await knows());
    expect(tabs()).not.toBeInTheDocument();
    expect(screen.getByTestId('todays-store-chat')).toHaveTextContent('overview');
    expect(screen.getByText('Live')).toBeInTheDocument();
    cleanup();

    render(await setup());
    expect(tabs()).not.toBeInTheDocument();
    expect(screen.getByTestId('todays-store-chat')).toBeInTheDocument();
  });
});
