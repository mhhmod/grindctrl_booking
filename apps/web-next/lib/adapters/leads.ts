import 'server-only';

import { callRpc } from '@/lib/adapters/rpc';
import type { WidgetLead } from '@/lib/types';

function toStringOrNull(value: unknown) {
  return typeof value === 'string' ? value : null;
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

export async function listLeads(clerkUserId: string, workspaceId: string, siteId?: string | null) {
  const rows = await callRpc<unknown[]>('dashboard_list_leads', {
    p_clerk_user_id: clerkUserId,
    p_workspace_id: workspaceId,
    p_site_id: siteId ?? null,
  });

  return Array.isArray(rows) ? rows.map(normalizeLead) : [];
}
