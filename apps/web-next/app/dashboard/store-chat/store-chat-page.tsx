import React from 'react';
import Link from 'next/link';
import { currentUser } from '@clerk/nextjs/server';
import { Badge } from '@/components/ui/badge';
import { requireDashboardUser } from '@/lib/auth/dashboard';
import {
  ensureMessengerSite,
  getProfileId,
  listMessengerSites,
  listTeamSites,
  provisionableShopDomain,
  resolveProvisionedSites,
  shouldEnsureMessengerSite,
  wasDisconnectedBySelf,
} from '@/lib/messenger/provisioning';
import { StoreOwnedByAnotherAccountError } from '@/lib/messenger/shop-tenancy';
import { diffMessengerConfig, mergeDraftOverPublished, resolveMessengerConfig } from '@/lib/messenger/config';
import {
  resolveAssigneeNames,
  listWorkspaceMembers,
  summarizeConversations,
  type ConversationSummary,
  getOverviewStats,
  getWidgetLastSeenAt,
  listConversationsForSite,
} from '@/lib/messenger/conversations';
import { listKnowledge } from '@/lib/messenger/knowledge';
import { listCannedReplies } from '@/lib/messenger/canned-replies';
import { listManagedTryOnShops } from '@/lib/shopify/shops';
import { getActiveStore } from '@/lib/dashboard/active-store-server';
import { hasShopOrderAccess } from '@/lib/shopify/tokens';
import { getRequestLocale } from '@/lib/auth/locale';
import { toPublicPayload } from '@/lib/messenger/public-api';
import { MessengerTabs, type MessengerTabId } from '@/components/dashboard/messenger/messenger-tabs';
import type { PublicMessengerPayload } from '@/lib/messenger/public-api';
import * as messengerActions from './actions';
import { isTryOnPlatformOperator } from '@/lib/shopify/platform-operator';
import { flagStoreForSite, storeFlagRows, storeFlags } from '@/lib/flags/store-flags';
import { getShopTimezone } from '@/lib/shopify/shop-timezone';
import { StoreFlagsCard } from '@/components/dashboard/store-flags-card';
import { roleCan } from '@/lib/rbac/dashboard-policy';
import { getChatKnowsCopy } from '@/lib/dashboard/chat-knows-copy';
import { buildChatHead, buildPagesAndNotes } from '@/lib/dashboard/chat-knows-model';
import { V16ChatFrame, V16ChatKnows, V16ChatKnowsError } from '@/components/dashboard/v16/store-chat/v16-chat-knows';

const TAB_IDS = ['overview', 'appearance', 'ai', 'behaviour', 'conversations', 'installation'] as const;

const TAB_COPY = {
  en: {
    overview: 'Overview',
    appearance: 'Appearance',
    aiKnowledge: 'AI & Knowledge',
    behaviour: 'Behaviour',
    conversations: 'Conversations',
    installation: 'Installation',
    live: 'Live',
    off: 'Off',
    hasDraft: 'Unpublished changes',
    storeTakenTitle: "This store's Store Chat is on another account",
    // The store's Try-On link is on this account, so the merchant can move
    // Store Chat themselves: a re-link from Shopify admin moves both.
    storeTakenBody:
      'To move it here: in Try-On, choose "Connect or re-link a store" to get a code. Then in your Shopify admin, open Apps, then GrindCTRL, choose "Link a different account" and enter the code.',
    storeTakenAction: 'Get a linking code',
  },
  ar: {
    overview: 'نظرة عامة',
    appearance: 'المظهر',
    aiKnowledge: 'الذكاء والمعرفة',
    behaviour: 'السلوك',
    conversations: 'المحادثات',
    installation: 'التثبيت',
    live: 'يعمل',
    off: 'متوقف',
    hasDraft: 'تغييرات غير منشورة',
    storeTakenTitle: 'محادثة المتجر لهذا المتجر على حساب آخر',
    storeTakenBody:
      'لنقلها إلى هنا: من صفحة التجربة اختر "ربط متجر أو إعادة ربطه" للحصول على رمز. ثم في لوحة تحكم شوبيفاي افتح التطبيقات ثم جريند كنترول، واختر "ربط حساب آخر" وأدخل الرمز.',
    storeTakenAction: 'احصل على رمز الربط',
  },
} as const;

/* The Store Chat page, drawn by both of its routes. Under v16_dashboard,
   /dashboard/store-chat is What it knows and /dashboard/store-chat/setup is
   Set up, today's page under the v16 tabs until ChatStudio and the Inbox
   land. A link with today's ?tab= (the handoff email, Today's Open inbox,
   bookmarks) still opens that tab, under Set up. Without the flag both
   routes draw today's page. */
export async function StoreChatPage({
  params,
  tab: route,
}: {
  params: { site?: string; tab?: string };
  tab: 'knows' | 'setup';
}) {
  const userId = await requireDashboardUser(route === 'setup' ? '/dashboard/store-chat/setup' : '/dashboard/store-chat');
  const locale = await getRequestLocale();
  const copy = TAB_COPY[locale === 'ar' ? 'ar' : 'en'];

  /* Clerk holds the address the merchant actually reads; the profiles row
     is only a mirror. Notifications are unsendable without this. */
  const clerkUser = await currentUser();
  const merchantEmail =
    clerkUser?.primaryEmailAddress?.emailAddress ?? clerkUser?.emailAddresses[0]?.emailAddress ?? null;

  let sites = await listMessengerSites(userId, merchantEmail);
  // Give a first-time merchant a site immediately, and revisit provisioning
  // when Try-On later learns a domain that none of the existing sites has yet.
  let domain: string | null = null;
  let shops: Awaited<ReturnType<typeof listManagedTryOnShops>> = [];
  try {
    shops = await listManagedTryOnShops();
    domain = provisionableShopDomain(shops);
  } catch {
    // Try-On lookup is optional here.
  }
  if (domain && (await wasDisconnectedBySelf(domain, userId))) {
    // This merchant deliberately disconnected this exact store (see
    // disconnectSiteAction / unclaimSite). Without this, the very next
    // load of this page would silently hand it right back the moment
    // Try-On still reports the domain installed — undoing the disconnect
    // with no warning. Only a real reclaim (app/claim/page.tsx, which
    // re-verifies the Shopify owner email) should bring it back; treat
    // Try-On's hint as absent so the block below falls through to its
    // existing "give a first-time merchant a blank site" path instead.
    domain = null;
  }
  if (shouldEnsureMessengerSite(sites, domain)) {
    try {
      const ensured = await ensureMessengerSite(userId, domain, domain ?? undefined);
      /* The refetch is what surfaces a domain ensureMessengerSite just attached
         to an existing row, so it has to happen. But it resolves the workspace
         again, and ensureWorkspace has no unique key on owner_profile_id — a
         concurrent first visit can leave a second workspace behind and the
         refetch then comes back empty for the row we just created. That
         crashed this page in production (`selected.settings_json` on
         undefined) the first time it raced. Falling back to the row
         ensureMessengerSite returned restores the guarantee the previous
         `sites = [await ensureMessengerSite(...)]` had: after this block,
         sites is never empty. */
      sites = resolveProvisionedSites(await listMessengerSites(userId, merchantEmail), ensured);
    } catch (error) {
      // A different real account already owns this store's config — not the
      // transient failure error.tsx's generic "trying again usually works"
      // copy implies, and not something a retry could ever fix. Say so here
      // instead of letting it escape to that boundary and 500 forever.
      if (error instanceof StoreOwnedByAnotherAccountError) {
        return (
          <section
            dir={locale === 'ar' ? 'rtl' : 'ltr'}
            className="grid min-w-0 place-items-center px-4 py-16"
          >
            <div className="grid max-w-md gap-2 text-center">
              <h1 className="text-lg font-semibold">{copy.storeTakenTitle}</h1>
              <p className="text-sm text-muted-foreground">{copy.storeTakenBody}</p>
              <Link
                href="/dashboard/try-on"
                className="mx-auto mt-2 inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
              >
                {copy.storeTakenAction}
              </Link>
            </div>
          </section>
        );
      }
      throw error;
    }
  }

  /* Then the sites of every team this person is on (item 12), which they
     may open but never provision. */
  const ownSiteIds = new Set(sites.map((site) => site.id));
  const teamSites = (await listTeamSites(userId)).filter((site) => !ownSiteIds.has(site.id));
  sites = [...sites, ...teamSites];

  /* The dashboard's active store (phase zero item 33), so Store Chat opens
     on the same store as Try-On: the link's site, then the active store's
     own site or the site on its Shopify domain, then the first site with a
     domain. Only one of this merchant's sites can be picked. */
  const activeStore = await getActiveStore({ site: params.site }, { shops, sites });
  const selected =
    sites.find((site) => site.id === params.site) ??
    sites.find((site) => site.id === activeStore.siteId) ??
    (activeStore.shopDomain
      ? sites.find((site) => site.domain?.trim().toLowerCase() === activeStore.shopDomain)
      : undefined) ??
    sites.find((site) => site.domain) ??
    sites[0];
  const { config, hasDraft } = mergeDraftOverPublished(selected.settings_json, selected.settings_draft);
  const canRevert = Boolean((selected.settings_json as Record<string, unknown>)._previousSettings);
  // Only the store's owner may disconnect it (item 12).
  const selectedRole = teamSites.find((site) => site.id === selected.id)?.role ?? 'owner';
  const canDisconnect = Boolean(selected.domain) && roleCan(selectedRole, 'store');
  const publishedConfig = resolveMessengerConfig(selected.settings_json);
  const configDiff = diffMessengerConfig(publishedConfig, config);
  // The store's v16 flags, so the preview and the editors show what is on.
  const flagStore = flagStoreForSite(selected);
  const [features, shopTimezone] = await Promise.all([
    storeFlags(flagStore),
    'shopDomain' in flagStore ? getShopTimezone(flagStore.shopDomain) : Promise.resolve(null),
  ]);

  const payload: PublicMessengerPayload = toPublicPayload(
    {
      name: selected.name,
      embed_key: selected.embed_key,
      status: selected.status,
      settings_version: selected.settings_version,
      config,
    },
    new Date(),
    features,
  );

  const linkedTab = (TAB_IDS as readonly string[]).includes(params.tab ?? '');
  const tab: MessengerTabId = linkedTab ? (params.tab as MessengerTabId) : 'overview';

  /* What it knows reads only its own two parts: the 7-day numbers for the
     head, and the knowledge. The head is left without its line when the
     numbers cannot be read; the knowledge is required. */
  const v16 = features.includes('v16_dashboard');
  const knowsCopy = getChatKnowsCopy(locale);
  if (v16 && route === 'knows' && !linkedTab) {
    const [statsRead, knowledgeRead] = await Promise.allSettled([getOverviewStats(selected.id), listKnowledge(selected.id)]);
    const head = buildChatHead(
      {
        active: selected.status === 'active',
        domain: selected.domain,
        solved7: statsRead.status === 'fulfilled' ? statsRead.value.aiResolved7d : null,
        handedOff7: statsRead.status === 'fulfilled' ? statsRead.value.handedOff7d : null,
      },
      knowsCopy,
    );
    for (const failed of [statsRead, knowledgeRead]) {
      if (failed.status === 'rejected') console.error('[store chat] what it knows failed:', failed.reason);
    }
    if (knowledgeRead.status === 'rejected') return <V16ChatKnowsError locale={locale} head={head} />;
    return (
      <V16ChatKnows
        locale={locale}
        head={head}
        pages={buildPagesAndNotes(knowledgeRead.value, knowsCopy)}
        siteId={selected.id}
        actions={{
          addKnowledge: messengerActions.addKnowledge,
          updateKnowledgeStatus: messengerActions.updateKnowledgeStatus,
          deleteKnowledge: messengerActions.deleteKnowledge,
          syncKnowledge: messengerActions.syncKnowledge,
        }}
      />
    );
  }

  /* One parallel pass for every panel. Tabs switch in the client now, so
     fetching per-tab would only move the wait to each click; these are small
     scoped reads and settle together in about the time the slowest takes. */
  let stats: Awaited<ReturnType<typeof getOverviewStats>> | null = null;
  let conversations: Awaited<ReturnType<typeof listConversationsForSite>> = [];
  let knowledge: Awaited<ReturnType<typeof listKnowledge>> = [];
  let cannedReplies: Awaited<ReturnType<typeof listCannedReplies>> = [];
  let storeDetectedAt: string | null = null;

  const [statsRes, conversationsRes, knowledgeRes, cannedRepliesRes, detectedRes, ordersRes] =
    await Promise.allSettled([
      getOverviewStats(selected.id),
      listConversationsForSite(selected.id),
      listKnowledge(selected.id),
      listCannedReplies(selected.id),
      getWidgetLastSeenAt(selected.id),
      selected.domain ? hasShopOrderAccess(selected.domain) : Promise.resolve(false),
    ]);

  if (statsRes.status === 'fulfilled') stats = statsRes.value;
  if (conversationsRes.status === 'fulfilled') conversations = conversationsRes.value;
  // One query for the whole page rather than one per row.
  const summaries = await summarizeConversations(conversations).catch(
    (): Record<string, ConversationSummary> => ({}),
  );
  // Who each taken-over conversation is assigned to, resolved once for the
  // whole list. Names are a hint, not the inbox itself — a failed lookup
  // leaves them blank rather than breaking the page.
  const assigneeIds = [
    ...new Set(
      conversations.map((c) => c.assigned_profile_id).filter((id): id is string => Boolean(id)),
    ),
  ];
  const assigneeNames =
    assigneeIds.length > 0
      ? await resolveAssigneeNames(selected.workspace_id, assigneeIds).catch(
          (): Record<string, string> => ({}),
        )
      : {};
  const assignableMembers = await listWorkspaceMembers(selected.workspace_id).catch(
    (): Array<{ profileId: string; name: string }> => [],
  );
  // The "assigned to me" filter needs the viewer's own profile. A lookup
  // failure hides the filter instead of breaking the page.
  const currentProfileId = await getProfileId(userId).catch((): string | null => null);
  if (knowledgeRes.status === 'fulfilled') knowledge = knowledgeRes.value;
  if (cannedRepliesRes.status === 'fulfilled') cannedReplies = cannedRepliesRes.value;
  if (detectedRes.status === 'fulfilled') storeDetectedAt = detectedRes.value;
  const ordersAuthorized = ordersRes.status === 'fulfilled' ? ordersRes.value : false;
  // Only the platform operator sees, or may change, this store's v16 flags.
  const flagRows = (await isTryOnPlatformOperator()) ? await storeFlagRows(flagStore) : null;
  for (const failed of [statsRes, conversationsRes, knowledgeRes, cannedRepliesRes, detectedRes, ordersRes]) {
    if (failed.status === 'rejected') {
      // One slow or broken panel must not take the whole section down.
      console.error('[messenger] dashboard data failed:', failed.reason);
    }
  }

  const body = (
    <section className="grid min-w-0 gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Under v16 the frame's badge says whether it is live. */}
          {!v16 && (
            <Badge variant={selected.status === 'active' ? 'default' : 'secondary'}>
              {selected.status === 'active' ? copy.live : copy.off}
            </Badge>
          )}
          {hasDraft && <Badge variant="outline">{copy.hasDraft}</Badge>}
        </div>
        {sites.length > 1 && (
          <nav aria-label={locale === 'ar' ? 'اختر المتجر' : 'Choose store'} className="flex flex-wrap gap-1">
            {sites.map((site) => (
              <Link
                key={site.id}
                href={`/dashboard/store-chat?site=${site.id}&tab=${tab}`}
                className={`rounded-full border px-3 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 ${
                  site.id === selected.id
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border hover:bg-accent'
                }`}
              >
                {site.name}
              </Link>
            ))}
          </nav>
        )}
      </div>

      <MessengerTabs
        locale={locale}
        initialTab={tab}
        siteId={selected.id}
        siteName={selected.name}
        domain={selected.domain}
        embedKey={selected.embed_key}
        active={selected.status === 'active'}
        version={selected.settings_version}
        detectedAt={storeDetectedAt}
        ordersAuthorized={ordersAuthorized}
        config={config}
        payload={payload}
        stats={stats}
        conversations={conversations.map((c) => ({
          id: c.id,
          status: c.status,
          startedAt: c.started_at,
          lastMessageAt: c.last_message_at,
          visitorEmail: c.visitor_email,
          visitorName: c.visitor_name,
          handoffReason: c.handoff_reason,
          assigneeId: c.assigned_profile_id,
          assigneeName: c.assigned_profile_id ? (assigneeNames[c.assigned_profile_id] ?? null) : null,
          unreadCount: summaries[c.id]?.unread ?? 0,
      preview: summaries[c.id]?.preview ?? null,
          tags: features.includes('n25_handoff_rules') ? (c.metadata.tags ?? []) : undefined,
        }))}
        knowledge={knowledge}
        cannedReplies={cannedReplies}
        actions={messengerActions}
        hasDraft={hasDraft}
        canRevert={canRevert}
        canDisconnect={canDisconnect}
        configDiff={configDiff}
        currentProfileId={currentProfileId}
        assignableMembers={assignableMembers}
        shopTimezone={shopTimezone}
      />

      {flagRows && (
        <StoreFlagsCard
          kind={'shopDomain' in flagStore ? 'shop' : 'site'}
          storeKey={'shopDomain' in flagStore ? flagStore.shopDomain : flagStore.widgetSiteId}
          storeLabel={selected.domain ?? selected.name}
          rows={flagRows}
        />
      )}
    </section>
  );

  if (!v16) return body;
  return (
    <V16ChatFrame
      locale={locale}
      tab="setup"
      head={buildChatHead(
        {
          active: selected.status === 'active',
          domain: selected.domain,
          solved7: stats?.aiResolved7d ?? null,
          handedOff7: stats?.handedOff7d ?? null,
        },
        knowsCopy,
      )}
    >
      {body}
    </V16ChatFrame>
  );
}
