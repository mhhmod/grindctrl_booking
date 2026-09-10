import React from 'react';
import { ConversationInboxPreview } from '@/components/dashboard/conversation-inbox-preview';
import type { SearchParams } from '@/lib/types';
import { getRequestLocale } from '@/lib/auth/locale';
import { getConversationsCopy } from '@/lib/dashboard/dashboard-content-copy';

type Props = {
  searchParams?: Promise<SearchParams>;
};

async function resolveSearchParams(searchParams?: Promise<SearchParams>) {
  return (await searchParams) ?? {};
}

export default async function DashboardMessagesPage({ searchParams }: Props) {
  const locale = await getRequestLocale();
  const c = getConversationsCopy(locale);
  const params = await resolveSearchParams(searchParams);
  const selectedConversationId = typeof params.conversation === 'string' ? params.conversation : undefined;

  return (
    <ConversationInboxPreview
      selectedId={selectedConversationId}
      locale={locale}
      routeBase="/dashboard/messages"
      title={c.messagesTitle}
      description={c.messagesDescription}
    />
  );
}
