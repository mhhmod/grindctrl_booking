import React from 'react';
import { requireDashboardUser } from '@/lib/auth/dashboard';
import type { SearchParams } from '@/lib/types';
import { getActiveStore } from '@/lib/dashboard/active-store-server';
import { flagStoreOf } from '@/lib/dashboard/active-store';
import { storeFlags } from '@/lib/flags/store-flags';
import { getRequestLocale } from '@/lib/auth/locale';
import { getInboxData, type InboxData } from '@/lib/dashboard/inbox-data';
import { V16Inbox, V16InboxError, V16InboxNoStoreChat } from '@/components/dashboard/v16/inbox/v16-inbox';
import { V16NoStore } from '@/components/dashboard/v16/states';
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

  /* The v16 Inbox (04-dashboard.md): today's conversation panel for the
     active store's Store Chat site, under the board's tabs. */
  const activeStore = await getActiveStore({ site: params.site });
  const locale = await getRequestLocale();
  const flagStore = flagStoreOf(activeStore);
  if (!flagStore) return <V16NoStore locale={locale} />;
  if (!activeStore.siteId) return <V16InboxNoStoreChat locale={locale} />;
  const features = await storeFlags(flagStore);
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
        listInboxConversations: conversationActions.listInboxConversations,
        inboxChangesSince: conversationActions.inboxChangesSince,
        inboxHandoffsSince: conversationActions.inboxHandoffsSince,
      }}
      fetchCustomer={fetchInboxCustomer}
    />
  ) : (
    <V16InboxError locale={locale} />
  );
}
