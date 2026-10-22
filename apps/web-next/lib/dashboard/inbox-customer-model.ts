/* What the v16 Inbox's customer column shows for one conversation
   (04-dashboard.md, the Inbox board's "About Salma"), from what Store Chat
   already keeps: the identity the store's sign-in gave, an email the shopper
   typed, the page they were last on, the order they looked up in the chat
   (N47's order card), their cart (phase zero item 10) and their earlier
   conversations. Left out until their back ends exist, rather than guessed:
   the city, order count and total spent, Change address (N16, N17) and the
   look they sent (N18). */

import type { OrderCard } from '@/lib/messenger/order-card';
import type { ShopperCart } from '@/lib/messenger/cart';
import { formatStorePrice } from '@/lib/try-on/store-product';
import type { SiteLocale } from '@/lib/landing/landing-i18n';
import type { InboxCustomerCopy } from './inbox-customer-copy';
import { dayMonth } from './today-model';

export type InboxCustomerFacts = {
  /** The shopper's name and email as the list shows them. */
  name: string | null;
  email: string | null;
  identity: { name: string | null; email: string | null; customerId: string | null; verified: boolean } | null;
  contactEmail: string | null;
  lastPageUrl: string | null;
  order: OrderCard | null;
  cart: ShopperCart | null;
  past: Array<{ id: string; startedAt: string; status: string; preview: string | null }>;
  /** The Shopify shop, for links into its admin; null on other websites. */
  shopDomain: string | null;
};

export type InboxCustomerView = {
  title: string;
  name: string | null;
  email: string | null;
  lines: string[];
  customerUrl: string | null;
  order: {
    title: string;
    stage: string;
    tone: 'ok' | 'attention' | 'danger' | 'muted';
    total: string | null;
    items: string[];
    trackingUrl: string | null;
    shopifyUrl: string | null;
  } | null;
  cart: { items: Array<{ title: string; price: string }>; total: string } | null;
  past: Array<{ id: string; date: string; status: string; preview: string | null }>;
  empty: boolean;
};

const STAGE_TONE: Record<OrderCard['stage'], 'ok' | 'attention' | 'danger' | 'muted'> = {
  preparing: 'muted',
  on_its_way: 'attention',
  out_for_delivery: 'attention',
  delivered: 'ok',
  cancelled: 'danger',
};

function adminBase(shopDomain: string | null): string | null {
  const match = shopDomain?.match(/^([a-z0-9][a-z0-9-]*)\.myshopify\.com$/);
  return match ? `https://admin.shopify.com/store/${match[1]}` : null;
}

/** "Layla Embroidered Abaya" from a product address, "home" for the store's
 *  front page, or the path itself for anything else. */
export function pageFrom(url: string | null): { kind: 'product'; name: string } | { kind: 'home' } | { kind: 'path'; path: string } | null {
  if (!url) return null;
  let path: string;
  try {
    path = new URL(url, 'https://store.invalid').pathname;
  } catch {
    return null;
  }
  const product = path.match(/\/products\/([^/?#]+)/);
  if (product) {
    let handle = product[1];
    try {
      handle = decodeURIComponent(handle);
    } catch {
      // Keep the raw handle.
    }
    const name = handle
      .split('-')
      .filter(Boolean)
      .map((word) => word[0].toUpperCase() + word.slice(1))
      .join(' ');
    return name ? { kind: 'product', name } : null;
  }
  if (path === '/' || /^\/(ar|en)\/?$/.test(path)) return { kind: 'home' };
  return { kind: 'path', path: path.length > 60 ? `${path.slice(0, 57)}...` : path };
}

function money(minor: number, currency: string, locale: SiteLocale): string {
  return formatStorePrice(minor, currency, locale);
}

export function buildInboxCustomerView(facts: InboxCustomerFacts, copy: InboxCustomerCopy, locale: SiteLocale, timeZone: string): InboxCustomerView {
  const name = facts.identity?.name?.trim() || facts.name?.trim() || null;
  const email = facts.identity?.email?.trim() || facts.email?.trim() || facts.contactEmail?.trim() || null;
  const base = adminBase(facts.shopDomain);

  const lines: string[] = [];
  if (facts.identity?.verified) lines.push(copy.signedIn);
  else if (facts.contactEmail && email === facts.contactEmail.trim()) lines.push(copy.gaveEmail);
  const page = pageFrom(facts.lastPageUrl);
  if (page) lines.push(page.kind === 'product' ? copy.fromPage(page.name) : page.kind === 'home' ? copy.fromHome : copy.lastOn(page.path));

  const card = facts.order;
  const stage = card ? copy.stage[card.stage] : '';
  const order = card
    ? {
        title: copy.order(card.name),
        stage: card.carrier && (card.stage === 'on_its_way' || card.stage === 'out_for_delivery') ? copy.stageWith(stage, card.carrier) : stage,
        tone: STAGE_TONE[card.stage],
        total:
          card.totalMinor !== undefined && card.currency
            ? (card.cashDue ? copy.cashOnDelivery : copy.paid)(money(card.cashDue && card.amountDueMinor !== undefined ? card.amountDueMinor : card.totalMinor, card.currency, locale))
            : null,
        items: card.items.map((item) => (item.quantity > 1 ? `${item.title} × ${item.quantity}` : item.title)),
        trackingUrl: card.trackingUrl,
        shopifyUrl: base ? `${base}/orders?query=${encodeURIComponent(card.name)}` : null,
      }
    : null;

  const cart =
    facts.cart && facts.cart.items.length > 0
      ? {
          items: facts.cart.items.map((line) => ({
            title: line.quantity > 1 ? `${line.title} × ${line.quantity}` : line.title,
            price: money(line.priceMinor * line.quantity, facts.cart!.currency, locale),
          })),
          total: copy.cartTotal(money(facts.cart.totalMinor, facts.cart.currency, locale)),
        }
      : null;

  const past = facts.past.map((conversation) => ({
    id: conversation.id,
    date: dayMonth(conversation.startedAt, locale, timeZone),
    status: copy.pastStatus[conversation.status as keyof InboxCustomerCopy['pastStatus']] ?? '',
    preview: conversation.preview?.trim() || null,
  }));

  const customerId = facts.identity?.verified ? facts.identity.customerId : null;
  return {
    title: name ? copy.about(name) : copy.aboutShopper,
    name,
    email,
    lines,
    customerUrl: base && customerId && /^\d+$/.test(customerId) ? `${base}/customers/${customerId}` : null,
    order,
    cart,
    past,
    empty: !order && !cart && past.length === 0 && lines.length === 0,
  };
}
