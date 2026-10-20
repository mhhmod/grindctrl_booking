/* The order card a shopper sees in Store Chat (Chat-More, Chat-Order;
   contracts N47 and N48). Drawn from the store's own order data, never from
   the model, so what it shows is what Shopify holds: the status, the
   pieces, a timeline from the fulfilments, the carrier's link and whether
   cash is due on delivery. Amounts are included only when the caller says
   the shopper may see them (the owner's yes, N47). */

export type OrderStage = 'preparing' | 'on_its_way' | 'out_for_delivery' | 'delivered' | 'cancelled';

export type OrderTimelineStep = {
  kind: 'placed' | 'shipped' | 'out_for_delivery' | 'delivered';
  at: string;
  carrier?: string | null;
};

export type OrderCard = {
  /** "#1027" */
  name: string;
  placedAt: string;
  stage: OrderStage;
  items: Array<{ title: string; quantity: number }>;
  timeline: OrderTimelineStep[];
  /** Only when the carrier gave Shopify one. */
  estimatedDelivery: string | null;
  carrier: string | null;
  trackingUrl: string | null;
  /** A cash order with money still to pay at the door. */
  cashDue: boolean;
  /** Present only when amounts may be shown. Minor units. */
  totalMinor?: number;
  amountDueMinor?: number;
  currency?: string;
};

type Money = { amount?: string | null; currencyCode?: string | null } | null | undefined;

export interface RawCardOrder {
  name?: string | null;
  processedAt?: string | null;
  createdAt?: string | null;
  cancelledAt?: string | null;
  displayFulfillmentStatus?: string | null;
  paymentGatewayNames?: Array<string | null> | null;
  totalOutstandingSet?: { presentmentMoney?: Money } | null;
  currentTotalPriceSet?: { presentmentMoney?: Money } | null;
  lineItems?: { nodes?: Array<{ title?: string | null; quantity?: number | null }> } | null;
  fulfillments?: Array<{
    createdAt?: string | null;
    inTransitAt?: string | null;
    deliveredAt?: string | null;
    estimatedDeliveryAt?: string | null;
    displayStatus?: string | null;
    trackingInfo?: Array<{ company?: string | null; url?: string | null }> | null;
    events?: { nodes?: Array<{ status?: string | null; happenedAt?: string | null }> } | null;
  }> | null;
}

/* Gateways Shopify stores use for paying at the door, in English and in
   the Arabic some Egyptian and Gulf stores type into a manual method. */
const CASH_GATEWAY = /cash on delivery|\bcod\b|الدفع عند الاستلام|كاش/i;

function minor(money: Money): number | null {
  const value = Number(money?.amount);
  return Number.isFinite(value) ? Math.round(value * 100) : null;
}

function safeUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export function toOrderCard(order: RawCardOrder, options: { withAmounts: boolean }): OrderCard {
  const fulfillments = order.fulfillments ?? [];
  const latest = fulfillments[fulfillments.length - 1] ?? null;
  const tracking = fulfillments.flatMap((f) => f.trackingInfo ?? []).find((t) => t.company || t.url) ?? null;
  const carrier = tracking?.company?.trim() || null;

  const events = fulfillments.flatMap((f) => f.events?.nodes ?? []);
  const outForDeliveryAt =
    events.filter((e) => e.status === 'OUT_FOR_DELIVERY' && e.happenedAt).map((e) => e.happenedAt as string).sort()[0] ?? null;
  const shippedAt = fulfillments.map((f) => f.inTransitAt ?? f.createdAt).filter(Boolean).sort()[0] ?? null;
  const deliveredAt = fulfillments.map((f) => f.deliveredAt).filter(Boolean).sort().pop() ?? null;

  const display = String(latest?.displayStatus ?? '').toUpperCase();
  const stage: OrderStage = order.cancelledAt
    ? 'cancelled'
    : deliveredAt || display === 'DELIVERED'
      ? 'delivered'
      : outForDeliveryAt || display === 'OUT_FOR_DELIVERY'
        ? 'out_for_delivery'
        : fulfillments.length
          ? 'on_its_way'
          : 'preparing';

  const placedAt = order.processedAt ?? order.createdAt ?? '';
  const timeline: OrderTimelineStep[] = [];
  if (placedAt) timeline.push({ kind: 'placed', at: placedAt });
  if (shippedAt) timeline.push({ kind: 'shipped', at: shippedAt, carrier });
  if (outForDeliveryAt) timeline.push({ kind: 'out_for_delivery', at: outForDeliveryAt });
  if (deliveredAt) timeline.push({ kind: 'delivered', at: deliveredAt });

  const due = minor(order.totalOutstandingSet?.presentmentMoney);
  const cashGateway = (order.paymentGatewayNames ?? []).some((name) => CASH_GATEWAY.test(String(name ?? '')));
  const cashDue = cashGateway && (due ?? 0) > 0 && stage !== 'cancelled' && stage !== 'delivered';

  const card: OrderCard = {
    name: String(order.name ?? '').startsWith('#') ? String(order.name) : `#${String(order.name ?? '').replace(/^#/, '')}`,
    placedAt,
    stage,
    items: (order.lineItems?.nodes ?? [])
      .slice(0, 10)
      .map((item) => ({ title: String(item.title ?? '').slice(0, 120), quantity: Number(item.quantity ?? 0) })),
    timeline,
    estimatedDelivery: stage === 'delivered' || stage === 'cancelled' ? null : (latest?.estimatedDeliveryAt ?? null),
    carrier,
    trackingUrl: safeUrl(tracking?.url),
    cashDue,
  };
  if (options.withAmounts) {
    const total = minor(order.currentTotalPriceSet?.presentmentMoney);
    const currency = order.currentTotalPriceSet?.presentmentMoney?.currencyCode ?? order.totalOutstandingSet?.presentmentMoney?.currencyCode;
    if (total !== null) card.totalMinor = total;
    if (cashDue && due !== null) card.amountDueMinor = due;
    if (currency) card.currency = currency;
  }
  return card;
}

/** "m•••••@gmail.com": enough for the shopper to recognise, nothing more. */
export function maskEmail(email: string): string {
  const [local, domain] = email.trim().split('@');
  if (!local || !domain) return '•••••';
  return `${local[0]}•••••@${domain.toLowerCase()}`;
}

/** "1027" from "#1027", " 1027 " or "１０２７"; null when it is not an order number. */
export function normalizeOrderNumber(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const folded = input
    .trim()
    .replace(/^#/, '')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[０-９]/g, (d) => String(d.charCodeAt(0) - 0xff10));
  return /^\d{1,12}$/.test(folded) ? folded : null;
}

export const ORDER_CONTACT_EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/;

/** Order lookup needs a real Shopify store to address: the site's domain
 *  when it is a myshopify one, otherwise none. */
export function orderShopDomain(domain: string | null | undefined): string | null {
  return domain && /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(domain) ? domain : null;
}
