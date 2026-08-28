import React from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { requireDashboardUser } from '@/lib/auth/dashboard';
import { ensureMessengerSite, listMessengerSites } from '@/lib/messenger/provisioning';
import { mergeDraftOverPublished } from '@/lib/messenger/config';
import { getOverviewStats, listConversationsForSite } from '@/lib/messenger/conversations';
import { listKnowledge } from '@/lib/messenger/knowledge';
import { listManagedTryOnShops } from '@/lib/shopify/shops';
import { getRequestLocale } from '@/lib/auth/locale';
import { toPublicPayload } from '@/lib/messenger/public-api';
import type { PublicMessengerPayload } from '@/lib/messenger/public-api';
import { MessengerOverview } from '@/components/dashboard/messenger/overview';
import { AppearanceEditor } from '@/components/dashboard/messenger/appearance-editor';
import { BehaviourEditor } from '@/components/dashboard/messenger/behaviour-editor';
import { AiKnowledgeEditor } from '@/components/dashboard/messenger/ai-knowledge-editor';
import { ConversationsPanel } from '@/components/dashboard/messenger/conversations-panel';
import { InstallCard } from '@/components/dashboard/messenger/install-card';

export const dynamic = 'force-dynamic';

const TABS = [
  { id: 'overview', labelKey: 'overview' },
  { id: 'appearance', labelKey: 'appearance' },
  { id: 'ai', labelKey: 'aiKnowledge' },
  { id: 'behaviour', labelKey: 'behaviour' },
  { id: 'conversations', labelKey: 'conversations' },
  { id: 'installation', labelKey: 'installation' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const TAB_COPY = {
  en: {
    overview: 'Overview',
    appearance: 'Appearance',
    aiKnowledge: 'AI & Knowledge',
    behaviour: 'Behaviour',
    conversations: 'Conversations',
    installation: 'Installation',
    live: 'Live',
    off: 'Off',
    hasDraft: 'Unpublished changes',
  },
  ar: {
    overview: 'نظرة عامة',
    appearance: 'المظهر',
    aiKnowledge: 'الذكاء والمعرفة',
    behaviour: 'السلوك',
    conversations: 'المحادثات',
    installation: 'التثبيت',
    live: 'يعمل',
    off: 'متوقف',
    hasDraft: 'تغييرات غير منشورة',
  },
} as const;

export default async function MessengerPage({
  searchParams,
}: {
  searchParams?: Promise<{ site?: string; tab?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const userId = await requireDashboardUser('/dashboard/messenger');
  const locale = await getRequestLocale();
  const copy = TAB_COPY[locale === 'ar' ? 'ar' : 'en'];

  let sites = await listMessengerSites(userId);
  if (sites.length === 0) {
    // First visit: give the merchant a site to configure immediately. If a
    // Shopify store is already connected via Try-On, mirror its domain so
    // installation detection works out of the box.
    let domain: string | null = null;
    try {
      const shops = await listManagedTryOnShops();
      const installed = shops.find((shop) => shop.status === 'installed');
      domain = installed?.domain ?? null;
    } catch {
      // Try-On lookup is optional here.
    }
    sites = [await ensureMessengerSite(userId, domain, domain ?? undefined)];
  }

  const selected = sites.find((site) => site.id === params.site) ?? sites[0];
  const { config, hasDraft } = mergeDraftOverPublished(selected.settings_json, selected.settings_draft);

  const payload: PublicMessengerPayload = toPublicPayload(
    {
      name: selected.name,
      embed_key: selected.embed_key,
      status: selected.status,
      settings_version: selected.settings_version,
      config,
    },
    new Date(),
  );

  const tab: TabId = TABS.some((candidate) => candidate.id === params.tab)
    ? (params.tab as TabId)
    : 'overview';

  let stats: Awaited<ReturnType<typeof getOverviewStats>> | null = null;
  let conversations: Awaited<ReturnType<typeof listConversationsForSite>> = [];
  let knowledge: Awaited<ReturnType<typeof listKnowledge>> = [];
  let storeDetectedAt: string | null = null;

  try {
    if (tab === 'overview') stats = await getOverviewStats(selected.id);
    if (tab === 'conversations') conversations = await listConversationsForSite(selected.id);
    if (tab === 'ai') knowledge = await listKnowledge(selected.id);
    if (selected.domain) {
      const shops = await listManagedTryOnShops();
      const match = shops.find((shop) => shop.domain === selected.domain);
      storeDetectedAt =
        match && match.status === 'installed' && match.lastSeenAt ? match.lastSeenAt : null;
    }
  } catch (error) {
    console.error('[messenger] dashboard data failed:', error instanceof Error ? error.message : error);
  }

  function tabHref(id: TabId): string {
    return `/dashboard/messenger?${new URLSearchParams({ site: selected.id, tab: id }).toString()}`;
  }

  return (
    <section className="grid min-w-0 gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={selected.status === 'active' ? 'default' : 'secondary'}>
            {selected.status === 'active' ? copy.live : copy.off}
          </Badge>
          {hasDraft && <Badge variant="outline">{copy.hasDraft}</Badge>}
        </div>
        {sites.length > 1 && (
          <nav aria-label={locale === 'ar' ? 'اختر المتجر' : 'Choose store'} className="flex flex-wrap gap-1">
            {sites.map((site) => (
              <Link
                key={site.id}
                href={`/dashboard/messenger?site=${site.id}&tab=${tab}`}
                className={`rounded-full border px-3 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 ${
                  site.id === selected.id
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border hover:bg-accent'
                }`}
              >
                {site.name}
              </Link>
            ))}
          </nav>
        )}
      </div>

      <nav aria-label={locale === 'ar' ? 'أقسام الماسنجر' : 'Messenger sections'} className="min-w-0">
        <ul className="flex flex-wrap gap-1 border-b border-border pb-px">
          {TABS.map((entry) => (
            <li key={entry.id}>
              <Link
                href={tabHref(entry.id)}
                aria-current={tab === entry.id ? 'page' : undefined}
                className={`inline-flex rounded-t-lg px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 ${
                  tab === entry.id
                    ? 'border-b-2 border-primary font-semibold text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {copy[entry.labelKey]}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {tab === 'overview' && (
        <MessengerOverview
          locale={locale}
          siteName={selected.name}
          active={selected.status === 'active'}
          aiEnabled={config.ai.enabled}
          detectedAt={storeDetectedAt}
          version={selected.settings_version}
          stats={stats}
        />
      )}

      {tab === 'appearance' && (
        <AppearanceEditor
          locale={locale}
          siteId={selected.id}
          initial={config.appearance}
          publishedPayload={payload}
        />
      )}
      {tab === 'behaviour' && (
        <BehaviourEditor
          locale={locale}
          siteId={selected.id}
          initial={config.behaviour}
          publishedPayload={payload}
        />
      )}
      {tab === 'ai' && (
        <AiKnowledgeEditor
          locale={locale}
          siteId={selected.id}
          ai={config.ai}
          knowledge={knowledge}
          publishedPayload={payload}
        />
      )}

      {tab === 'conversations' && (
        <ConversationsPanel
          locale={locale}
          siteId={selected.id}
          conversations={conversations.map((c) => ({
            id: c.id,
            status: c.status,
            startedAt: c.started_at,
            lastMessageAt: c.last_message_at,
            visitorEmail: c.visitor_email,
            visitorName: c.visitor_name,
            handoffReason: c.handoff_reason,
          }))}
        />
      )}

      {tab === 'installation' && (
        <InstallCard
          locale={locale}
          siteId={selected.id}
          embedKey={selected.embed_key}
          domain={selected.domain}
          active={selected.status === 'active'}
          detectedAt={storeDetectedAt}
          version={selected.settings_version}
        />
      )}
    </section>
  );
}

