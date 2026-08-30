'use client';

import { useMemo } from 'react';
import { getShopifySessionToken } from '@/lib/shopify/app-bridge-client';
import type { ActionResult } from '@/lib/messenger/actions-core';
import type { MessengerHostActions } from '@/lib/messenger/dashboard-actions-contract';
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
      setMessengerEnabled: (_siteId, enabled: boolean) =>
        postJson('/api/shopify/store-chat/enable', { enabled }),
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
