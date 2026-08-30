'use client';

import React, { useEffect, useState } from 'react';
import { getShopifySessionToken } from '@/lib/shopify/app-bridge-client';
import { useStoreChatActions } from './store-chat-actions';
import { MessengerTabs, type MessengerTabId } from '@/components/dashboard/messenger/messenger-tabs';
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
  const actions = useStoreChatActions();
  const t = COPY[locale === 'ar' ? 'ar' : 'en'];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getShopifySessionToken();
        const res = await fetch('/api/shopify/store-chat/state', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = (await res.json()) as StoreChatState & { ok?: boolean };
        if (cancelled) return;
        if (!res.ok || body.ok === false) {
          setFailed(true);
          return;
        }
        setState(body);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
      config={state.config}
      payload={state.payload}
      stats={state.stats as React.ComponentProps<typeof MessengerTabs>['stats']}
      conversations={state.conversations}
      knowledge={state.knowledge}
      actions={actions}
      showConversationsTab={false}
    />
  );
}
