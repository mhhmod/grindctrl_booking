import { NextRequest, NextResponse } from 'next/server';
import { authenticateShopifyRequest } from '@/lib/shopify/session-token';
import { ensureShopOwnedSite } from '@/lib/messenger/shop-provisioning';
import { mergeDraftOverPublished } from '@/lib/messenger/config';
import {
  getOverviewStats,
  getWidgetLastSeenAt,
  listConversationsForSite,
} from '@/lib/messenger/conversations';
import { listKnowledge } from '@/lib/messenger/knowledge';
import { toPublicPayload } from '@/lib/messenger/public-api';
import { hasShopOrderAccess } from '@/lib/shopify/tokens';

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

  const [statsRes, conversationsRes, knowledgeRes, detectedRes, ordersRes] = await Promise.allSettled([
    getOverviewStats(site.id),
    listConversationsForSite(site.id),
    listKnowledge(site.id),
    getWidgetLastSeenAt(site.id),
    site.domain ? hasShopOrderAccess(site.domain) : Promise.resolve(false),
  ]);

  const stats = statsRes.status === 'fulfilled' ? statsRes.value : null;
  const conversations = conversationsRes.status === 'fulfilled' ? conversationsRes.value : [];
  const knowledge = knowledgeRes.status === 'fulfilled' ? knowledgeRes.value : [];
  /* Was listManagedTryOnShops(), which calls requireDashboardOwner(). There
     is no Clerk session inside the embedded Shopify iframe, so that lookup
     always threw here and detection was permanently null — the embedded app
     told every merchant "One step left" no matter what their store was
     doing. This asks the site's own loader events instead, which need no
     Clerk identity because the session token already proved the shop. */
  const detectedAt = detectedRes.status === 'fulfilled' ? detectedRes.value : null;
  for (const failed of [statsRes, conversationsRes, knowledgeRes, detectedRes, ordersRes]) {
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
      ordersAuthorized: ordersRes.status === 'fulfilled' ? ordersRes.value : false,
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
