import React from 'react';
import { redirect } from 'next/navigation';
import { currentUser } from '@clerk/nextjs/server';
import { requireDashboardUser } from '@/lib/auth/dashboard';
import {
  ensureMessengerSite,
  listMessengerSites,
  listTeamSites,
  provisionableShopDomain,
  resolveProvisionedSites,
  shouldEnsureMessengerSite,
  wasDisconnectedBySelf,
} from '@/lib/messenger/provisioning';
import { StoreOwnedByAnotherAccountError } from '@/lib/messenger/shop-tenancy';
import { diffMessengerConfig, mergeDraftOverPublished, resolveMessengerConfig } from '@/lib/messenger/config';
import { getOverviewStats, getWidgetLastSeenAt } from '@/lib/messenger/conversations';
import { listKnowledge } from '@/lib/messenger/knowledge';
import { listCannedReplies } from '@/lib/messenger/canned-replies';
import { listManagedTryOnShops } from '@/lib/shopify/shops';
import { getActiveStore } from '@/lib/dashboard/active-store-server';
import { hasShopOrderAccess } from '@/lib/shopify/tokens';
import { getRequestLocale } from '@/lib/auth/locale';
import { toPublicPayload } from '@/lib/messenger/public-api';
import { MessengerTabs } from '@/components/dashboard/messenger/messenger-tabs';
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
import { V16ChatStudio } from '@/components/dashboard/v16/store-chat/v16-chat-studio';
import { getChatStudioCopy } from '@/lib/dashboard/chat-studio-copy';
import { minutesSince } from '@/lib/dashboard/chat-studio-model';
import { legacyStoreChatHref, MORE_SETTINGS } from '@/lib/dashboard/store-chat-legacy-tab';
import { V16BackToSetUp, V16StoreTaken } from '@/components/dashboard/v16/states';

/* The editors on /dashboard/store-chat/setup/more, the ones Set up does not
   cover yet (see v16-chat-studio.tsx, More settings). */
const MORE_SECTIONS = ['appearance', 'behaviour'] as const;
type MoreSection = (typeof MORE_SECTIONS)[number];

/* The Store Chat page (04-dashboard.md), drawn by three routes:
   /dashboard/store-chat is What it knows, /dashboard/store-chat/setup is
   Set up (ChatStudio), and /dashboard/store-chat/setup/more holds the
   editors Set up does not cover yet. Today's six ?tab= screens are gone: a
   link that still carries one is redirected to the page that replaced it
   (lib/dashboard/store-chat-legacy-tab.ts). */
export async function StoreChatPage({
  params,
  tab: route,
}: {
  params: { site?: string; tab?: string; section?: string; orders?: string };
  tab: 'knows' | 'setup' | 'more';
}) {
  const userId = await requireDashboardUser(
    route === 'setup' ? '/dashboard/store-chat/setup' : route === 'more' ? MORE_SETTINGS : '/dashboard/store-chat',
  );
  const legacy = route === 'more' ? null : legacyStoreChatHref(params);
  if (legacy) redirect(legacy);
  const locale = await getRequestLocale();

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
      if (error instanceof StoreOwnedByAnotherAccountError) return <V16StoreTaken locale={locale} />;
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

  /* What it knows reads only its own two parts: the 7-day numbers for the
     head, and the knowledge. The head is left without its line when the
     numbers cannot be read; the knowledge is required. */
  const knowsCopy = getChatKnowsCopy(locale);
  // Setting Store Chat up is for owners and admins (item 12); the actions check it again.
  const canSetUp = roleCan(selectedRole, 'settings');
  if (route === 'knows') {
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
    if (knowledgeRead.status === 'rejected') return <V16ChatKnowsError locale={locale} head={head} canSetUp={canSetUp} />;
    return (
      <V16ChatKnows
        locale={locale}
        head={head}
        pages={buildPagesAndNotes(knowledgeRead.value, knowsCopy)}
        siteId={selected.id}
        canSetUp={canSetUp}
        actions={{
          addKnowledge: messengerActions.addKnowledge,
          updateKnowledgeStatus: messengerActions.updateKnowledgeStatus,
          deleteKnowledge: messengerActions.deleteKnowledge,
          syncKnowledge: messengerActions.syncKnowledge,
        }}
      />
    );
  }

  /* Set up is ChatStudio, on the same draft and publish. */
  if (route === 'setup') {
    if (!canSetUp) redirect('/dashboard/store-chat');
    const [statsRead, detectedRead, ordersRead, flagRows] = await Promise.allSettled([
      getOverviewStats(selected.id),
      getWidgetLastSeenAt(selected.id),
      selected.domain ? hasShopOrderAccess(selected.domain) : Promise.resolve(false),
      isTryOnPlatformOperator().then((operator) => (operator ? storeFlagRows(flagStore) : null)),
    ]);
    for (const failed of [statsRead, detectedRead, ordersRead, flagRows]) {
      if (failed.status === 'rejected') console.error('[store chat] set up failed:', failed.reason);
    }
    const stats = statsRead.status === 'fulfilled' ? statsRead.value : null;
    const operatorFlags = flagRows.status === 'fulfilled' ? flagRows.value : null;
    const lastSeenMinutes = minutesSince(detectedRead.status === 'fulfilled' ? detectedRead.value : null, new Date().getTime());
    return (
      <V16ChatFrame
        locale={locale}
        tab="setup"
        subtitle={getChatStudioCopy(locale).subtitle}
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
        <V16ChatStudio
          locale={locale}
          siteId={selected.id}
          published={publishedConfig}
          config={config}
          payload={payload}
          meta={{
            domain: selected.domain,
            embedKey: selected.embed_key,
            active: selected.status === 'active',
            version: selected.settings_version,
            canRevert,
            canDisconnect,
            ordersAuthorized: ordersRead.status === 'fulfilled' ? ordersRead.value : false,
            lastSeenMinutes,
            handoffRules: features.includes('n25_handoff_rules'),
          }}
          actions={{
            saveDraftSections: messengerActions.saveDraftSections,
            publishConfig: messengerActions.publishConfig,
            revertConfigAction: messengerActions.revertConfigAction,
            setMessengerEnabled: messengerActions.setMessengerEnabled,
            disconnectSiteAction: messengerActions.disconnectSiteAction,
            discardDraft: messengerActions.discardDraft,
            listDomainsAction: messengerActions.listDomainsAction,
            addDomainAction: messengerActions.addDomainAction,
            checkDomainAction: messengerActions.checkDomainAction,
            removeDomainAction: messengerActions.removeDomainAction,
          }}
        />
        {operatorFlags && (
          <StoreFlagsCard
            kind={'shopDomain' in flagStore ? 'shop' : 'site'}
            storeKey={'shopDomain' in flagStore ? flagStore.shopDomain : flagStore.widgetSiteId}
            storeLabel={selected.domain ?? selected.name}
            rows={operatorFlags}
          />
        )}
      </V16ChatFrame>
    );
  }

  /* More settings: today's Appearance and Behaviour editors, for what Set up
     does not cover yet (saved replies, hours, the widget's language, a custom
     icon, the launcher size), and where Shopify's order access grant returns.
     Their own tabs switch in the client. */
  if (!canSetUp) redirect('/dashboard/store-chat');
  const section: MoreSection = MORE_SECTIONS.find((id) => id === params.section) ?? 'behaviour';
  const [statsRead, cannedRead, ordersRead] = await Promise.allSettled([
    getOverviewStats(selected.id),
    listCannedReplies(selected.id),
    selected.domain ? hasShopOrderAccess(selected.domain) : Promise.resolve(false),
  ]);
  for (const failed of [statsRead, cannedRead, ordersRead]) {
    if (failed.status === 'rejected') console.error('[store chat] more settings failed:', failed.reason);
  }
  const stats = statsRead.status === 'fulfilled' ? statsRead.value : null;
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
      <V16BackToSetUp locale={locale} />
      <MessengerTabs
        locale={locale}
        initialTab={section}
        sections={MORE_SECTIONS}
        siteId={selected.id}
        siteName={selected.name}
        domain={selected.domain}
        embedKey={selected.embed_key}
        active={selected.status === 'active'}
        version={selected.settings_version}
        detectedAt={null}
        ordersAuthorized={ordersRead.status === 'fulfilled' ? ordersRead.value : false}
        config={config}
        payload={payload}
        stats={null}
        conversations={[]}
        knowledge={[]}
        cannedReplies={cannedRead.status === 'fulfilled' ? cannedRead.value : []}
        actions={messengerActions}
        hasDraft={hasDraft}
        canRevert={canRevert}
        canDisconnect={canDisconnect}
        configDiff={configDiff}
        shopTimezone={shopTimezone}
      />
    </V16ChatFrame>
  );
}
