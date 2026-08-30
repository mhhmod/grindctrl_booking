import { NextRequest, NextResponse } from 'next/server';
import { authenticateShopifyRequest } from '@/lib/shopify/session-token';
import { ensureShopOwnedSite } from '@/lib/messenger/shop-provisioning';
import { mergeDraftOverPublished } from '@/lib/messenger/config';
import { getOverviewStats, listConversationsForSite } from '@/lib/messenger/conversations';
import { listKnowledge } from '@/lib/messenger/knowledge';
import { listManagedTryOnShops } from '@/lib/shopify/shops';
import { toPublicPayload } from '@/lib/messenger/public-api';

/* Embedded equivalent of app/dashboard/messenger/page.tsx's data assembly —
   same shape, resolved by verified shop domain instead of Clerk session +
   ?site=. Every panel is independently optional so one slow or broken read
   never takes the whole embedded tab down, matching the dashboard page's
   Promise.allSettled behavior. */

export async function GET(request: NextRequest) {
  const session = authenticateShopifyRequest(request);
  if (!session) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  let site;
  try {
    site = await ensureShopOwnedSite(session.shop);
  } catch (error) {
    console.error('[store-chat state] failed to resolve shop-owned site', error);
    return NextResponse.json({ ok: false, error: 'unavailable' }, { status: 503 });
  }

  const { config, hasDraft } = mergeDraftOverPublished(site.settings_json, site.settings_draft);
  const payload = toPublicPayload(
    { name: site.name, embed_key: site.embed_key, status: site.status, settings_version: site.settings_version, config },
    new Date(),
  );

  const [statsRes, conversationsRes, knowledgeRes, shopsRes] = await Promise.allSettled([
    getOverviewStats(site.id),
    listConversationsForSite(site.id),
    listKnowledge(site.id),
    listManagedTryOnShops(),
  ]);

  const stats = statsRes.status === 'fulfilled' ? statsRes.value : null;
  const conversations = conversationsRes.status === 'fulfilled' ? conversationsRes.value : [];
  const knowledge = knowledgeRes.status === 'fulfilled' ? knowledgeRes.value : [];
  let detectedAt: string | null = null;
  if (shopsRes.status === 'fulfilled' && site.domain) {
    const match = shopsRes.value.find((shop) => shop.domain === site.domain);
    detectedAt = match && match.status === 'installed' && match.lastSeenAt ? match.lastSeenAt : null;
  }
  for (const failed of [statsRes, conversationsRes, knowledgeRes, shopsRes]) {
    if (failed.status === 'rejected') {
      console.error('[store-chat state] a panel failed:', failed.reason);
    }
  }

  return NextResponse.json({
    site: {
      id: site.id,
      name: site.name,
      domain: site.domain,
      embedKey: site.embed_key,
      active: site.status === 'active',
      version: site.settings_version,
      hasDraft,
      detectedAt,
    },
    config,
    payload,
    stats,
    conversations: conversations.map((c) => ({
      id: c.id,
      status: c.status,
      startedAt: c.started_at,
      lastMessageAt: c.last_message_at,
      visitorEmail: c.visitor_email,
      visitorName: c.visitor_name,
      handoffReason: c.handoff_reason,
    })),
    knowledge,
  });
}
