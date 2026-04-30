import 'server-only';

import { callRpc } from '@/lib/adapters/rpc';
import type { WidgetConversation, WidgetConversationDetail, WidgetLead, WidgetMessage } from '@/lib/types';

function toStringOrNull(value: unknown) {
  return typeof value === 'string' ? value : null;
}

function toNumberOrUndefined(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeConversation(value: unknown): WidgetConversation {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    id: toStringOrNull(source.id) ?? '',
    widget_site_id: toStringOrNull(source.widget_site_id) ?? '',
    visitor_id: toStringOrNull(source.visitor_id) ?? '',
    status: toStringOrNull(source.status) ?? 'open',
    started_at: toStringOrNull(source.started_at),
    closed_at: toStringOrNull(source.closed_at),
    last_message_at: toStringOrNull(source.last_message_at),
    last_page_url: toStringOrNull(source.last_page_url),
    last_referrer: toStringOrNull(source.last_referrer),
    assigned_profile_id: toStringOrNull(source.assigned_profile_id),
    latest_message_preview: toStringOrNull(source.latest_message_preview),
    visitor_name: toStringOrNull(source.visitor_name),
    visitor_email: toStringOrNull(source.visitor_email),
    message_count: toNumberOrUndefined(source.message_count),
    lead_count: toNumberOrUndefined(source.lead_count),
  };
}

function normalizeMessage(value: unknown): WidgetMessage {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    id: toStringOrNull(source.id) ?? '',
    conversation_id: toStringOrNull(source.conversation_id) ?? '',
    role: toStringOrNull(source.role) ?? 'user',
    content: toStringOrNull(source.content) ?? '',
    content_type: toStringOrNull(source.content_type),
    intent_id: toStringOrNull(source.intent_id),
    created_at: toStringOrNull(source.created_at),
  };
}

function normalizeLead(value: unknown): WidgetLead {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    id: toStringOrNull(source.id) ?? '',
    workspace_id: toStringOrNull(source.workspace_id) ?? '',
    widget_site_id: toStringOrNull(source.widget_site_id) ?? '',
    conversation_id: toStringOrNull(source.conversation_id),
    intent_id: toStringOrNull(source.intent_id),
    visitor_id: toStringOrNull(source.visitor_id),
    name: toStringOrNull(source.name),
    email: toStringOrNull(source.email),
    phone: toStringOrNull(source.phone),
    company: toStringOrNull(source.company),
    source_domain: toStringOrNull(source.source_domain),
    status: toStringOrNull(source.status),
    status_reason: toStringOrNull(source.status_reason),
    sync_status: toStringOrNull(source.sync_status),
    booking_status: toStringOrNull(source.booking_status),
    assigned_profile_id: toStringOrNull(source.assigned_profile_id),
    page_url: toStringOrNull(source.page_url),
    referrer: toStringOrNull(source.referrer),
    created_at: toStringOrNull(source.created_at) ?? undefined,
  };
}

export async function listConversations(input: {
  clerkUserId: string;
  workspaceId: string;
  siteId: string;
  query?: string;
  status?: string;
  owner?: string;
  page?: number;
  pageSize?: number;
}) {
  const data = await callRpc<unknown[]>('dashboard_list_conversations', {
    p_clerk_user_id: input.clerkUserId,
    p_workspace_id: input.workspaceId,
    p_site_id: input.siteId,
    p_query: input.query ?? null,
    p_status: input.status ?? null,
    p_owner: input.owner ?? null,
    p_page: input.page ?? 1,
    p_page_size: input.pageSize ?? 20,
  });

  return Array.isArray(data) ? data.map(normalizeConversation) : [];
}

export async function getConversationDetail(input: {
  clerkUserId: string;
  workspaceId: string;
  siteId: string;
  conversationId: string;
}) {
  const data = await callRpc<{
    conversation?: unknown;
    messages?: unknown[];
    leads?: unknown[];
  } | null>('dashboard_get_conversation_detail', {
    p_clerk_user_id: input.clerkUserId,
    p_workspace_id: input.workspaceId,
    p_site_id: input.siteId,
    p_conversation_id: input.conversationId,
  });

  if (!data) {
    return {
      conversation: null,
      messages: [],
      leads: [],
    } satisfies WidgetConversationDetail;
  }

  return {
    conversation: data.conversation ? normalizeConversation(data.conversation) : null,
    messages: Array.isArray(data.messages) ? data.messages.map(normalizeMessage) : [],
    leads: Array.isArray(data.leads) ? data.leads.map(normalizeLead) : [],
  } satisfies WidgetConversationDetail;
}
