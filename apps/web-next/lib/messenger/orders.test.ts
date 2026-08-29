// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getShopToken = vi.hoisted(() => vi.fn());
const adminGraphql = vi.hoisted(() => vi.fn());

vi.mock('@/lib/shopify/tokens', () => ({
  getShopToken,
  hasOrderScope: (scopes: string) => scopes.split(',').map((s) => s.trim()).includes('read_orders'),
}));

vi.mock('@/lib/shopify/admin', () => ({
  adminGraphql,
  ShopifyAdminError: class ShopifyAdminError extends Error {
    constructor(
      message: string,
      readonly status: number,
    ) {
      super(message);
    }
  },
}));

import { lookupOrder, mapPaymentState, toOrderFacts } from './orders';

const ORDER = {
  name: '#1234',
  processedAt: '2026-08-01T10:00:00Z',
  email: 'Shopper@Example.com',
  displayFulfillmentStatus: 'FULFILLED',
  displayFinancialStatus: 'PAID',
  lineItems: { nodes: [{ title: 'Black tee', quantity: 2 }] },
  fulfillments: [{ trackingInfo: [{ company: 'DHL', number: 'TRK1', url: 'https://track/1' }] }],
  shippingAddress: { city: 'Cairo', country: 'Egypt', address1: '12 Secret Street', phone: '+20100' },
};

beforeEach(() => {
  vi.clearAllMocks();
  getShopToken.mockResolvedValue({ accessToken: 'tok', scopes: 'read_products,read_orders' });
});

describe('mapPaymentState', () => {
  it('collapses Shopify statuses into four a support bot can explain', () => {
    expect(mapPaymentState('PAID')).toBe('paid');
    expect(mapPaymentState('PARTIALLY_PAID')).toBe('paid');
    expect(mapPaymentState('REFUNDED')).toBe('refunded');
    expect(mapPaymentState('PARTIALLY_REFUNDED')).toBe('refunded');
    expect(mapPaymentState('PENDING')).toBe('pending');
    expect(mapPaymentState('AUTHORIZED')).toBe('pending');
    expect(mapPaymentState('EXPIRED')).toBe('unknown');
    expect(mapPaymentState(undefined)).toBe('unknown');
  });
});

describe('toOrderFacts', () => {
  it('exposes only the whitelisted fields', () => {
    const facts = toOrderFacts(ORDER);
    expect(Object.keys(facts).sort()).toEqual([
      'destination',
      'fulfillment_status',
      'line_items',
      'order_date',
      'order_number',
      'payment_state',
      'tracking',
    ]);
    // The shopper's street address, phone and email were on the raw order
    // and must not survive into anything a completion sees.
    const serialized = JSON.stringify(facts);
    expect(serialized).not.toContain('Secret Street');
    expect(serialized).not.toContain('+20100');
    expect(serialized).not.toContain('Example.com');
  });

  it('normalises the pieces a model would otherwise misread', () => {
    const facts = toOrderFacts(ORDER);
    expect(facts.order_number).toBe('1234');
    expect(facts.order_date).toBe('2026-08-01');
    expect(facts.fulfillment_status).toBe('fulfilled');
    expect(facts.tracking).toEqual({ company: 'DHL', number: 'TRK1', url: 'https://track/1' });
    expect(facts.destination).toEqual({ city: 'Cairo', country: 'Egypt' });
  });
});

describe('lookupOrder — anonymous shopper', () => {
  const anonymous = { shopDomain: 'demo.myshopify.com', verifiedCustomerId: null };

  it('needs both an order number and an email', async () => {
    expect(await lookupOrder({ ...anonymous, orderNumber: '1234', email: null })).toEqual({
      ok: false,
      reason: 'missing_proof',
    });
    expect(await lookupOrder({ ...anonymous, orderNumber: null, email: 'a@b.com' })).toEqual({
      ok: false,
      reason: 'missing_proof',
    });
    expect(adminGraphql).not.toHaveBeenCalled();
  });

  it('returns the order when the email matches, ignoring case and spacing', async () => {
    adminGraphql.mockResolvedValue({ orders: { nodes: [ORDER] } });
    const result = await lookupOrder({ ...anonymous, orderNumber: '1234', email: '  SHOPPER@example.com ' });
    expect(result.ok).toBe(true);
  });

  it('refuses when the email does not match the order', async () => {
    adminGraphql.mockResolvedValue({ orders: { nodes: [ORDER] } });
    expect(await lookupOrder({ ...anonymous, orderNumber: '1234', email: 'someone@else.com' })).toEqual({
      ok: false,
      reason: 'email_mismatch',
    });
  });

  it('refuses an order that carries no email at all', async () => {
    // Otherwise an order placed without an address would answer to anyone
    // who guessed its number.
    adminGraphql.mockResolvedValue({ orders: { nodes: [{ ...ORDER, email: null }] } });
    expect(await lookupOrder({ ...anonymous, orderNumber: '1234', email: 'a@b.com' })).toEqual({
      ok: false,
      reason: 'email_mismatch',
    });
  });

  it('reports not_found for an order this store does not have', async () => {
    adminGraphql.mockResolvedValue({ orders: { nodes: [] } });
    expect(await lookupOrder({ ...anonymous, orderNumber: '9999', email: 'a@b.com' })).toEqual({
      ok: false,
      reason: 'not_found',
    });
  });
});

describe('lookupOrder — verified shopper', () => {
  it('scopes the query to the customer the server verified', async () => {
    adminGraphql.mockResolvedValue({ customer: { orders: { nodes: [ORDER] } } });
    const result = await lookupOrder({
      shopDomain: 'demo.myshopify.com',
      verifiedCustomerId: '777',
      orderNumber: null,
      email: null,
    });
    expect(result.ok).toBe(true);
    // The customer id is in the query variables, so the API itself cannot
    // return an order belonging to anyone else.
    expect(adminGraphql.mock.calls[0][0].variables.id).toBe('gid://shopify/Customer/777');
  });

  it('still scopes to the customer when they name an order number', async () => {
    adminGraphql.mockResolvedValue({ customer: { orders: { nodes: [] } } });
    await lookupOrder({
      shopDomain: 'demo.myshopify.com',
      verifiedCustomerId: '777',
      orderNumber: '4321',
      email: null,
    });
    const call = adminGraphql.mock.calls[0][0];
    expect(call.variables.id).toBe('gid://shopify/Customer/777');
    expect(call.variables.query).toBe('name:#4321');
  });
});

describe('lookupOrder — access', () => {
  it('refuses when the store never authorized the app', async () => {
    getShopToken.mockResolvedValue(null);
    expect(
      await lookupOrder({ shopDomain: 'demo.myshopify.com', verifiedCustomerId: '1', orderNumber: null, email: null }),
    ).toEqual({ ok: false, reason: 'not_configured' });
    expect(adminGraphql).not.toHaveBeenCalled();
  });

  it('refuses a token issued before the read_orders scope existed', async () => {
    getShopToken.mockResolvedValue({ accessToken: 'tok', scopes: 'read_products,write_app_proxy' });
    expect(
      await lookupOrder({ shopDomain: 'demo.myshopify.com', verifiedCustomerId: '1', orderNumber: null, email: null }),
    ).toEqual({ ok: false, reason: 'no_scope' });
    expect(adminGraphql).not.toHaveBeenCalled();
  });

  it('turns a provider failure into a clean denial, never a throw', async () => {
    adminGraphql.mockRejectedValue(new Error('boom'));
    expect(
      await lookupOrder({ shopDomain: 'demo.myshopify.com', verifiedCustomerId: '1', orderNumber: null, email: null }),
    ).toEqual({ ok: false, reason: 'provider_error' });
  });
});
