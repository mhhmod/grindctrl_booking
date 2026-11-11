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
vi.mock('@/app/dashboard/connect-shop/actions', () => ({ generateShopLinkCode: vi.fn() }));
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
  listMessengerSites: vi.fn(async () => [SITE]),
  listTeamSites: vi.fn(async () => []),
  provisionableShopDomain: vi.fn(() => null),
  resolveProvisionedSites: vi.fn((sites: unknown[]) => sites),
  shouldEnsureMessengerSite: vi.fn(() => false),
  wasDisconnectedBySelf: vi.fn(async () => false),
}));
vi.mock('@/lib/messenger/conversations', () => ({
  getOverviewStats: vi.fn(async () => ({ aiResolved7d: 120, handedOff7d: 20 })),
  getWidgetLastSeenAt: vi.fn(async () => null),
  listConversationsForSite: vi.fn(async () => []),
}));
vi.mock('@/lib/messenger/knowledge', () => ({ listKnowledge: vi.fn(async () => []) }));
vi.mock('@/lib/messenger/canned-replies', () => ({ listCannedReplies: vi.fn(async () => []) }));
vi.mock('@/lib/messenger/products', () => ({ readProductsStatus: vi.fn(async () => null) }));
vi.mock('@/lib/shopify/shops', () => ({ listManagedTryOnShops: vi.fn(async () => []) }));
vi.mock('@/lib/dashboard/active-store-server', () => ({
  getActiveStore: vi.fn(async () => ({ shopDomain: 'maison.myshopify.com', siteId: SITE.id })),
}));
vi.mock('@/lib/shopify/tokens', () => ({ hasShopOrderAccess: vi.fn(async () => false) }));
vi.mock('@/lib/shopify/platform-operator', () => ({ isTryOnPlatformOperator: vi.fn(async () => false) }));
vi.mock('@/lib/shopify/shop-timezone', () => ({ getShopTimezone: vi.fn(async () => 'Africa/Cairo') }));
vi.mock('@/lib/woo/connection', () => ({ getWooSiteConnection: vi.fn(async () => null) }));
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
  syncKnowledgeProducts: vi.fn(),
  saveDraftSections: vi.fn(),
  publishConfig: vi.fn(),
  revertConfigAction: vi.fn(),
  setMessengerEnabled: vi.fn(),
  disconnectSiteAction: vi.fn(),
  discardDraft: vi.fn(),
  uploadLauncherIconAction: vi.fn(),
  addCannedReply: vi.fn(),
  updateCannedReplyStatus: vi.fn(),
  deleteCannedReply: vi.fn(),
  listDomainsAction: vi.fn(),
  addDomainAction: vi.fn(),
  checkDomainAction: vi.fn(),
  removeDomainAction: vi.fn(),
}));
vi.mock('./woo-actions', () => ({ createWooPairingCodeAction: vi.fn(), readWooConnectionAction: vi.fn() }));
vi.mock('@/components/dashboard/v16/store-setup/store-connect', () => ({ StoreConnect: ({ siteId, actions }: { siteId: string; actions?: object }) => <div data-testid="store-connect" data-actions={actions ? Object.keys(actions).sort().join(',') : ''}>{siteId}</div> }));
// ChatStudio has its own tests (v16-chat-studio.test.tsx); here only what it is handed.
vi.mock('@/components/dashboard/v16/store-chat/v16-chat-studio', () => ({
  V16ChatStudio: ({
    meta,
    actions,
    cannedReplies,
  }: {
    meta: { version: number; domain: string | null; wooConnection: { status: string } | null; shopTimezone: string | null; ordersGrant: string | null };
    actions: object;
    cannedReplies: unknown[];
  }) => (
    <div data-testid="chat-studio" data-actions={Object.keys(actions).sort().join(',')}>
      {meta.domain}:{meta.version}:{meta.wooConnection?.status ?? 'none'}
      <span>{`replies:${cannedReplies.length}:${meta.shopTimezone}:${meta.ordersGrant ?? 'none'}`}</span>
    </div>
  ),
}));

import MessengerPage from './page';
import { StoreChatPage } from './store-chat-page';
import StoreChatSetupPage from './setup/page';
import { listCannedReplies } from '@/lib/messenger/canned-replies';
import { storeFlags } from '@/lib/flags/store-flags';
import { listKnowledge } from '@/lib/messenger/knowledge';
import { listConversationsForSite } from '@/lib/messenger/conversations';
import { listMessengerSites, listTeamSites, ensureMessengerSite, shouldEnsureMessengerSite } from '@/lib/messenger/provisioning';
import { StoreOwnedByAnotherAccountError } from '@/lib/messenger/shop-tenancy';
import { redirect } from 'next/navigation';

type Query = { tab?: string; site?: string; orders?: string };
const knows = (query: Query = {}) => MessengerPage({ searchParams: Promise.resolve(query) });
const setup = (query: Query = {}) => StoreChatSetupPage({ searchParams: Promise.resolve(query) });
const tabs = () => screen.queryByRole('navigation', { name: 'Store Chat' });

beforeEach(() => {
  vi.mocked(storeFlags).mockResolvedValue(['v16_dashboard']);
  vi.mocked(listKnowledge).mockReset().mockResolvedValue([]);
  vi.mocked(listConversationsForSite).mockClear();
});

describe('the Store Chat routes', () => {
  it('renders install for the selected site with actions only for settings roles', async () => {
    render(await StoreChatPage({ params: {}, tab: 'install' }));
    expect(screen.getByTestId('store-connect')).toHaveTextContent(SITE.id);
    expect(screen.getByTestId('store-connect').getAttribute('data-actions')).toContain('paste');
    cleanup();
    vi.mocked(listMessengerSites).mockResolvedValueOnce([]);
    vi.mocked(listTeamSites).mockResolvedValueOnce([{ ...SITE, role: 'member' }] as never);
    render(await StoreChatPage({ params: {}, tab: 'install' }));
    expect(screen.getByTestId('store-connect')).toHaveAttribute('data-actions', '');
    expect(screen.queryByTestId('chat-studio')).not.toBeInTheDocument();
  });

  it('opens on What it knows, reading only the 7-day numbers and the knowledge', async () => {
    render(await knows());
    expect(within(tabs()!).getByRole('link', { name: 'What it knows' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('In the last 7 days the assistant answered 86% of 140 chats on its own.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'What it learns from' })).toBeInTheDocument();
    expect(listKnowledge).toHaveBeenCalledWith(SITE.id);
    expect(listConversationsForSite).not.toHaveBeenCalled();
    expect(screen.queryByTestId('more-settings')).not.toBeInTheDocument();
  });

  it('draws ChatStudio as Set up, on the draft and publish actions, without today’s reads', async () => {
    render(await setup());
    expect(within(tabs()!).getByRole('link', { name: 'Set up' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Every change shows in the preview first. Shoppers see it when you publish.')).toBeInTheDocument();
    expect(screen.getByTestId('chat-studio')).toHaveTextContent('maison.myshopify.com:3:none');
    expect(screen.getByTestId('chat-studio')).toHaveAttribute(
      'data-actions',
      'addCannedReply,addDomainAction,checkDomainAction,createWooPairingCodeAction,deleteCannedReply,discardDraft,disconnectSiteAction,listDomainsAction,paste,publishConfig,removeDomainAction,revertConfigAction,saveDraftSections,setMessengerEnabled,updateCannedReplyStatus,uploadLauncherIconAction',
    );
    expect(listConversationsForSite).not.toHaveBeenCalled();
  });

  it('sends a member to What it knows, which has no Set up tab', async () => {
    vi.mocked(listMessengerSites).mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    vi.mocked(listTeamSites).mockResolvedValueOnce([{ ...SITE, role: 'member' }] as never).mockResolvedValueOnce([{ ...SITE, role: 'member' }] as never);
    await expect(setup()).rejects.toThrow('redirect:/dashboard/store-chat');
    render(await knows());
    expect(within(tabs()!).queryByRole('link', { name: 'Set up' })).not.toBeInTheDocument();
  });

  it('redirects a link with today’s ?tab= to the page that replaced it, on either route, keeping the store', async () => {
    await expect(setup({ tab: 'behaviour' })).rejects.toThrow('redirect:/dashboard/store-chat/setup');
    await expect(knows({ tab: 'appearance', site: SITE.id })).rejects.toThrow(`redirect:/dashboard/store-chat/setup?site=${SITE.id}`);
    await expect(knows({ tab: 'conversations', site: SITE.id })).rejects.toThrow(`redirect:/dashboard/inbox?site=${SITE.id}`);
    await expect(knows({ tab: 'overview' })).rejects.toThrow('redirect:/dashboard/store-chat');
    await expect(knows({ tab: 'installation' })).rejects.toThrow('redirect:/dashboard/store-chat/setup');
    await expect(setup({ tab: 'behaviour', orders: 'connected' })).rejects.toThrow(
      'redirect:/dashboard/store-chat/setup?orders=connected',
    );
    // Nothing is read for a link that only redirects.
    expect(listKnowledge).not.toHaveBeenCalled();
  });

  it('never draws the old tab screens, whatever the link says', async () => {
    for (const query of [{}, { tab: 'nope' }]) {
      render(await knows(query));
      expect(screen.queryByTestId('more-settings')).not.toBeInTheDocument();
      expect(tabs()).toBeInTheDocument();
      cleanup();
    }
  });

  it('says so when the knowledge cannot be read', async () => {
    vi.mocked(listKnowledge).mockRejectedValue(new Error('down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(await knows());
    expect(screen.getByRole('status')).toHaveTextContent("What the assistant knows couldn't load just now.");
  });

  it('hands Set up the saved replies, the store’s time zone and the order access answer Shopify returned', async () => {
    vi.mocked(listCannedReplies).mockResolvedValueOnce([{ id: 'r1' }, { id: 'r2' }] as never);
    render(await setup({ orders: 'connected' }));
    expect(screen.getByTestId('chat-studio')).toHaveTextContent('replies:2:Africa/Cairo:connected');
    const given = screen.getByTestId('chat-studio').getAttribute('data-actions') ?? '';
    for (const action of ['uploadLauncherIconAction', 'addCannedReply', 'updateCannedReplyStatus', 'deleteCannedReply']) expect(given).toContain(action);
    cleanup();
    render(await setup({ orders: 'nonsense' }));
    expect(screen.getByTestId('chat-studio')).toHaveTextContent('replies:0:Africa/Cairo:none');
  });

  it('no longer has a More settings screen: its link is gone from Set up', async () => {
    render(await setup());
    expect(screen.queryByTestId('more-settings')).not.toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain('setup/more');
  });

  it('says another account owns the store, with the way to move it, instead of failing', async () => {
    vi.mocked(shouldEnsureMessengerSite).mockReturnValueOnce(true);
    vi.mocked(ensureMessengerSite).mockRejectedValueOnce(new StoreOwnedByAnotherAccountError('maison.myshopify.com'));
    vi.mocked(redirect).mockClear();
    render(await knows());
    expect(screen.getByRole('heading', { name: 'This store’s Store Chat is on another account' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Get a linking code' })).toHaveAttribute('href', '/dashboard/try-on');
    expect(vi.mocked(redirect)).not.toHaveBeenCalled();
  });
});
