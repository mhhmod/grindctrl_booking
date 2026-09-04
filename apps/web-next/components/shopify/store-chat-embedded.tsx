'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getShopifySessionToken } from '@/lib/shopify/app-bridge-client';
import { useStoreChatActions } from './store-chat-actions';
import { MessengerTabs, type MessengerTabId } from '@/components/dashboard/messenger/messenger-tabs';
import type { MessengerHostActions } from '@/lib/messenger/dashboard-actions-contract';
import type { PublicMessengerPayload } from '@/lib/messenger/public-api';
import type { MessengerConfig } from '@/lib/messenger/types';
import type { KnowledgeEntry } from '@/lib/messenger/knowledge';

interface StoreChatState {
  site: {
    id: string;
    name: string;
    domain: string | null;
    embedKey: string;
    active: boolean;
    version: number;
    hasDraft: boolean;
    detectedAt: string | null;
    ordersAuthorized: boolean;
  };
  config: MessengerConfig;
  payload: PublicMessengerPayload;
  stats: unknown;
  conversations: Array<{
    id: string;
    status: string;
    startedAt: string;
    lastMessageAt: string | null;
    visitorEmail: string | null;
    visitorName: string | null;
    handoffReason: string | null;
    unreadCount?: number;
    preview?: string | null;
  }>;
  knowledge: KnowledgeEntry[];
}

const COPY = {
  en: { loading: 'Loading Store Chat…', error: 'Could not load Store Chat. Reopen this app from your Shopify admin.' },
  ar: { loading: 'جارٍ تحميل دردشة المتجر…', error: 'تعذّر تحميل دردشة المتجر. أعد فتح التطبيق من لوحة تحكم شوبيفاي.' },
} as const;

export function StoreChatEmbedded({ locale }: { locale: 'en' | 'ar' }) {
  const [state, setState] = useState<StoreChatState | null>(null);
  const [failed, setFailed] = useState(false);
  const rawActions = useStoreChatActions();
  const t = COPY[locale === 'ar' ? 'ar' : 'en'];

  /** Returns whether the load succeeded, so the initial mount can flip
   *  `failed` on a bad first load without a mutation-triggered refresh
   *  ever clearing an already-loaded state on a transient failure. */
  const loadState = useCallback(async (): Promise<boolean> => {
    try {
      const token = await getShopifySessionToken();
      const res = await fetch('/api/shopify/store-chat/state', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await res.json()) as StoreChatState & { ok?: boolean };
      if (!res.ok || body.ok === false) return false;
      setState(body);
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await loadState();
      if (!cancelled && !ok) setFailed(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadState]);

  /* The dashboard gets a fresh read after every mutation for free, via
     revalidatePath re-rendering the server component tree — there is no
     embedded-client equivalent, so each action re-pulls /state itself once
     the server confirms success. Explicit per-method wrappers, not a
     generic HOF: the six methods don't share a single call signature. */
  const actions = useMemo<MessengerHostActions>(
    () => ({
      saveDraftSection: async (siteId, section, payload) => {
        const result = await rawActions.saveDraftSection(siteId, section, payload);
        if (result.ok) void loadState();
        return result;
      },
      /* The one action that does NOT re-pull /state. It fires on every
         conversation click, the panel clears the badge locally, and pulling
         the whole state payload back just to confirm it made opening a
         conversation feel like it had stalled. */
      markConversationRead: (siteId, conversationId) =>
        rawActions.markConversationRead(siteId, conversationId),
      saveDraftSections: async (siteId, sections) => {
        const result = await rawActions.saveDraftSections(siteId, sections);
        if (result.ok) void loadState();
        return result;
      },
      publishConfig: async (siteId) => {
        const result = await rawActions.publishConfig(siteId);
        if (result.ok) void loadState();
        return result;
      },
      setMessengerEnabled: async (siteId, enabled) => {
        const result = await rawActions.setMessengerEnabled(siteId, enabled);
        if (result.ok) void loadState();
        return result;
      },
      addKnowledge: async (formData) => {
        const result = await rawActions.addKnowledge(formData);
        if (result.ok) void loadState();
        return result;
      },
      updateKnowledgeStatus: async (siteId, entryId, status) => {
        const result = await rawActions.updateKnowledgeStatus(siteId, entryId, status);
        if (result.ok) void loadState();
        return result;
      },
      deleteKnowledge: async (siteId, entryId) => {
        const result = await rawActions.deleteKnowledge(siteId, entryId);
        if (result.ok) void loadState();
        return result;
      },
      syncKnowledge: async (siteId, entryId) => {
        const result = await rawActions.syncKnowledge(siteId, entryId);
        if (result.ok) void loadState();
        return result;
      },
      takeoverConversation: async (siteId, conversationId) => {
        const result = await rawActions.takeoverConversation(siteId, conversationId);
        if (result.ok) void loadState();
        return result;
      },
      releaseConversation: async (siteId, conversationId) => {
        const result = await rawActions.releaseConversation(siteId, conversationId);
        if (result.ok) void loadState();
        return result;
      },
      closeConversationAction: async (siteId, conversationId) => {
        const result = await rawActions.closeConversationAction(siteId, conversationId);
        if (result.ok) void loadState();
        return result;
      },
      staffReply: async (siteId, conversationId, text) => {
        const result = await rawActions.staffReply(siteId, conversationId, text);
        if (result.ok) void loadState();
        return result;
      },
      // Pure read — no state to refresh.
      fetchConversationMessages: rawActions.fetchConversationMessages,
    }),
    [rawActions, loadState],
  );

  if (failed) return <p className="p-6 text-sm text-destructive">{t.error}</p>;
  if (!state) return <p className="p-6 text-sm text-muted-foreground">{t.loading}</p>;

  const initialTab: MessengerTabId = 'overview';

  return (
    <MessengerTabs
      locale={locale}
      initialTab={initialTab}
      siteId={state.site.id}
      siteName={state.site.name}
      domain={state.site.domain}
      embedKey={state.site.embedKey}
      active={state.site.active}
      version={state.site.version}
      detectedAt={state.site.detectedAt}
      ordersAuthorized={state.site.ordersAuthorized}
      config={state.config}
      payload={state.payload}
      stats={state.stats as React.ComponentProps<typeof MessengerTabs>['stats']}
      conversations={state.conversations}
      knowledge={state.knowledge}
      actions={actions}
      hasDraft={state.site.hasDraft}
    />
  );
}
