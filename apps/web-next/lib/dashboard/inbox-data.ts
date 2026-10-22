import 'server-only';

import {
  listConversationsForSite,
  listWorkspaceMembers,
  resolveAssigneeNames,
  summarizeConversations,
  type ConversationSummary,
} from '@/lib/messenger/conversations';
import { listCannedReplies, type CannedReply } from '@/lib/messenger/canned-replies';
import { getProfileId, requireSiteAccess } from '@/lib/messenger/provisioning';
import type { ConversationListItem } from '@/components/dashboard/messenger/conversations-panel';

/* What the Inbox and Store Chat's Conversations tab list: the site's newest
   conversations with their last line, unread count and who has each, and
   what the composer needs. Only the conversations are required; a name, a
   summary or the saved replies that cannot be read are left out, as the
   Store Chat page always did. */

type Conversation = Awaited<ReturnType<typeof listConversationsForSite>>[number];

export function toConversationListItems(
  conversations: Conversation[],
  { assigneeNames, summaries, withTags }: { assigneeNames: Record<string, string>; summaries: Record<string, ConversationSummary>; withTags: boolean },
): ConversationListItem[] {
  return conversations.map((c) => ({
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
    tags: withTags ? (c.metadata.tags ?? []) : undefined,
  }));
}

export type InboxData = {
  siteId: string;
  conversations: ConversationListItem[];
  cannedReplies: CannedReply[];
  currentProfileId: string | null;
  assignableMembers: Array<{ profileId: string; name: string }>;
};

/** The Inbox for one site, after checking the person may answer its chats
 *  (item 12: every role may). Throws when the conversations cannot be read. */
export async function getInboxData({
  userId,
  siteId,
  withTags,
}: {
  userId: string;
  siteId: string;
  withTags: boolean;
}): Promise<InboxData> {
  const site = await requireSiteAccess(userId, siteId, 'chats');
  const [conversations, cannedReplies, currentProfileId, assignableMembers] = await Promise.all([
    listConversationsForSite(site.id),
    listCannedReplies(site.id).catch((): CannedReply[] => []),
    getProfileId(userId).catch((): string | null => null),
    listWorkspaceMembers(site.workspace_id).catch((): Array<{ profileId: string; name: string }> => []),
  ]);
  const assigneeIds = [...new Set(conversations.map((c) => c.assigned_profile_id).filter((id): id is string => Boolean(id)))];
  const [summaries, assigneeNames] = await Promise.all([
    summarizeConversations(conversations).catch((): Record<string, ConversationSummary> => ({})),
    assigneeIds.length > 0
      ? resolveAssigneeNames(site.workspace_id, assigneeIds).catch((): Record<string, string> => ({}))
      : Promise.resolve<Record<string, string>>({}),
  ]);
  return {
    siteId: site.id,
    conversations: toConversationListItems(conversations, { assigneeNames, summaries, withTags }),
    cannedReplies,
    currentProfileId,
    assignableMembers,
  };
}
