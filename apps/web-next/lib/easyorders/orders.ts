import 'server-only';
import type { OrderCard, OrderStage } from '@/lib/messenger/order-card';
import type { OrderFacts, PaymentState } from '@/lib/messenger/orders';
import { easyOrdersRequest } from './client';
import { egyptPhoneMatches } from './phone';
import type { EasyOrdersConnection } from './types';

type StatusMeaning = { stage: OrderStage; meaning: string; payment: PaymentState };
export const EASYORDERS_STATUSES: Record<string, StatusMeaning> = {
  pending: { stage: 'preparing', meaning: 'Awaiting confirmation', payment: 'pending' },
  confirmed: { stage: 'preparing', meaning: 'Order confirmed', payment: 'unknown' },
  pending_payment: { stage: 'preparing', meaning: 'Awaiting payment', payment: 'pending' },
  paid: { stage: 'preparing', meaning: 'Payment received', payment: 'paid' },
  paid_failed: { stage: 'preparing', meaning: 'Payment failed; contact the store', payment: 'unknown' },
  processing: { stage: 'preparing', meaning: 'Order being prepared', payment: 'unknown' },
  waiting_for_pickup: { stage: 'preparing', meaning: 'Awaiting pickup', payment: 'unknown' },
  in_delivery: { stage: 'on_its_way', meaning: 'Order is in delivery; no tracking available', payment: 'unknown' },
  delivered: { stage: 'delivered', meaning: 'Order delivered', payment: 'unknown' },
  canceled: { stage: 'cancelled', meaning: 'Order canceled', payment: 'unknown' },
  returning_from_delivery: { stage: 'preparing', meaning: 'Order returning from delivery', payment: 'unknown' },
  request_refund: { stage: 'preparing', meaning: 'Refund requested', payment: 'unknown' },
  refund_in_progress: { stage: 'preparing', meaning: 'Refund being processed', payment: 'unknown' },
  refunded: { stage: 'cancelled', meaning: 'Payment refunded', payment: 'refunded' },
};
export function easyOrdersStatus(status: string): StatusMeaning {
  return Object.hasOwn(EASYORDERS_STATUSES, status) ? EASYORDERS_STATUSES[status] : EASYORDERS_STATUSES.processing;
}
export type EasyOrder = {
  id: string; number: string; status: string; createdAt: string; phone: string | null; email: string | null;
  items: Array<{ title: string; quantity: number }>; total: number | null; currency: string | null;
};
const obj = (v: unknown): Record<string, unknown> | null => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : null;
const text = (v: unknown, max: number) => typeof v === 'string' && v.length <= max ? v : null;
export function parseEasyOrder(json: unknown): EasyOrder | null {
  const outer = obj(json);
  const o = obj(outer?.data) ?? outer;
  if (!o) return null;
  const id = typeof o.id === 'number' && Number.isSafeInteger(o.id) ? String(o.id) : text(o.id, 100);
  const number = typeof o.short_id === 'number' && Number.isSafeInteger(o.short_id) ? String(o.short_id) : text(o.short_id, 12);
  if (!id || !/^[A-Za-z0-9_-]{1,100}$/.test(id) || !number || !/^\d{1,12}$/.test(number)) return null;
  const date = text(o.created_at, 40);
  const items = Array.isArray(o.cart_items) ? o.cart_items.slice(0, 10).flatMap((raw) => {
    const i = obj(raw);
    const title = text(i?.name, 120) ?? text(i?.title, 120) ?? text(obj(i?.product)?.name, 120);
    const q = i?.quantity;
    return title && typeof q === 'number' && Number.isInteger(q) && q > 0 && q < 100000 ? [{ title, quantity: q }] : [];
  }) : [];
  const amount = typeof o.total_cost === 'string' && /^\d{1,12}(\.\d{1,2})?$/.test(o.total_cost)
    ? Number(o.total_cost) : typeof o.total_cost === 'number' ? o.total_cost : null;
  return {
    id, number, status: text(o.status, 80) ?? 'processing',
    createdAt: date && Number.isFinite(Date.parse(date)) ? date : '',
    phone: text(o.phone, 40), email: text(o.email, 254), items,
    total: amount !== null && Number.isFinite(amount) && amount >= 0 && amount < 1e12 ? amount : null,
    currency: typeof o.currency === 'string' && /^[A-Z]{3}$/.test(o.currency) ? o.currency : null,
  };
}
export function easyOrderFacts(o: EasyOrder): OrderFacts {
  const status = easyOrdersStatus(o.status);
  return { order_number: o.number, order_date: o.createdAt.slice(0, 10), fulfillment_status: status.meaning,
    payment_state: status.payment, line_items: o.items, tracking: null, destination: null };
}
export function easyOrderCard(o: EasyOrder, withAmounts: boolean): OrderCard {
  const card: OrderCard = { name: `#${o.number}`, ref: o.id, placedAt: o.createdAt, stage: easyOrdersStatus(o.status).stage,
    items: o.items, timeline: o.createdAt ? [{ kind: 'placed', at: o.createdAt }] : [],
    estimatedDelivery: null, carrier: null, trackingUrl: null, cashDue: false };
  // Neither currency nor COD is documented. Never assume EGP or cash due.
  if (withAmounts && o.total !== null && o.currency) {
    const digits = new Intl.NumberFormat('en', { style: 'currency', currency: o.currency }).resolvedOptions().maximumFractionDigits ?? 2;
    card.totalMinor = Math.round(o.total * 10 ** digits); card.currency = o.currency;
  }
  return card;
}

// Short, bounded, process-local cache of parsed order data only. The DB epoch
// in each fresh connection read invalidates every instance after a webhook.
const cache = new Map<string, { expires: number; order: EasyOrder | null }>();
export async function lookupEasyOrder(c: EasyOrdersConnection, input: { orderNumber: string | null; phone?: string | null; email?: string | null }) {
  const denied = { ok: false, reason: 'not_found' } as const;
  if (!input.orderNumber || !/^\d{1,12}$/.test(input.orderNumber) || (!input.phone && !input.email)) return denied;
  const key = `${c.widget_site_id}:${c.webhook_token}:${c.order_cache_version}:${input.orderNumber}`;
  let order: EasyOrder | null;
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) order = hit.order;
  else {
    const result = await easyOrdersRequest(c, `orders/short/${input.orderNumber}`);
    if (!result.ok && result.reason !== 'not_found') return { ok: false, reason: 'provider_error' } as const;
    order = result.ok ? parseEasyOrder(result.json) : null;
    if (result.ok && !order) return { ok: false, reason: 'provider_error' } as const;
    for (const [k, v] of cache) if (v.expires <= Date.now()) cache.delete(k);
    if (cache.size >= 200) cache.delete(cache.keys().next().value!);
    cache.set(key, { expires: Date.now() + 15_000, order });
  }
  if (!order || order.number !== input.orderNumber) return denied;
  const email = input.email?.trim().toLowerCase();
  const emailMatch = Boolean(email && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    && order.email?.trim().toLowerCase() === email);
  return egyptPhoneMatches(order.phone, input.phone) || emailMatch ? { ok: true, order } as const : denied;
}
