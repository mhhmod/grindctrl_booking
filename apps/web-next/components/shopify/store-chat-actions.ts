'use client';

import { useMemo } from 'react';
import { getShopifySessionToken } from '@/lib/shopify/app-bridge-client';
import type { ActionResult } from '@/lib/messenger/actions-core';
import type { FetchMessagesResult, MessengerHostActions } from '@/lib/messenger/dashboard-actions-contract';
import type { MessengerSection } from '@/lib/messenger/config';

async function postJson(path: string, body: unknown): Promise<ActionResult> {
  try {
    const token = await getShopifySessionToken();
    const res = await fetch(path, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return (await res.json()) as ActionResult;
  } catch {
    return { ok: false, error: 'Action failed. Please try again.' };
  }
}

async function postThreadRead(conversationId: string): Promise<FetchMessagesResult | { ok: false }> {
  try {
    const token = await getShopifySessionToken();
    const res = await fetch('/api/shopify/store-chat/thread', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'messages', conversationId }),
    });
    return (await res.json()) as FetchMessagesResult | { ok: false };
  } catch {
    return { ok: false };
  }
}

/** Fetch-backed twin of app/dashboard/messenger/actions.ts, scoped by the
 *  embedded app's verified shop session instead of a Clerk cookie. Every
 *  method's `siteId` argument is ignored on purpose: the routes behind
 *  these calls resolve the site from the session token, never from
 *  anything a client sends — see each route's own comment for why. */
export function useStoreChatActions(): MessengerHostActions {
  return useMemo<MessengerHostActions>(
    () => ({
      saveDraftSection: (_siteId, section: MessengerSection, payload: object) =>
        postJson('/api/shopify/store-chat/draft', { section, payload }),
      saveDraftSections: (_siteId, sections) =>
        postJson('/api/shopify/store-chat/draft', { sections }),
      publishConfig: (_siteId) => postJson('/api/shopify/store-chat/publish', {}),
      setMessengerEnabled: (_siteId, enabled: boolean) =>
        postJson('/api/shopify/store-chat/enable', { enabled }),
      fetchConversationMessages: (_siteId, conversationId: string) => postThreadRead(conversationId),
      staffReply: (_siteId, conversationId: string, text: string) =>
        postJson('/api/shopify/store-chat/thread', { op: 'reply', conversationId, text }),
      takeoverConversation: (_siteId, conversationId: string) =>
        postJson('/api/shopify/store-chat/thread', { op: 'takeover', conversationId }),
      markConversationRead: (_siteId, conversationId: string) =>
        postJson('/api/shopify/store-chat/thread', { op: 'markRead', conversationId }),
      releaseConversation: (_siteId, conversationId: string) =>
        postJson('/api/shopify/store-chat/thread', { op: 'release', conversationId }),
      closeConversationAction: (_siteId, conversationId: string) =>
        postJson('/api/shopify/store-chat/thread', { op: 'close', conversationId }),
      addKnowledge: (formData: FormData) => {
        const url = String(formData.get('url') ?? '').trim();
        const body = url
          ? { op: 'addUrl' as const, url }
          : {
              op: 'add' as const,
              title: String(formData.get('title') ?? ''),
              content: String(formData.get('content') ?? ''),
            };
        return postJson('/api/shopify/store-chat/knowledge', body);
      },
      updateKnowledgeStatus: (_siteId, entryId: string, status: 'active' | 'disabled') =>
        postJson('/api/shopify/store-chat/knowledge', { op: 'status', entryId, status }),
      deleteKnowledge: (_siteId, entryId: string) =>
        postJson('/api/shopify/store-chat/knowledge', { op: 'delete', entryId }),
      syncKnowledge: (_siteId, entryId: string) =>
        postJson('/api/shopify/store-chat/knowledge', { op: 'sync', entryId }),
    }),
    [],
  );
}
