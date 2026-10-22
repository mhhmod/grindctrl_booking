import 'server-only';

import { getMessengerServiceClient } from '@/lib/messenger/db';
import { getConversationForSite } from '@/lib/messenger/conversations';
import { requireSiteAccess } from '@/lib/messenger/provisioning';
import { parseCart } from '@/lib/messenger/cart';
import type { OrderCard } from '@/lib/messenger/order-card';
import type { InboxCustomerFacts } from './inbox-customer-model';

const PAST_LIMIT = 5;
const SHOP_DOMAIN_RE = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;

/* What Store Chat already knows about the shopper in one conversation, for
   the Inbox's customer column: read after checking the person may answer
   the site's chats (every role may, item 12), and only for a conversation
   of that site. The order is the newest one the shopper looked up in this
   conversation; earlier conversations are the same visitor's on the same
   site, newest first, each with its first shopper message. A failure
   throws, and the column says so. */
export async function getInboxCustomerFacts({
  userId,
  siteId,
  conversationId,
}: {
  userId: string;
  siteId: string;
  conversationId: string;
}): Promise<InboxCustomerFacts> {
  const site = await requireSiteAccess(userId, siteId, 'chats');
  const conversation = await getConversationForSite(conversationId, siteId);
  if (!conversation) throw new Error('conversation not found');
  const db = getMessengerServiceClient();

  const [orderRows, visitorRow, pastRows] = await Promise.all([
    db
      .from('widget_messages')
      .select('metadata, created_at')
      .eq('conversation_id', conversationId)
      .not('metadata->order_card', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1),
    db.from('widget_visitors').select('user_email, user_name').eq('id', conversation.visitor_id).maybeSingle(),
    db
      .from('widget_conversations')
      .select('id, started_at, status')
      .eq('widget_site_id', siteId)
      .eq('visitor_id', conversation.visitor_id)
      .neq('id', conversationId)
      .order('started_at', { ascending: false })
      .limit(PAST_LIMIT),
  ]);
  for (const result of [orderRows, visitorRow, pastRows]) if (result.error) throw new Error(result.error.message);

  const past = (pastRows.data ?? []) as Array<{ id: string; started_at: string; status: string }>;
  const firstLines = new Map<string, string>();
  if (past.length > 0) {
    const firsts = await db
      .from('widget_messages')
      .select('conversation_id, content, created_at')
      .in('conversation_id', past.map((row) => row.id))
      .eq('role', 'user')
      .order('created_at', { ascending: true })
      .limit(PAST_LIMIT * 20);
    if (firsts.error) throw new Error(firsts.error.message);
    for (const row of (firsts.data ?? []) as Array<{ conversation_id: string; content: string }>) {
      if (!firstLines.has(row.conversation_id) && row.content?.trim()) firstLines.set(row.conversation_id, row.content.trim().split('\n')[0].slice(0, 140));
    }
  }

  const metadata = conversation.metadata ?? {};
  const identity = metadata.identity ?? null;
  const visitor = visitorRow.data as { user_email: string | null; user_name: string | null } | null;
  const domain = site.domain?.trim().toLowerCase() ?? '';
  const order = ((orderRows.data ?? [])[0] as { metadata?: { order_card?: OrderCard } } | undefined)?.metadata?.order_card ?? null;

  return {
    name: visitor?.user_name ?? null,
    email: visitor?.user_email ?? null,
    identity: identity
      ? { name: identity.name ?? null, email: identity.email ?? null, customerId: identity.customer_id ?? null, verified: Boolean(identity.verified) }
      : null,
    contactEmail: metadata.contact_email ?? null,
    lastPageUrl: metadata.last_page_url ?? null,
    order,
    cart: parseCart(metadata.cart),
    past: past.map((row) => ({ id: row.id, startedAt: row.started_at, status: row.status, preview: firstLines.get(row.id) ?? null })),
    shopDomain: SHOP_DOMAIN_RE.test(domain) ? domain : null,
  };
}
