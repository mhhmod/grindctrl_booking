import React from 'react';
import { ConversationInboxPreview } from '@/components/dashboard/conversation-inbox-preview';
import type { SearchParams } from '@/lib/types';

type Props = {
  searchParams?: Promise<SearchParams>;
};

async function resolveSearchParams(searchParams?: Promise<SearchParams>) {
  return (await searchParams) ?? {};
}

export default async function DashboardMessagesPage({ searchParams }: Props) {
  const params = await resolveSearchParams(searchParams);
  const selectedConversationId = typeof params.conversation === 'string' ? params.conversation : undefined;

  return (
    <ConversationInboxPreview
      selectedId={selectedConversationId}
      routeBase="/dashboard/messages"
      title="Messages"
      description="Preview message thread handling and AI response suggestions before channel connections."
    />
  );
}
