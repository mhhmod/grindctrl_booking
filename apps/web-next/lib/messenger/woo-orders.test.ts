import { describe, expect, it } from 'vitest';
import { parseWooOrderResponse, wooToOrderCard, wooToOrderFacts, type WooPluginOrder } from './woo-orders';
import { adminCustomerUrl, adminLinkTarget, adminOrderUrl } from './order-admin-links';

const raw = {
  id: 1027,
  number: '1027',
  status: 'processing',
  createdAt: '2026-10-30T09:15:00Z',
  paid: true,
  total: '4700.00',
  currency: 'EGP',
  paymentMethod: 'bacs',
  items: [{ name: 'Layla Embroidered Abaya', quantity: 2 }],
  shippingMethod: 'Flat rate',
  tracking: null,
  destination: { city: 'Cairo', country: 'EG' },
};

function order(overrides: Record<string, unknown> = {}): WooPluginOrder {
  const parsed = parseWooOrderResponse({ ok: true, orders: [{ ...raw, ...overrides }] });
  if (!parsed) throw new Error('fixture rejected');
  return parsed[0];
}

describe('parseWooOrderResponse', () => {
  it('reads the documented shape', () => {
    expect(order()).toMatchObject({ id: '1027', number: '1027', status: 'processing', total: '4700.00', currency: 'EGP' });
  });

  it.each([
    [null],
    [{ ok: false, orders: [] }],
    [{ ok: true }],
    [{ ok: true, orders: [{ ...raw, status: 'Processing!' }] }],
    [{ ok: true, orders: [{ ...raw, id: '1027' }] }],
    [{ ok: true, orders: [{ ...raw, total: 'free' }] }],
    [{ ok: true, orders: [{ ...raw, currency: 'egp' }] }],
    [{ ok: true, orders: [{ ...raw, createdAt: 'yesterday' }] }],
    [{ ok: true, orders: new Array(6).fill(raw) }],
  ])('rejects %j', (json) => {
    expect(parseWooOrderResponse(json)).toBeNull();
  });

  it('drops unknown fields and non-https tracking links', () => {
    const parsed = order({
      customerNote: 'leave at the door',
      billingEmail: 'a@b.co',
      tracking: { carrier: 'Bosta', number: 'B1', url: 'http://insecure.example/track', shippedAt: '2026-10-31T10:00:00Z' },
    });
    expect(JSON.stringify(parsed)).not.toContain('leave at the door');
    expect(JSON.stringify(parsed)).not.toContain('a@b.co');
    expect(parsed.tracking?.url).toBeNull();
  });
});

describe('status mapping', () => {
  const stage = (status: string, tracking: unknown = null) => wooToOrderCard(order({ status, tracking }), { withAmounts: false }).stage;
  const shipped = { carrier: 'Bosta', number: 'B1', url: 'https://bosta.co/track/B1', shippedAt: '2026-10-31T10:00:00Z' };

  it.each([
    ['pending', 'preparing'],
    ['on-hold', 'preparing'],
    ['processing', 'preparing'],
    ['completed', 'delivered'],
    ['cancelled', 'cancelled'],
    ['failed', 'cancelled'],
    ['refunded', 'cancelled'],
    ['a-shipping-plugin-status', 'preparing'],
  ])('%s reads as %s', (status, expected) => {
    expect(stage(status)).toBe(expected);
  });

  it('reads tracking as on its way, not delivered', () => {
    expect(stage('processing', shipped)).toBe('on_its_way');
    expect(stage('completed', shipped)).toBe('on_its_way');
  });

  it('maps facts for the model', () => {
    expect(wooToOrderFacts(order())).toEqual({
      order_number: '1027',
      order_date: '2026-10-30',
      fulfillment_status: 'unfulfilled',
      payment_state: 'paid',
      line_items: [{ title: 'Layla Embroidered Abaya', quantity: 2 }],
      tracking: null,
      destination: { city: 'Cairo', country: 'EG' },
    });
    expect(wooToOrderFacts(order({ status: 'completed' })).fulfillment_status).toBe('fulfilled');
    expect(wooToOrderFacts(order({ status: 'refunded' })).payment_state).toBe('refunded');
    expect(wooToOrderFacts(order({ paid: false, status: 'on-hold' })).payment_state).toBe('pending');
    expect(wooToOrderFacts(order({ status: 'cancelled', paid: false })).payment_state).toBe('unknown');
  });
});

describe('wooToOrderCard', () => {
  it('shows amounts only when allowed, in minor units', () => {
    expect(wooToOrderCard(order(), { withAmounts: false })).not.toHaveProperty('totalMinor');
    expect(wooToOrderCard(order(), { withAmounts: true })).toMatchObject({ name: '#1027', ref: '1027', totalMinor: 470000, currency: 'EGP', cashDue: false });
  });

  it('flags cash due on a cash on delivery order that is not paid', () => {
    const card = wooToOrderCard(order({ paymentMethod: 'cod', paid: false }), { withAmounts: true });
    expect(card).toMatchObject({ cashDue: true, amountDueMinor: 470000 });
    expect(wooToOrderCard(order({ paymentMethod: 'cod', paid: false, status: 'cancelled' }), { withAmounts: true }).cashDue).toBe(false);
  });

  it('adds a shipped step when the order carries tracking', () => {
    const card = wooToOrderCard(
      order({ tracking: { carrier: 'Bosta', number: 'B1', url: 'https://bosta.co/track/B1', shippedAt: '2026-10-31T10:00:00Z' } }),
      { withAmounts: false },
    );
    expect(card.timeline.map((step) => step.kind)).toEqual(['placed', 'shipped']);
    expect(card).toMatchObject({ carrier: 'Bosta', trackingUrl: 'https://bosta.co/track/B1' });
  });
});

describe('admin links', () => {
  const woo = adminLinkTarget({ shopDomain: null, wooHomeUrl: 'https://example.com/store/' });

  it('builds wp-admin addresses that work with or without HPOS', () => {
    expect(adminOrderUrl(woo, { name: '#1027', ref: '1027' })).toBe('https://example.com/store/wp-admin/post.php?post=1027&action=edit');
    expect(adminCustomerUrl(woo, '12')).toBe('https://example.com/store/wp-admin/user-edit.php?user_id=12');
  });

  it('refuses ids that are not numbers and homes that are not https', () => {
    expect(adminOrderUrl(woo, { name: '#1', ref: '1&x=y' })).toBeNull();
    expect(adminOrderUrl(woo, { name: '#1' })).toBeNull();
    expect(adminCustomerUrl(woo, '../x')).toBeNull();
    expect(adminOrderUrl(adminLinkTarget({ shopDomain: null, wooHomeUrl: 'http://example.com' }), { name: '#1', ref: '1' })).toBeNull();
  });

  it('keeps Shopify links as they were', () => {
    const shopify = adminLinkTarget({ shopDomain: 'maison-noor.myshopify.com' });
    expect(adminOrderUrl(shopify, { name: '#1042' })).toBe('https://admin.shopify.com/store/maison-noor/orders?query=%231042');
    expect(adminCustomerUrl(shopify, '7')).toBe('https://admin.shopify.com/store/maison-noor/customers/7');
  });
});
