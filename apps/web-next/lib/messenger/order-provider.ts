import 'server-only';

import { requireRateLimit } from '@/lib/request-rate-limit';
import {
  lookupCustomerOrderCard,
  lookupGuestOrderCard,
  lookupOrder,
  type GuestCardOutcome,
  type LookupOutcome,
} from './orders';
import { wooSiteOrderLimiter } from './order-limits';
import { orderShopDomain } from './order-card';
import { adminCustomerUrl, adminLinkTarget, adminOrderUrl } from './order-admin-links';
import { parseWooOrderResponse, wooToOrderCard, wooToOrderFacts } from './woo-orders';
import { loadActiveWooConnection, type ActiveWooConnection } from '@/lib/woo/active-connection';
import { pluginSupportsOrderLookup } from '@/lib/woo/plugin-version';
import { callWooPlugin, WOO_PLUGIN_ORDER_LOOKUP_PATH } from '@/lib/woo/plugin-client';

/* Where Store Chat's order lookup reads orders from, per site.

   The lookup flow (proofs, rate limits, denial copy) is platform neutral and
   lives with the callers; a provider only answers "what does this store hold
   for this customer, or for this order number and email", in the shapes the
   chat already uses. A site with no provider has no order lookup. */

export type OrderProviderPlatform = 'shopify' | 'woocommerce';

export interface OrderProvider {
  readonly platform: OrderProviderPlatform;
  /** The newest order (or the named one) of a customer the platform verified. */
  lookupForCustomer(input: {
    customerId: string;
    orderNumber: string | null;
    appClientId?: string;
  }): Promise<LookupOutcome>;
  /** Guest proof: the order number with the email on it. Facts for the model. */
  lookupByEmailAndNumber(input: {
    orderNumber: string | null;
    email: string | null;
    appClientId?: string;
  }): Promise<LookupOutcome>;
  /** Guest proof, answered as the card the shopper sees. */
  lookupGuestCard(input: { orderNumber: string; email: string; withAmounts: boolean }): Promise<GuestCardOutcome>;
  /** A verified customer's newest order as the card, no email asked. */
  lookupCustomerCard(input: {
    customerId: string;
    withAmounts: boolean;
    appClientId?: string;
  }): Promise<GuestCardOutcome>;
  adminOrderUrl(order: { name: string; ref?: string }): string | null;
  adminCustomerUrl(customerId: string | null): string | null;
}

export class ShopifyOrderProvider implements OrderProvider {
  readonly platform = 'shopify' as const;
  constructor(private readonly shopDomain: string) {}

  lookupForCustomer(input: { customerId: string; orderNumber: string | null; appClientId?: string }) {
    return lookupOrder({
      shopDomain: this.shopDomain,
      appClientId: input.appClientId,
      verifiedCustomerId: input.customerId,
      orderNumber: input.orderNumber,
      email: null,
    });
  }

  lookupByEmailAndNumber(input: { orderNumber: string | null; email: string | null; appClientId?: string }) {
    return lookupOrder({
      shopDomain: this.shopDomain,
      appClientId: input.appClientId,
      verifiedCustomerId: null,
      orderNumber: input.orderNumber,
      email: input.email,
    });
  }

  lookupGuestCard(input: { orderNumber: string; email: string; withAmounts: boolean }) {
    return lookupGuestOrderCard({ shopDomain: this.shopDomain, ...input });
  }

  lookupCustomerCard(input: { customerId: string; withAmounts: boolean; appClientId?: string }) {
    return lookupCustomerOrderCard({
      shopDomain: this.shopDomain,
      appClientId: input.appClientId,
      verifiedCustomerId: input.customerId,
      withAmounts: input.withAmounts,
    });
  }

  adminOrderUrl(order: { name: string; ref?: string }) {
    return adminOrderUrl(adminLinkTarget({ shopDomain: this.shopDomain }), order);
  }

  adminCustomerUrl(customerId: string | null) {
    return adminCustomerUrl(adminLinkTarget({ shopDomain: this.shopDomain }), customerId);
  }
}

/** The number the shopper typed names the order the plugin returned: exactly,
 *  or as the digits of a formatted number ("WC-1027" shows as 1027). */
function sameOrderNumber(shown: string, asked: string): boolean {
  return shown === asked || shown.replace(/\D/g, '') === asked;
}

type PluginReply =
  | { ok: true; orders: NonNullable<ReturnType<typeof parseWooOrderResponse>> }
  | { ok: false; reason: 'provider_error' };

export class WooOrderProvider implements OrderProvider {
  readonly platform = 'woocommerce' as const;
  constructor(private readonly connection: ActiveWooConnection) {}

  private async ask(payload: Record<string, unknown>): Promise<PluginReply> {
    try {
      await requireRateLimit(wooSiteOrderLimiter, this.connection.siteId);
    } catch {
      return { ok: false, reason: 'provider_error' };
    }
    const result = await callWooPlugin(this.connection, WOO_PLUGIN_ORDER_LOOKUP_PATH, payload);
    if (!result.ok) {
      console.error('[messenger] woo order lookup failed:', result.reason);
      return { ok: false, reason: 'provider_error' };
    }
    const orders = parseWooOrderResponse(result.json);
    if (!orders) {
      console.error('[messenger] woo order lookup returned an invalid response');
      return { ok: false, reason: 'provider_error' };
    }
    return { ok: true, orders };
  }

  async lookupForCustomer(input: { customerId: string; orderNumber: string | null }): Promise<LookupOutcome> {
    if (!/^[1-9]\d{0,14}$/.test(input.customerId)) return { ok: false, reason: 'missing_proof' };
    const reply = await this.ask({
      mode: 'customer',
      wpUserId: Number(input.customerId),
      limit: 1,
      ...(input.orderNumber ? { orderNumber: input.orderNumber } : {}),
    });
    if (!reply.ok) return reply;
    const order = reply.orders[0];
    if (!order || (input.orderNumber && !sameOrderNumber(order.number, input.orderNumber))) return { ok: false, reason: 'not_found' };
    return { ok: true, facts: wooToOrderFacts(order) };
  }

  async lookupByEmailAndNumber(input: { orderNumber: string | null; email: string | null }): Promise<LookupOutcome> {
    if (!input.orderNumber || !input.email) return { ok: false, reason: 'missing_proof' };
    const reply = await this.ask({ mode: 'guest', email: input.email.trim().slice(0, 254), orderNumber: input.orderNumber });
    if (!reply.ok) return reply;
    // The plugin answers a wrong email exactly like a missing order.
    const order = reply.orders[0];
    if (!order || !sameOrderNumber(order.number, input.orderNumber)) return { ok: false, reason: 'not_found' };
    return { ok: true, facts: wooToOrderFacts(order) };
  }

  async lookupGuestCard(input: { orderNumber: string; email: string; withAmounts: boolean }): Promise<GuestCardOutcome> {
    const reply = await this.ask({ mode: 'guest', email: input.email.trim().slice(0, 254), orderNumber: input.orderNumber });
    if (!reply.ok) return reply;
    const order = reply.orders[0];
    if (!order || !sameOrderNumber(order.number, input.orderNumber)) return { ok: false, reason: 'not_found' };
    return { ok: true, card: wooToOrderCard(order, { withAmounts: input.withAmounts }) };
  }

  async lookupCustomerCard(input: { customerId: string; withAmounts: boolean }): Promise<GuestCardOutcome> {
    if (!/^[1-9]\d{0,14}$/.test(input.customerId)) return { ok: false, reason: 'missing_proof' };
    const reply = await this.ask({ mode: 'customer', wpUserId: Number(input.customerId), limit: 1 });
    if (!reply.ok) return reply;
    const order = reply.orders[0];
    return order ? { ok: true, card: wooToOrderCard(order, { withAmounts: input.withAmounts }) } : { ok: false, reason: 'not_found' };
  }

  adminOrderUrl(order: { name: string; ref?: string }) {
    return adminOrderUrl(adminLinkTarget({ shopDomain: null, wooHomeUrl: this.connection.homeUrl }), order);
  }

  adminCustomerUrl(customerId: string | null) {
    return adminCustomerUrl(adminLinkTarget({ shopDomain: null, wooHomeUrl: this.connection.homeUrl }), customerId);
  }
}

/** Which provider a site has, given its domain and (for non-Shopify sites)
 *  its active WooCommerce pairing. */
export function orderProviderFor(
  site: { domain?: string | null },
  wooConnection: ActiveWooConnection | null,
): OrderProvider | null {
  const shopDomain = orderShopDomain(site.domain);
  if (shopDomain) return new ShopifyOrderProvider(shopDomain);
  // Plugins before 0.3.0 have no order route: no provider, so the model is
  // never told order lookup exists.
  return wooConnection && pluginSupportsOrderLookup(wooConnection.pluginVersion)
    ? new WooOrderProvider(wooConnection)
    : null;
}

/** The site's active WooCommerce pairing, or null: not Shopify, not paired,
 *  or the registry cannot be read (which fails closed, to no provider). */
export async function wooConnectionFor(site: { id: string; domain?: string | null }): Promise<ActiveWooConnection | null> {
  if (orderShopDomain(site.domain)) return null;
  try {
    return await loadActiveWooConnection(site.id);
  } catch (error) {
    console.error('[messenger] woo connection unavailable:', error instanceof Error ? error.message : error);
    return null;
  }
}

export async function resolveOrderProvider(site: { id: string; domain?: string | null }, options?: { strict?: boolean }): Promise<OrderProvider | null> {
  // A config snapshot must not cache a transient connection failure as "no provider".
  const connection = options?.strict && !orderShopDomain(site.domain)
    ? await loadActiveWooConnection(site.id) : await wooConnectionFor(site);
  return orderProviderFor(site, connection);
}
