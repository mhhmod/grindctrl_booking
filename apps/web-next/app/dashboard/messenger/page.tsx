import React from 'react';
import Link from 'next/link';
import { currentUser } from '@clerk/nextjs/server';
import { Badge } from '@/components/ui/badge';
import { requireDashboardUser } from '@/lib/auth/dashboard';
import { ensureMessengerSite, listMessengerSites } from '@/lib/messenger/provisioning';
import { StoreOwnedByAnotherAccountError } from '@/lib/messenger/shop-tenancy';
import { mergeDraftOverPublished } from '@/lib/messenger/config';
import { getOverviewStats, listConversationsForSite } from '@/lib/messenger/conversations';
import { listKnowledge } from '@/lib/messenger/knowledge';
import { listManagedTryOnShops } from '@/lib/shopify/shops';
import { getRequestLocale } from '@/lib/auth/locale';
import { toPublicPayload } from '@/lib/messenger/public-api';
import { MessengerTabs, type MessengerTabId } from '@/components/dashboard/messenger/messenger-tabs';
import type { PublicMessengerPayload } from '@/lib/messenger/public-api';
import * as messengerActions from './actions';

export const dynamic = 'force-dynamic';

const TAB_IDS = ['overview', 'appearance', 'ai', 'behaviour', 'conversations', 'installation'] as const;

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
    storeTakenTitle: 'This store is already connected',
    // See the matching comment in app/claim/page.tsx: there is no
    // disconnect/unclaim path in the app, so don't send a merchant looking
    // for one.
    storeTakenBody: "It's already connected to another GRINDCTRL account. Contact support if that doesn't sound right.",
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
    storeTakenTitle: 'هذا المتجر متصل بالفعل',
    storeTakenBody: 'هذا المتجر متصل بالفعل بحساب GRINDCTRL آخر. تواصل مع الدعم إذا لم يكن ذلك صحيحاً.',
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

  /* Clerk holds the address the merchant actually reads; the profiles row
     is only a mirror. Notifications are unsendable without this. */
  const clerkUser = await currentUser();
  const merchantEmail =
    clerkUser?.primaryEmailAddress?.emailAddress ?? clerkUser?.emailAddresses[0]?.emailAddress ?? null;

  let sites = await listMessengerSites(userId, merchantEmail);
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
    try {
      sites = [await ensureMessengerSite(userId, domain, domain ?? undefined)];
    } catch (error) {
      // A different real account already owns this store's config — not the
      // transient failure error.tsx's generic "trying again usually works"
      // copy implies, and not something a retry could ever fix. Say so here
      // instead of letting it escape to that boundary and 500 forever.
      if (error instanceof StoreOwnedByAnotherAccountError) {
        return (
          <section
            dir={locale === 'ar' ? 'rtl' : 'ltr'}
            className="grid min-w-0 place-items-center px-4 py-16"
          >
            <div className="grid max-w-md gap-2 text-center">
              <h1 className="text-lg font-semibold">{copy.storeTakenTitle}</h1>
              <p className="text-sm text-muted-foreground">{copy.storeTakenBody}</p>
            </div>
          </section>
        );
      }
      throw error;
    }
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

  const tab: MessengerTabId = (TAB_IDS as readonly string[]).includes(params.tab ?? '')
    ? (params.tab as MessengerTabId)
    : 'overview';

  /* One parallel pass for every panel. Tabs switch in the client now, so
     fetching per-tab would only move the wait to each click; these are small
     scoped reads and settle together in about the time the slowest takes. */
  let stats: Awaited<ReturnType<typeof getOverviewStats>> | null = null;
  let conversations: Awaited<ReturnType<typeof listConversationsForSite>> = [];
  let knowledge: Awaited<ReturnType<typeof listKnowledge>> = [];
  let storeDetectedAt: string | null = null;

  const [statsRes, conversationsRes, knowledgeRes, shopsRes] = await Promise.allSettled([
    getOverviewStats(selected.id),
    listConversationsForSite(selected.id),
    listKnowledge(selected.id),
    selected.domain ? listManagedTryOnShops() : Promise.resolve([]),
  ]);

  if (statsRes.status === 'fulfilled') stats = statsRes.value;
  if (conversationsRes.status === 'fulfilled') conversations = conversationsRes.value;
  if (knowledgeRes.status === 'fulfilled') knowledge = knowledgeRes.value;
  if (shopsRes.status === 'fulfilled' && selected.domain) {
    const match = shopsRes.value.find((shop) => shop.domain === selected.domain);
    storeDetectedAt = match && match.status === 'installed' && match.lastSeenAt ? match.lastSeenAt : null;
  }
  for (const failed of [statsRes, conversationsRes, knowledgeRes, shopsRes]) {
    if (failed.status === 'rejected') {
      // One slow or broken panel must not take the whole section down.
      console.error('[messenger] dashboard data failed:', failed.reason);
    }
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

      <MessengerTabs
        locale={locale}
        initialTab={tab}
        siteId={selected.id}
        siteName={selected.name}
        domain={selected.domain}
        embedKey={selected.embed_key}
        active={selected.status === 'active'}
        version={selected.settings_version}
        detectedAt={storeDetectedAt}
        config={config}
        payload={payload}
        stats={stats}
        conversations={conversations.map((c) => ({
          id: c.id,
          status: c.status,
          startedAt: c.started_at,
          lastMessageAt: c.last_message_at,
          visitorEmail: c.visitor_email,
          visitorName: c.visitor_name,
          handoffReason: c.handoff_reason,
        }))}
        knowledge={knowledge}
        actions={messengerActions}
        hasDraft={hasDraft}
      />
    </section>
  );
}

