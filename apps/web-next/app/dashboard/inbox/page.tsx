import React from 'react';
import { InboxWorkspace } from '@/components/dashboard/inbox-workspace';
import { requireDashboardUser } from '@/lib/auth/dashboard';
import { getWorkspaceBundle } from '@/lib/adapters/workspace';
import { getWidgetEventAnalyticsBundle, normalizeWidgetEventsWindow } from '@/lib/adapters/widgetEvents';
import { selectWidgetSite } from '@/lib/adapters/widgetSites';
import type { SearchParams, WidgetEventAnalyticsBundle, WidgetEventsWindow } from '@/lib/types';
import { getActiveStore } from '@/lib/dashboard/active-store-server';
import { storeFlags } from '@/lib/flags/store-flags';
import { getRequestLocale } from '@/lib/auth/locale';
import { getInboxData, type InboxData } from '@/lib/dashboard/inbox-data';
import { V16Inbox, V16InboxError, V16InboxNoStoreChat } from '@/components/dashboard/v16/inbox/v16-inbox';
import * as conversationActions from '@/app/dashboard/store-chat/actions';
import { fetchInboxCustomer } from './actions';

type Props = {
  searchParams?: Promise<SearchParams>;
};

async function resolveSearchParams(searchParams?: Promise<SearchParams>) {
  return (await searchParams) ?? {};
}

export default async function DashboardInboxPage({ searchParams }: Props) {
  const params = await resolveSearchParams(searchParams);
  const clerkUserId = await requireDashboardUser('/dashboard/inbox');

  /* The v16 Inbox (04-dashboard.md) for an active store whose v16_dashboard
     flag is on, chosen the way the layout chooses the shell: today's
     conversation panel for the active store's Store Chat site, under the
     board's tabs. Every other store keeps the page below. */
  const activeStore = await getActiveStore({ site: params.site });
  const flagStore = activeStore.shopDomain
    ? { shopDomain: activeStore.shopDomain }
    : activeStore.siteId
      ? { widgetSiteId: activeStore.siteId }
      : null;
  const features = flagStore ? await storeFlags(flagStore) : [];
  if (features.includes('v16_dashboard')) {
    const locale = await getRequestLocale();
    if (!activeStore.siteId) return <V16InboxNoStoreChat locale={locale} />;
    let data: InboxData | null = null;
    try {
      data = await getInboxData({ userId: clerkUserId, siteId: activeStore.siteId, withTags: features.includes('n25_handoff_rules') });
    } catch (error) {
      console.error('[inbox] failed:', error instanceof Error ? error.message : error);
    }
    return data ? (
      <V16Inbox
        locale={locale}
        data={data}
        actions={{
          fetchConversationMessages: conversationActions.fetchConversationMessages,
          staffReply: conversationActions.staffReply,
          pingStaffTyping: conversationActions.pingStaffTyping,
          addInternalNote: conversationActions.addInternalNote,
          takeoverConversation: conversationActions.takeoverConversation,
          assignConversationAction: conversationActions.assignConversationAction,
          releaseConversation: conversationActions.releaseConversation,
          closeConversationAction: conversationActions.closeConversationAction,
          markConversationRead: conversationActions.markConversationRead,
        }}
        fetchCustomer={fetchInboxCustomer}
      />
    ) : (
      <V16InboxError locale={locale} />
    );
  }

  const bundle = await getWorkspaceBundle(clerkUserId);
  const site = selectWidgetSite(bundle.sites, params.site);
  const selectedWindow = normalizeWidgetEventsWindow(params.window);

  if (!bundle.workspace || bundle.sites.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-zinc-700 bg-zinc-900 p-6 text-sm text-zinc-400">
        No widget sites are available yet. Add or connect a site before using Inbox.
      </div>
    );
  }

  if (!site) {
    return (
      <div className="rounded-3xl border border-dashed border-zinc-700 bg-zinc-900 p-6 text-sm text-zinc-400">
        No widget site could be selected for Inbox.
      </div>
    );
  }

  let analytics: WidgetEventAnalyticsBundle = {
    timeseries: [],
    breakdown: [],
    funnel: null,
  };

  try {
    analytics = await getWidgetEventAnalyticsBundle(clerkUserId, site.id, selectedWindow);
  } catch {
    // Keep inbox operational shell available even when analytics read fails.
  }

  const windowLinks = (['24h', '7d', '30d'] as WidgetEventsWindow[]).reduce(
    (acc, windowValue) => {
      const next = new URLSearchParams();
      next.set('site', site.id);
      next.set('window', windowValue);
      acc[windowValue] = `/dashboard/inbox?${next.toString()}`;
      return acc;
    },
    {} as Record<WidgetEventsWindow, string>,
  );

  return <InboxWorkspace sites={bundle.sites} selectedSiteId={site.id} analytics={analytics} selectedWindow={selectedWindow} windowLinks={windowLinks} />;
}
