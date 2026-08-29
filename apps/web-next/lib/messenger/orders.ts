import 'server-only';

import { adminGraphql, ShopifyAdminError } from '@/lib/shopify/admin';
import { getShopToken, hasOrderScope } from '@/lib/shopify/tokens';

/* Order lookup.

   Two accepted proofs and no others:

   1. A VERIFIED shopper — identity came from the app-proxy signed token, so
      the customer id is ours, not theirs. Orders are read for that customer.
   2. An ANONYMOUS shopper — must supply an order number AND an email, and
      the email must match the one on the order.

   Every denial reads identically to the shopper. Wrong number, wrong email,
   another store's order, exhausted budget: all one sentence. Telling them
   which part was wrong is what turns a support chat into an oracle for
   guessing whether an order or an address exists. */

export const ORDER_LOOKUP_LIFETIME_LIMIT = 5;

export type PaymentState = 'paid' | 'refunded' | 'pending' | 'unknown';

/** Exactly what the model is allowed to see. Assembled here, server-side —
 *  the raw Shopify payload never reaches a completion. Deliberately absent:
 *  full address, phone, email, customer id, prices, discounts, notes, tags,
 *  and any other order. */
export interface OrderFacts {
  order_number: string;
  order_date: string;
  fulfillment_status: string;
  payment_state: PaymentState;
  line_items: Array<{ title: string; quantity: number }>;
  tracking: { company: string | null; number: string | null; url: string | null } | null;
  destination: { city: string | null; country: string | null } | null;
}

export type LookupDenial =
  | 'not_configured'
  | 'no_scope'
  | 'missing_proof'
  | 'not_found'
  | 'email_mismatch'
  | 'provider_error';

export type LookupOutcome = { ok: true; facts: OrderFacts } | { ok: false; reason: LookupDenial };

/* Coarse on purpose. Shopify has a dozen financial statuses with meanings a
   support bot should not attempt to explain; anything outside these four
   becomes 'unknown', and a shopper asking further gets a human. */
export function mapPaymentState(displayFinancialStatus: unknown): PaymentState {
  switch (String(displayFinancialStatus ?? '').toUpperCase()) {
    case 'PAID':
    case 'PARTIALLY_PAID':
      return 'paid';
    case 'REFUNDED':
    case 'PARTIALLY_REFUNDED':
      return 'refunded';
    case 'PENDING':
    case 'AUTHORIZED':
      return 'pending';
    default:
      return 'unknown';
  }
}

interface RawOrder {
  name?: string;
  processedAt?: string;
  createdAt?: string;
  email?: string | null;
  displayFulfillmentStatus?: string;
  displayFinancialStatus?: string;
  lineItems?: { nodes?: Array<{ title?: string; quantity?: number }> };
  fulfillments?: Array<{ trackingInfo?: Array<{ company?: string | null; number?: string | null; url?: string | null }> }>;
  shippingAddress?: { city?: string | null; country?: string | null } | null;
}

export function toOrderFacts(order: RawOrder): OrderFacts {
  const tracking = order.fulfillments?.flatMap((f) => f.trackingInfo ?? []).find((info) => info.number || info.url);
  return {
    order_number: String(order.name ?? '').replace(/^#/, ''),
    order_date: String(order.processedAt ?? order.createdAt ?? '').slice(0, 10),
    fulfillment_status: String(order.displayFulfillmentStatus ?? 'UNFULFILLED').toLowerCase(),
    payment_state: mapPaymentState(order.displayFinancialStatus),
    line_items: (order.lineItems?.nodes ?? [])
      .slice(0, 10)
      .map((item) => ({ title: String(item.title ?? '').slice(0, 120), quantity: Number(item.quantity ?? 0) })),
    tracking: tracking
      ? { company: tracking.company ?? null, number: tracking.number ?? null, url: tracking.url ?? null }
      : null,
    destination: order.shippingAddress
      ? { city: order.shippingAddress.city ?? null, country: order.shippingAddress.country ?? null }
      : null,
  };
}

const ORDER_FIELDS = `
  name
  processedAt
  createdAt
  email
  displayFulfillmentStatus
  displayFinancialStatus
  lineItems(first: 10) { nodes { title quantity } }
  fulfillments(first: 5) { trackingInfo { company number url } }
  shippingAddress { city country }
`;

const BY_NAME_QUERY = `query OrderByName($query: String!) {
  orders(first: 1, query: $query) { nodes { ${ORDER_FIELDS} } }
}`;

const BY_CUSTOMER_QUERY = `query CustomerOrders($id: ID!, $query: String) {
  customer(id: $id) {
    orders(first: 1, sortKey: PROCESSED_AT, reverse: true, query: $query) {
      nodes { ${ORDER_FIELDS} }
    }
  }
}`;

export async function lookupOrder(input: {
  shopDomain: string;
  /** From the conversation record + proxy-signed token. Never from the model. */
  verifiedCustomerId: string | null;
  orderNumber: string | null;
  email: string | null;
}): Promise<LookupOutcome> {
  const token = await getShopToken(input.shopDomain);
  if (!token) return { ok: false, reason: 'not_configured' };
  // Holding a token issued before the scope change is not permission to
  // read orders. Re-consent is required, and until then this stays shut.
  if (!hasOrderScope(token.scopes)) return { ok: false, reason: 'no_scope' };

  const verified = Boolean(input.verifiedCustomerId);
  if (!verified && (!input.orderNumber || !input.email)) {
    return { ok: false, reason: 'missing_proof' };
  }

  try {
    if (verified) {
      const data = await adminGraphql<{ customer?: { orders?: { nodes?: RawOrder[] } } }>({
        shopDomain: input.shopDomain,
        accessToken: token.accessToken,
        query: BY_CUSTOMER_QUERY,
        variables: {
          id: `gid://shopify/Customer/${input.verifiedCustomerId}`,
          // A verified shopper may still name an order; scoping the search
          // to their own customer record is what keeps it theirs.
          query: input.orderNumber ? `name:#${input.orderNumber}` : null,
        },
      });
      const order = data.customer?.orders?.nodes?.[0];
      return order ? { ok: true, facts: toOrderFacts(order) } : { ok: false, reason: 'not_found' };
    }

    const data = await adminGraphql<{ orders?: { nodes?: RawOrder[] } }>({
      shopDomain: input.shopDomain,
      accessToken: token.accessToken,
      query: BY_NAME_QUERY,
      variables: { query: `name:#${input.orderNumber}` },
    });
    const order = data.orders?.nodes?.[0];
    if (!order) return { ok: false, reason: 'not_found' };

    /* The whole anonymous path rests on this comparison. Both sides trimmed
       and lowercased; an order with no email on it can never match, which
       is the correct answer rather than an accident. */
    const onOrder = (order.email ?? '').trim().toLowerCase();
    const supplied = (input.email ?? '').trim().toLowerCase();
    if (!onOrder || !supplied || onOrder !== supplied) return { ok: false, reason: 'email_mismatch' };

    return { ok: true, facts: toOrderFacts(order) };
  } catch (error) {
    const status = error instanceof ShopifyAdminError ? error.status : 0;
    console.error('[messenger] order lookup failed:', status, error instanceof Error ? error.message : error);
    return { ok: false, reason: 'provider_error' };
  }
}
