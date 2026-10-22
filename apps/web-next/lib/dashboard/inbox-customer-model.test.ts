import { describe, expect, it } from 'vitest';
import type { OrderCard } from '@/lib/messenger/order-card';
import { getInboxCustomerCopy } from './inbox-customer-copy';
import { buildInboxCustomerView, pageFrom, type InboxCustomerFacts } from './inbox-customer-model';

const en = getInboxCustomerCopy('en');
const ar = getInboxCustomerCopy('ar');
const TZ = 'Africa/Cairo';

const ORDER: OrderCard = {
  name: '#1042',
  placedAt: '2026-10-20T10:00:00Z',
  stage: 'out_for_delivery',
  items: [
    { title: 'Layla Embroidered Abaya', quantity: 1 },
    { title: 'Silk Scarf', quantity: 2 },
  ],
  timeline: [],
  estimatedDelivery: null,
  carrier: 'Bosta',
  trackingUrl: 'https://bosta.co/track/123',
  cashDue: true,
  totalMinor: 470000,
  amountDueMinor: 470000,
  currency: 'EGP',
};

function facts(over: Partial<InboxCustomerFacts> = {}): InboxCustomerFacts {
  return {
    name: 'Salma Ahmed',
    email: 'salma@example.com',
    identity: null,
    contactEmail: null,
    lastPageUrl: 'https://maison.example/products/layla-embroidered-abaya?variant=1',
    order: ORDER,
    cart: { totalMinor: 390000, currency: 'EGP', items: [{ handle: 'zahra', variantId: '1', title: 'Zahra Occasion Abaya, M', quantity: 1, priceMinor: 390000 }] },
    past: [{ id: 'c0', startedAt: '2026-10-21T12:00:00Z', status: 'closed', preview: 'Can I exchange the Riyadh abaya?' }],
    shopDomain: 'maison-noor.myshopify.com',
    ...over,
  };
}

describe('the customer column', () => {
  it('names the shopper and where they came from, and the order they looked up, as the board does', () => {
    const view = buildInboxCustomerView(facts(), en, 'en', TZ);
    expect(view).toMatchObject({
      title: 'About Salma Ahmed',
      name: 'Salma Ahmed',
      email: 'salma@example.com',
      lines: ['From the Layla Embroidered Abaya page'],
      customerUrl: null,
      empty: false,
    });
    expect(view.order).toEqual({
      title: 'Order #1042',
      stage: 'Out for delivery with Bosta',
      tone: 'attention',
      total: 'EGP 4,700, cash on delivery',
      items: ['Layla Embroidered Abaya', 'Silk Scarf × 2'],
      trackingUrl: 'https://bosta.co/track/123',
      shopifyUrl: 'https://admin.shopify.com/store/maison-noor/orders?query=%231042',
    });
  });

  it('shows the cart and earlier conversations with their outcome and date', () => {
    const view = buildInboxCustomerView(facts(), en, 'en', TZ);
    expect(view.cart).toEqual({ items: [{ title: 'Zahra Occasion Abaya, M', price: 'EGP 3,900' }], total: 'Total EGP 3,900' });
    expect(view.past).toEqual([{ id: 'c0', date: '21 October', status: 'Resolved', preview: 'Can I exchange the Riyadh abaya?' }]);
  });

  it('trusts a signed-in shopper’s identity, with a link to the customer in Shopify', () => {
    const view = buildInboxCustomerView(
      facts({ identity: { name: 'Salma A.', email: 'salma.a@example.com', customerId: '7012345678', verified: true } }),
      en,
      'en',
      TZ,
    );
    expect(view).toMatchObject({ name: 'Salma A.', email: 'salma.a@example.com', customerUrl: 'https://admin.shopify.com/store/maison-noor/customers/7012345678' });
    expect(view.lines[0]).toBe('Signed in to the store');
  });

  it('says when the email is one the shopper typed, and links nothing outside Shopify stores', () => {
    const view = buildInboxCustomerView(facts({ email: null, contactEmail: 'salma@example.com', shopDomain: null }), en, 'en', TZ);
    expect(view.lines).toEqual(['Gave this email in the chat', 'From the Layla Embroidered Abaya page']);
    expect(view.order?.shopifyUrl).toBeNull();
    expect(view.customerUrl).toBeNull();
  });

  it('shows a paid order’s total, a delivered order as done, and no total when amounts may not be shown', () => {
    expect(buildInboxCustomerView(facts({ order: { ...ORDER, cashDue: false, stage: 'delivered' } }), en, 'en', TZ).order).toMatchObject({
      stage: 'Delivered',
      tone: 'ok',
      total: 'EGP 4,700, paid',
    });
    const { totalMinor: _t, amountDueMinor: _a, currency: _c, ...hidden } = ORDER;
    expect(buildInboxCustomerView(facts({ order: hidden }), en, 'en', TZ).order?.total).toBeNull();
  });

  it('is plain about knowing nothing yet', () => {
    const view = buildInboxCustomerView(
      facts({ name: null, email: null, lastPageUrl: null, order: null, cart: null, past: [] }),
      en,
      'en',
      TZ,
    );
    expect(view).toMatchObject({ title: 'About this shopper', name: null, order: null, cart: null, past: [], empty: true });
  });

  it('speaks Arabic in Arabic, with Western digits', () => {
    const view = buildInboxCustomerView(facts({ name: 'سلمى أحمد' }), ar, 'ar', TZ);
    expect(view.title).toBe('عن سلمى أحمد');
    expect(view.lines).toEqual(['من صفحة Layla Embroidered Abaya']);
    expect(view.order).toMatchObject({ title: 'الطلب #1042', stage: 'خرج للتوصيل مع Bosta' });
    expect(view.order?.total).toMatch(/الدفع عند الاستلام$/);
    expect(view.past[0]).toMatchObject({ status: 'تم الحل', date: '21 أكتوبر' });
    expect(JSON.stringify(view)).not.toMatch(/[٠-٩]/);
  });
});

describe('pageFrom', () => {
  it('reads a product, the home page, or the path', () => {
    expect(pageFrom('https://maison.example/products/riyadh-open-abaya')).toEqual({ kind: 'product', name: 'Riyadh Open Abaya' });
    expect(pageFrom('https://maison.example/ar/products/%D8%B9%D8%A8%D8%A7%D9%8A%D8%A9')).toEqual({ kind: 'product', name: 'عباية' });
    expect(pageFrom('https://maison.example/')).toEqual({ kind: 'home' });
    expect(pageFrom('https://maison.example/ar')).toEqual({ kind: 'home' });
    expect(pageFrom('https://maison.example/pages/contact')).toEqual({ kind: 'path', path: '/pages/contact' });
    expect(pageFrom(null)).toBeNull();
  });
});
