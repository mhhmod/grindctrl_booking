import type { OrderCard, OrderStage, OrderTimelineStep } from './order-card';
import type { OrderFacts, PaymentState } from './orders';

/* WooCommerce order data as the plugin returns it, validated and mapped to
   the shapes Store Chat already uses (OrderFacts for the model's answer,
   OrderCard for the shopper). Anything the schema does not name is dropped. */

export type WooPluginOrder = {
  id: string;
  number: string;
  /** WooCommerce status slug without the wc- prefix. */
  status: string;
  createdAt: string;
  paid: boolean;
  total: string;
  currency: string;
  paymentMethod: string;
  items: Array<{ name: string; quantity: number }>;
  shippingMethod: string | null;
  tracking: { carrier: string | null; number: string | null; url: string | null; shippedAt: string | null } | null;
  destination: { city: string | null; country: string | null } | null;
};

const MAX_ORDERS = 5;
const MAX_ITEMS = 10;

function text(value: unknown, max: number): string | null {
  return typeof value === 'string' && value.length > 0 ? value.slice(0, max) : null;
}

function isoDate(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 40) return null;
  return Number.isNaN(Date.parse(value)) ? null : value;
}

function httpsUrl(value: unknown): string | null {
  const raw = text(value, 2048);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function currencyDigits(currency: string): number {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

/** The card counts in the ISO minor unit of the currency, as Shopify's does. */
export function decimalToMinor(amount: string, currency: string): number | null {
  const value = Number(amount);
  return Number.isFinite(value) && value >= 0 ? Math.round(value * 10 ** currencyDigits(currency)) : null;
}

function parseOrder(raw: unknown): WooPluginOrder | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === 'number' && Number.isSafeInteger(o.id) && o.id > 0 ? String(o.id) : null;
  const number = typeof o.number === 'string' && /^#?[A-Za-z0-9_-]{1,32}$/.test(o.number) ? o.number.replace(/^#/, '') : null;
  const status = typeof o.status === 'string' && /^[a-z0-9_-]{1,40}$/.test(o.status) ? o.status.replace(/^wc-/, '') : null;
  const createdAt = isoDate(o.createdAt);
  const total = typeof o.total === 'string' && /^\d{1,12}(\.\d{1,6})?$/.test(o.total) ? o.total : null;
  const currency = typeof o.currency === 'string' && /^[A-Z]{3}$/.test(o.currency) ? o.currency : null;
  if (!id || !number || !status || !createdAt || !total || !currency || !Array.isArray(o.items)) return null;

  const items = o.items.slice(0, MAX_ITEMS).flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const i = item as Record<string, unknown>;
    const name = text(i.name, 120);
    const quantity =
      typeof i.quantity === 'number' && Number.isInteger(i.quantity) && i.quantity >= 0 && i.quantity < 100000
        ? i.quantity
        : null;
    return name !== null && quantity !== null ? [{ name, quantity }] : [];
  });

  const t = o.tracking && typeof o.tracking === 'object' ? (o.tracking as Record<string, unknown>) : null;
  const tracking = t
    ? { carrier: text(t.carrier, 80), number: text(t.number, 80), url: httpsUrl(t.url), shippedAt: isoDate(t.shippedAt) }
    : null;
  const d = o.destination && typeof o.destination === 'object' ? (o.destination as Record<string, unknown>) : null;

  return {
    id,
    number,
    status,
    createdAt,
    paid: o.paid === true,
    total,
    currency,
    paymentMethod: text(o.paymentMethod, 40) ?? '',
    items,
    shippingMethod: text(o.shippingMethod, 120),
    tracking: tracking && (tracking.number || tracking.url || tracking.carrier) ? tracking : null,
    destination: d ? { city: text(d.city, 80), country: text(d.country, 2) } : null,
  };
}

/** `{ ok: true, orders: [...] }`, or null when the response is not that. */
export function parseWooOrderResponse(json: unknown): WooPluginOrder[] | null {
  if (!json || typeof json !== 'object') return null;
  const body = json as Record<string, unknown>;
  if (body.ok !== true || !Array.isArray(body.orders) || body.orders.length > MAX_ORDERS) return null;
  const orders: WooPluginOrder[] = [];
  for (const raw of body.orders) {
    const order = parseOrder(raw);
    if (!order) return null;
    orders.push(order);
  }
  return orders;
}

/* WooCommerce status vocabulary to Store Chat's. A status outside the stock
   set (a shipping plugin's own) reads as preparing, or on its way when the
   order carries tracking, rather than guessing what it means. */
function stageOf(order: WooPluginOrder): OrderStage {
  switch (order.status) {
    case 'cancelled':
    case 'failed':
    case 'refunded':
      return 'cancelled';
    case 'completed':
      return order.tracking ? 'on_its_way' : 'delivered';
    default:
      return order.tracking ? 'on_its_way' : 'preparing';
  }
}

function paymentState(order: WooPluginOrder): PaymentState {
  if (order.status === 'refunded') return 'refunded';
  if (order.status === 'cancelled' || order.status === 'failed') return 'unknown';
  return order.paid ? 'paid' : 'pending';
}

function fulfillmentStatus(order: WooPluginOrder): string {
  if (order.status === 'completed') return 'fulfilled';
  if (order.status === 'cancelled' || order.status === 'refunded') return order.status;
  return 'unfulfilled';
}

export function wooToOrderFacts(order: WooPluginOrder): OrderFacts {
  return {
    order_number: order.number,
    order_date: order.createdAt.slice(0, 10),
    fulfillment_status: fulfillmentStatus(order),
    payment_state: paymentState(order),
    line_items: order.items.map((item) => ({ title: item.name, quantity: item.quantity })),
    tracking: order.tracking
      ? { company: order.tracking.carrier, number: order.tracking.number, url: order.tracking.url }
      : null,
    destination: order.destination,
  };
}

export function wooToOrderCard(order: WooPluginOrder, options: { withAmounts: boolean }): OrderCard {
  const stage = stageOf(order);
  const timeline: OrderTimelineStep[] = [{ kind: 'placed', at: order.createdAt }];
  if (order.tracking?.shippedAt) {
    timeline.push({ kind: 'shipped', at: order.tracking.shippedAt, carrier: order.tracking.carrier });
  }
  const cashDue = order.paymentMethod === 'cod' && !order.paid && stage !== 'cancelled' && stage !== 'delivered';
  const card: OrderCard = {
    name: `#${order.number}`,
    ref: order.id,
    placedAt: order.createdAt,
    stage,
    items: order.items.map((item) => ({ title: item.name, quantity: item.quantity })),
    timeline,
    estimatedDelivery: null,
    carrier: order.tracking?.carrier ?? null,
    trackingUrl: order.tracking?.url ?? null,
    cashDue,
  };
  if (options.withAmounts) {
    const total = decimalToMinor(order.total, order.currency);
    if (total !== null) {
      card.totalMinor = total;
      if (cashDue) card.amountDueMinor = total;
    }
    card.currency = order.currency;
  }
  return card;
}
