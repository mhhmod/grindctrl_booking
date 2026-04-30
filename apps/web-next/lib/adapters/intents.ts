import 'server-only';

import { callRpc } from '@/lib/adapters/rpc';
import type { WidgetIntent } from '@/lib/types';

export async function listIntents(clerkUserId: string, siteId: string) {
  return callRpc<WidgetIntent[]>('dashboard_list_intents', {
    p_clerk_user_id: clerkUserId,
    p_site_id: siteId,
  });
}

export async function createIntent(
  clerkUserId: string,
  siteId: string,
  intent: {
    label: string;
    icon?: string | null;
    actionType?: string | null;
    messageText?: string | null;
    externalUrl?: string | null;
    sortOrder?: number | null;
  },
) {
  return callRpc<WidgetIntent>('dashboard_create_intent', {
    p_clerk_user_id: clerkUserId,
    p_site_id: siteId,
    p_label: intent.label,
    p_icon: intent.icon ?? null,
    p_action_type: intent.actionType ?? null,
    p_message_text: intent.messageText ?? null,
    p_external_url: intent.externalUrl ?? null,
    p_sort_order: intent.sortOrder ?? null,
  });
}

export async function updateIntent(
  clerkUserId: string,
  intentId: string,
  intent: {
    label?: string | null;
    icon?: string | null;
    actionType?: string | null;
    messageText?: string | null;
    externalUrl?: string | null;
    sortOrder?: number | null;
  },
) {
  return callRpc<WidgetIntent>('dashboard_update_intent', {
    p_clerk_user_id: clerkUserId,
    p_intent_id: intentId,
    p_label: intent.label ?? null,
    p_icon: intent.icon ?? null,
    p_action_type: intent.actionType ?? null,
    p_message_text: intent.messageText ?? null,
    p_external_url: intent.externalUrl ?? null,
    p_sort_order: intent.sortOrder ?? null,
  });
}

export async function deleteIntent(clerkUserId: string, intentId: string) {
  return callRpc<boolean>('dashboard_delete_intent', {
    p_clerk_user_id: clerkUserId,
    p_intent_id: intentId,
  });
}
