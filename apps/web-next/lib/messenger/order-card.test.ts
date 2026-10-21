import { describe, expect, it } from 'vitest';
import { maskEmail, normalizeOrderNumber, orderShopDomain, toOrderCard, type RawCardOrder } from './order-card';

/* The order card (Chat-More, Chat-Order) is drawn from the store's own
   order data: what Shopify holds, nothing the model says. */
const BASE: RawCardOrder = {
  name: '#1027',
  processedAt: '2026-10-14T09:00:00Z',
  paymentGatewayNames: ['Cash on Delivery (COD)'],
  totalOutstandingSet: { presentmentMoney: { amount: '3250.0', currencyCode: 'EGP' } },
  currentTotalPriceSet: { presentmentMoney: { amount: '3250.0', currencyCode: 'EGP' } },
  lineItems: { nodes: [{ title: 'Layla Embroidered Abaya', quantity: 1 }] },
  fulfillments: [],
};

const shipped = (extra: Partial<NonNullable<RawCardOrder['fulfillments']>[number]> = {}) => ({
  ...BASE,
  fulfillments: [
    {
      createdAt: '2026-10-15T10:00:00Z',
      inTransitAt: '2026-10-15T12:00:00Z',
      estimatedDeliveryAt: '2026-10-17T18:00:00Z',
      displayStatus: 'IN_TRANSIT',
      trackingInfo: [{ company: 'Bosta', url: 'https://bosta.co/tracking-shipments?shipment-number=123' }],
      events: { nodes: [] },
      ...extra,
    },
  ],
});

describe('the order card', () => {
  it('shows an order not yet shipped as preparing, with cash due and no amounts by default', () => {
    const card = toOrderCard(BASE, { withAmounts: false });
    expect(card).toMatchObject({ name: '#1027', stage: 'preparing', cashDue: true, carrier: null, trackingUrl: null, estimatedDelivery: null });
    expect(card.timeline).toEqual([{ kind: 'placed', at: '2026-10-14T09:00:00Z' }]);
    expect(card).not.toHaveProperty('totalMinor');
    expect(card).not.toHaveProperty('amountDueMinor');
  });

  it('follows the fulfilment: on its way with the carrier, its link and the arrival it gave', () => {
    const card = toOrderCard(shipped(), { withAmounts: false });
    expect(card).toMatchObject({
      stage: 'on_its_way',
      carrier: 'Bosta',
      trackingUrl: 'https://bosta.co/tracking-shipments?shipment-number=123',
      estimatedDelivery: '2026-10-17T18:00:00Z',
    });
    expect(card.timeline.map((s) => s.kind)).toEqual(['placed', 'shipped']);
    expect(card.timeline[1]).toMatchObject({ at: '2026-10-15T12:00:00Z', carrier: 'Bosta' });
  });

  it('reads out for delivery from the carrier events, and delivered from the fulfilment', () => {
    const out = toOrderCard(shipped({ events: { nodes: [{ status: 'OUT_FOR_DELIVERY', happenedAt: '2026-10-17T08:00:00Z' }] } }), { withAmounts: false });
    expect(out.stage).toBe('out_for_delivery');
    expect(out.timeline.map((s) => s.kind)).toEqual(['placed', 'shipped', 'out_for_delivery']);

    const done = toOrderCard(shipped({ deliveredAt: '2026-10-17T15:00:00Z', displayStatus: 'DELIVERED' }), { withAmounts: false });
    expect(done.stage).toBe('delivered');
    expect(done.estimatedDelivery).toBeNull();
    expect(done.cashDue).toBe(false);
    expect(done.timeline.at(-1)).toEqual({ kind: 'delivered', at: '2026-10-17T15:00:00Z' });
  });

  it('shows a cancelled order as cancelled, with nothing due', () => {
    const card = toOrderCard({ ...BASE, cancelledAt: '2026-10-14T10:00:00Z' }, { withAmounts: true });
    expect(card.stage).toBe('cancelled');
    expect(card.cashDue).toBe(false);
    expect(card).not.toHaveProperty('amountDueMinor');
  });

  it('says cash is due only for a cash gateway with money still owed', () => {
    expect(toOrderCard({ ...BASE, paymentGatewayNames: ['shopify_payments'] }, { withAmounts: false }).cashDue).toBe(false);
    expect(toOrderCard({ ...BASE, totalOutstandingSet: { presentmentMoney: { amount: '0.0', currencyCode: 'EGP' } } }, { withAmounts: false }).cashDue).toBe(false);
    expect(toOrderCard({ ...BASE, paymentGatewayNames: ['الدفع عند الاستلام'] }, { withAmounts: false }).cashDue).toBe(true);
  });

  it('carries the total and the amount due only when amounts may be shown', () => {
    expect(toOrderCard(BASE, { withAmounts: true })).toMatchObject({ totalMinor: 325000, amountDueMinor: 325000, currency: 'EGP' });
  });

  it('keeps only an https tracking link', () => {
    expect(toOrderCard(shipped({ trackingInfo: [{ company: 'Bosta', url: 'javascript:alert(1)' }] }), { withAmounts: false }).trackingUrl).toBeNull();
    expect(toOrderCard(shipped({ trackingInfo: [{ company: 'Bosta', url: 'http://bosta.co/x' }] }), { withAmounts: false }).trackingUrl).toBeNull();
  });
});

describe('the lookup helpers', () => {
  it('masks an email to its first letter and domain', () => {
    expect(maskEmail('mona.saleh@Gmail.com')).toBe('m•••••@gmail.com');
    expect(maskEmail('nope')).toBe('•••••');
  });

  it('reads an order number in Western, Arabic and Persian digits, with or without #', () => {
    expect(normalizeOrderNumber('#1027')).toBe('1027');
    expect(normalizeOrderNumber(' ١٠٢٧ ')).toBe('1027');
    expect(normalizeOrderNumber('۱۰۲۷')).toBe('1027');
    expect(normalizeOrderNumber('1027; drop')).toBeNull();
    expect(normalizeOrderNumber('')).toBeNull();
    expect(normalizeOrderNumber(1027)).toBeNull();
  });

  it('looks orders up only on a myshopify store', () => {
    expect(orderShopDomain('maison.myshopify.com')).toBe('maison.myshopify.com');
    expect(orderShopDomain('maisonnoor.com')).toBeNull();
    expect(orderShopDomain(null)).toBeNull();
  });
});
