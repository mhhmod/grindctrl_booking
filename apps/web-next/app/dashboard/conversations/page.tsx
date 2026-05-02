import React from 'react';
import { ConversationInboxPreview } from '@/components/dashboard/conversation-inbox-preview';
import type { SearchParams } from '@/lib/types';

type Props = {
  searchParams?: Promise<SearchParams>;
};

async function resolveSearchParams(searchParams?: Promise<SearchParams>) {
  return (await searchParams) ?? {};
}

export default async function DashboardConversationsPage({ searchParams }: Props) {
  const params = await resolveSearchParams(searchParams);
  const selectedConversationId = typeof params.conversation === 'string' ? params.conversation : undefined;

  return (
    <ConversationInboxPreview
      selectedId={selectedConversationId}
      routeBase="/dashboard/conversations"
      title="Conversations"
      description="Unified queue for website chat and social agent conversations."
    />
  );
}
