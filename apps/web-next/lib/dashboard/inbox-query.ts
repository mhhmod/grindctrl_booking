import 'server-only';
import { getMessengerServiceClient } from '@/lib/messenger/db';
import { getProfileId, requireSiteAccess } from '@/lib/messenger/provisioning';
import { resolveAssigneeNames } from '@/lib/messenger/conversations';
import { normalizeSearch } from '@/lib/messenger/product-context';
import type { ConversationListItem } from '@/components/dashboard/messenger/conversations-panel';

export const INBOX_FILTERS = ['all', 'needs_reply', 'in_progress', 'resolved', 'needs_you', 'assistant'] as const;
export type InboxFilter = typeof INBOX_FILTERS[number];
export type InboxCursor = { at: string | null; id: string };
export type InboxRequest = { siteId: string; cursor?: InboxCursor | null; query?: string; filter?: InboxFilter; mineOnly?: boolean };
export type InboxPage = { ok: true; conversations: ConversationListItem[]; cursor: InboxCursor | null; checkedAt: string } | { ok: false };
export type InboxChanges = { ok: true; conversations: ConversationListItem[]; cursor: InboxCursor | null; checkedAt: string } | { ok: false };
export function validInboxTimestamp(value: string): boolean {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
}

function validateCursor(cursor: InboxCursor | null | undefined) {
  if (cursor && (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cursor.id) || (cursor.at !== null && !validInboxTimestamp(cursor.at)))) throw new Error('Invalid cursor.');
}

export async function readInboxPage(userId: string, input: InboxRequest, changes?: { since: string; cursor?: InboxCursor | null; until?: string }): Promise<InboxPage> {
  const site = await requireSiteAccess(userId, input.siteId, 'chats');
  const cursor = changes?.cursor ?? input.cursor;
  validateCursor(cursor);
  if (input.filter && !INBOX_FILTERS.includes(input.filter)) throw new Error('Invalid filter.');
  const profile = input.mineOnly ? await getProfileId(userId) : null;
  const checkedAt = changes?.until ?? new Date().toISOString();
  if (!validInboxTimestamp(checkedAt) || (changes && !validInboxTimestamp(changes.since))) throw new Error('Invalid timestamp.');
  if (input.mineOnly && !profile) return { ok: true, conversations: [], cursor: null, checkedAt };
  const { data, error } = await getMessengerServiceClient().rpc('messenger_inbox_page', {
    p_site: site.id, p_query: normalizeSearch((input.query ?? '').slice(0, 200)), p_filter: input.filter ?? 'all', p_assignee: profile,
    p_cursor_at: cursor?.at ?? changes?.since ?? null, p_cursor_id: cursor?.id ?? null, p_changes: Boolean(changes), p_until: checkedAt,
  });
  if (error) throw new Error('Inbox query failed.');
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const page = changes ? rows.slice(0, 50) : rows.slice(0, 30);
  const assignees = [...new Set(page.map((r) => r.assigned_profile_id).filter((id): id is string => typeof id === 'string'))];
  const names = assignees.length ? await resolveAssigneeNames(site.workspace_id, assignees) : {};
  const last = page.at(-1);
  return { ok: true, checkedAt,
    cursor: last && (changes ? rows.length === 50 : rows.length > 30) ? { at: (changes ? last.inbox_updated_at : last.last_message_at) as string | null, id: String(last.id) } : null,
    conversations: page.map((r) => ({ id: String(r.id), status: String(r.status), startedAt: String(r.started_at), lastMessageAt: r.last_message_at as string | null,
      updatedAt: r.inbox_updated_at as string, visitorEmail: r.visitor_email as string | null, visitorName: r.visitor_name as string | null,
      assigneeId: r.assigned_profile_id as string | null, assigneeName: names[String(r.assigned_profile_id)] ?? null, handoffReason: r.handoff_reason as string | null,
      unreadCount: Number(r.unread), preview: r.preview as string | null, tags: (r.metadata as { tags?: string[] } | null)?.tags ?? [] })),
  };
}
