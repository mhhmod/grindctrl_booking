// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  callWooPlugin: vi.fn(),
  requireRateLimit: vi.fn(),
  lookupOrder: vi.fn(),
  lookupGuestOrderCard: vi.fn(),
  loadActiveWooConnection: vi.fn(),
}));

vi.mock('@/lib/woo/plugin-client', () => ({
  callWooPlugin: mocks.callWooPlugin,
  WOO_PLUGIN_ORDER_LOOKUP_PATH: '/wp-json/grindctrl/v1/order-lookup',
}));
vi.mock('@/lib/request-rate-limit', () => ({ requireRateLimit: mocks.requireRateLimit }));
vi.mock('./order-limits', () => ({ wooSiteOrderLimiter: {} }));
vi.mock('./orders', () => ({ lookupOrder: mocks.lookupOrder, lookupGuestOrderCard: mocks.lookupGuestOrderCard }));
vi.mock('@/lib/woo/active-connection', () => ({ loadActiveWooConnection: mocks.loadActiveWooConnection }));

import { orderProviderFor, resolveOrderProvider, ShopifyOrderProvider, WooOrderProvider } from './order-provider';

const SITE = '123e4567-e89b-12d3-a456-426614174000';
const connection = { siteId: SITE, homeUrl: 'https://shop.example.com/', secretVersion: 1, pluginVersion: '0.3.0' };
const wooOrder = {
  id: 1027,
  number: '1027',
  status: 'processing',
  createdAt: '2026-10-30T09:15:00Z',
  paid: true,
  total: '4700.00',
  currency: 'EGP',
  paymentMethod: 'bacs',
  items: [{ name: 'Layla Embroidered Abaya', quantity: 1 }],
  shippingMethod: null,
  tracking: null,
  destination: { city: 'Cairo', country: 'EG' },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireRateLimit.mockResolvedValue(undefined);
});

describe('orderProviderFor', () => {
  it('picks Shopify for a myshopify domain, whatever else is paired', () => {
    expect(orderProviderFor({ domain: 'maison.myshopify.com' }, connection)).toBeInstanceOf(ShopifyOrderProvider);
  });

  it('picks WooCommerce for a paired site on plugin 0.3.0 or later', () => {
    expect(orderProviderFor({ domain: 'shop.example.com' }, connection)).toBeInstanceOf(WooOrderProvider);
    expect(orderProviderFor({ domain: null }, { ...connection, pluginVersion: '0.10.1' })).toBeInstanceOf(WooOrderProvider);
  });

  it('gives no provider to an older plugin, an unpaired site or a plain domain', () => {
    expect(orderProviderFor({ domain: 'shop.example.com' }, { ...connection, pluginVersion: '0.2.0' })).toBeNull();
    expect(orderProviderFor({ domain: 'shop.example.com' }, null)).toBeNull();
    expect(orderProviderFor({ domain: 'maisonnoor.com' }, null)).toBeNull();
  });

  it('does not read the registry for Shopify, and fails closed when it cannot be read', async () => {
    expect(await resolveOrderProvider({ id: SITE, domain: 'maison.myshopify.com' })).toBeInstanceOf(ShopifyOrderProvider);
    expect(mocks.loadActiveWooConnection).not.toHaveBeenCalled();
    mocks.loadActiveWooConnection.mockRejectedValueOnce(new Error('db down'));
    expect(await resolveOrderProvider({ id: SITE, domain: 'shop.example.com' })).toBeNull();
  });
});

describe('ShopifyOrderProvider', () => {
  it('passes the same arguments the lookup took before the seam', async () => {
    mocks.lookupOrder.mockResolvedValue({ ok: false, reason: 'not_found' });
    const provider = new ShopifyOrderProvider('maison.myshopify.com');
    await provider.lookupForCustomer({ customerId: '77', orderNumber: '1042', appClientId: 'app' });
    await provider.lookupByEmailAndNumber({ orderNumber: '1042', email: 'a@b.co' });
    expect(mocks.lookupOrder).toHaveBeenNthCalledWith(1, {
      shopDomain: 'maison.myshopify.com',
      appClientId: 'app',
      verifiedCustomerId: '77',
      orderNumber: '1042',
      email: null,
    });
    expect(mocks.lookupOrder).toHaveBeenNthCalledWith(2, {
      shopDomain: 'maison.myshopify.com',
      appClientId: undefined,
      verifiedCustomerId: null,
      orderNumber: '1042',
      email: 'a@b.co',
    });
  });
});

describe('WooOrderProvider', () => {
  const provider = new WooOrderProvider(connection);

  it('asks the plugin for a verified customer with the id, never the email', async () => {
    mocks.callWooPlugin.mockResolvedValue({ ok: true, json: { ok: true, orders: [wooOrder] } });
    const outcome = await provider.lookupForCustomer({ customerId: '42', orderNumber: null });
    expect(mocks.callWooPlugin).toHaveBeenCalledWith(connection, '/wp-json/grindctrl/v1/order-lookup', { mode: 'customer', wpUserId: 42, limit: 1 });
    expect(outcome).toMatchObject({ ok: true, facts: { order_number: '1027', payment_state: 'paid' } });
  });

  it('refuses a customer id that is not a WordPress user id without calling the plugin', async () => {
    expect(await provider.lookupForCustomer({ customerId: '0', orderNumber: null })).toEqual({ ok: false, reason: 'missing_proof' });
    expect(await provider.lookupForCustomer({ customerId: '4 OR 1=1', orderNumber: null })).toEqual({ ok: false, reason: 'missing_proof' });
    expect(mocks.callWooPlugin).not.toHaveBeenCalled();
  });

  it('answers a wrong email exactly like a missing order', async () => {
    mocks.callWooPlugin.mockResolvedValue({ ok: true, json: { ok: true, orders: [] } });
    const wrongEmail = await provider.lookupGuestCard({ orderNumber: '1027', email: 'wrong@example.com', withAmounts: false });
    const missingOrder = await provider.lookupGuestCard({ orderNumber: '999999', email: 'a@example.com', withAmounts: false });
    expect(wrongEmail).toEqual({ ok: false, reason: 'not_found' });
    expect(missingOrder).toEqual(wrongEmail);
    expect(mocks.callWooPlugin.mock.calls[0][2]).toEqual({ mode: 'guest', email: 'wrong@example.com', orderNumber: '1027' });
  });

  it('refuses a plugin answer for a different order number than asked', async () => {
    mocks.callWooPlugin.mockResolvedValue({ ok: true, json: { ok: true, orders: [wooOrder] } });
    expect(await provider.lookupGuestCard({ orderNumber: '1028', email: 'a@example.com', withAmounts: false })).toEqual({ ok: false, reason: 'not_found' });
    expect(await provider.lookupByEmailAndNumber({ orderNumber: '1028', email: 'a@example.com' })).toEqual({ ok: false, reason: 'not_found' });
  });

  it('needs both proofs for a guest', async () => {
    expect(await provider.lookupByEmailAndNumber({ orderNumber: '1027', email: null })).toEqual({ ok: false, reason: 'missing_proof' });
    expect(mocks.callWooPlugin).not.toHaveBeenCalled();
  });

  it.each([
    ['transport failure', { ok: false, reason: 'unavailable' }],
    ['plugin rejecting our signature', { ok: false, reason: 'rejected' }],
    ['a response outside the schema', { ok: true, json: { ok: true, orders: [{ ...wooOrder, total: 'free' }] } }],
    ['an html page', { ok: true, json: 'nope' }],
  ])('reports %s as unavailable, never as an order', async (_name, result) => {
    mocks.callWooPlugin.mockResolvedValue(result);
    expect(await provider.lookupGuestCard({ orderNumber: '1027', email: 'a@example.com', withAmounts: false })).toEqual({ ok: false, reason: 'provider_error' });
  });

  it('does not call the plugin when the per-site limit is spent or cannot be enforced', async () => {
    mocks.requireRateLimit.mockRejectedValue(new Error('limited'));
    expect(await provider.lookupGuestCard({ orderNumber: '1027', email: 'a@example.com', withAmounts: false })).toEqual({ ok: false, reason: 'provider_error' });
    expect(mocks.callWooPlugin).not.toHaveBeenCalled();
  });

  it('builds wp-admin links from the paired home URL', () => {
    expect(provider.adminOrderUrl({ name: '#1027', ref: '1027' })).toBe('https://shop.example.com/wp-admin/post.php?post=1027&action=edit');
    expect(provider.adminCustomerUrl('42')).toBe('https://shop.example.com/wp-admin/user-edit.php?user_id=42');
  });
});
