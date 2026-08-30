'use client';

import React, { useState } from 'react';
import { MessengerOverview } from './overview';
import { AppearanceEditor } from './appearance-editor';
import { BehaviourEditor } from './behaviour-editor';
import { SupportDeskSettings } from './support-desk-settings';
import { AiKnowledgeEditor } from './ai-knowledge-editor';
import { ConversationsPanel, type ConversationListItem } from './conversations-panel';
import { InstallCard } from './install-card';
import type { PublicMessengerPayload } from '@/lib/messenger/public-api';
import type { MessengerConfig, MessengerLocale } from '@/lib/messenger/types';
import type { KnowledgeEntry } from '@/lib/messenger/knowledge';
import type { MessengerHostActions } from '@/lib/messenger/dashboard-actions-contract';

/* Tabs switch in the client. They used to be links to ?tab=…, so every
   click paid a full server render of a force-dynamic page — several
   database round trips before anything moved on screen, which read as the
   UI being stuck. The page now loads all six panels' data in one parallel
   pass and switching is instant. The URL still seeds the initial tab, so
   deep links and the Overview shortcuts keep working. */

const TABS = ['overview', 'appearance', 'ai', 'behaviour', 'conversations', 'installation'] as const;
export type MessengerTabId = (typeof TABS)[number];

const COPY = {
  en: {
    overview: 'Overview',
    appearance: 'Appearance',
    ai: 'AI & Knowledge',
    behaviour: 'Behaviour',
    conversations: 'Conversations',
    installation: 'Installation',
    sections: 'Store Chat sections',
  },
  ar: {
    overview: 'نظرة عامة',
    appearance: 'المظهر',
    ai: 'الذكاء والمعرفة',
    behaviour: 'السلوك',
    conversations: 'المحادثات',
    installation: 'التثبيت',
    sections: 'أقسام دردشة المتجر',
  },
} as const;

export function MessengerTabs({
  locale,
  initialTab,
  siteId,
  siteName,
  domain,
  embedKey,
  active,
  version,
  detectedAt,
  config,
  payload,
  stats,
  conversations,
  knowledge,
  actions,
  showConversationsTab = true,
}: {
  locale: MessengerLocale;
  initialTab: MessengerTabId;
  siteId: string;
  siteName: string;
  domain: string | null;
  embedKey: string;
  active: boolean;
  version: number;
  detectedAt: string | null;
  config: MessengerConfig;
  payload: PublicMessengerPayload;
  stats: React.ComponentProps<typeof MessengerOverview>['stats'];
  conversations: ConversationListItem[];
  knowledge: KnowledgeEntry[];
  actions: MessengerHostActions;
  /** The embedded Shopify shell doesn't render Conversations yet — see
   *  Phase 2's scope note. Defaults to true so the dashboard is unaffected. */
  showConversationsTab?: boolean;
}) {
  const visibleTabs = showConversationsTab ? TABS : TABS.filter((id) => id !== 'conversations');
  const [tab, setTab] = useState<MessengerTabId>(
    initialTab === 'conversations' && !showConversationsTab ? 'overview' : initialTab,
  );
  const t = COPY[locale === 'ar' ? 'ar' : 'en'];

  return (
    <>
      <nav aria-label={t.sections} className="min-w-0">
        <ul className="flex flex-wrap gap-1 border-b border-border pb-px">
          {visibleTabs.map((id) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => setTab(id)}
                aria-current={tab === id ? 'page' : undefined}
                className={`inline-flex rounded-t-lg px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 ${
                  tab === id
                    ? 'border-b-2 border-primary font-semibold text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t[id]}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {tab === 'overview' && (
        <MessengerOverview
          locale={locale}
          siteName={siteName}
          active={active}
          aiEnabled={config.ai.enabled}
          detectedAt={detectedAt}
          version={version}
          stats={stats}
        />
      )}
      {tab === 'appearance' && (
        <AppearanceEditor locale={locale} siteId={siteId} initial={config.appearance} publishedPayload={payload} actions={actions} />
      )}
      {tab === 'behaviour' && (
        <div className="grid min-w-0 gap-6">
          <BehaviourEditor locale={locale} siteId={siteId} initial={config.behaviour} publishedPayload={payload} actions={actions} />
          <SupportDeskSettings
            locale={locale}
            siteId={siteId}
            shopDomain={domain && domain.endsWith('.myshopify.com') ? domain : null}
            notifications={config.notifications}
            contactCapture={config.contactCapture}
            attachments={config.attachments}
            orderLookup={config.orderLookup}
            actions={actions}
          />
        </div>
      )}
      {tab === 'ai' && (
        <AiKnowledgeEditor
          locale={locale}
          siteId={siteId}
          ai={config.ai}
          knowledge={knowledge}
          publishedPayload={payload}
          actions={actions}
        />
      )}
      {showConversationsTab && tab === 'conversations' && (
        <ConversationsPanel locale={locale} siteId={siteId} conversations={conversations} />
      )}
      {tab === 'installation' && (
        <InstallCard
          locale={locale}
          siteId={siteId}
          embedKey={embedKey}
          domain={domain}
          active={active}
          detectedAt={detectedAt}
          version={version}
          actions={actions}
        />
      )}
    </>
  );
}
