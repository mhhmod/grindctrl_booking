import 'server-only';
import type { OrderProvider } from '@/lib/messenger/order-provider';
import type { GuestCardOutcome, LookupOutcome } from '@/lib/messenger/orders';
import type { EasyOrdersConnection } from './types';
import { easyOrderCard, easyOrderFacts, lookupEasyOrder } from './orders';

/** Shopper/session/IP and order-number gates are shared with Woo in the
 * messenger callers. The client additionally enforces the store API budget. */
export class EasyOrdersOrderProvider implements OrderProvider {
  readonly platform = 'easyorders' as const;
  constructor(private readonly connection: EasyOrdersConnection) {}
  async lookupForCustomer(): Promise<LookupOutcome> { return { ok: false, reason: 'missing_proof' }; }
  async lookupCustomerCard(): Promise<GuestCardOutcome> { return { ok: false, reason: 'missing_proof' }; }
  async lookupByEmailAndNumber(input: { orderNumber: string | null; email: string | null; phone?: string | null }): Promise<LookupOutcome> {
    const result = await lookupEasyOrder(this.connection, input);
    return result.ok ? { ok: true, facts: easyOrderFacts(result.order) } : result;
  }
  async lookupGuestCard(input: { orderNumber: string; email: string; phone?: string | null; withAmounts: boolean }): Promise<GuestCardOutcome> {
    const result = await lookupEasyOrder(this.connection, input);
    return result.ok ? { ok: true, card: easyOrderCard(result.order, input.withAmounts) } : result;
  }
  adminOrderUrl() { return null; }
  adminCustomerUrl() { return null; }
}
