// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), fetch: vi.fn() }));
vi.mock('./store', () => ({ easyOrdersRpc: mocks.rpc }));
import { encryptToken } from '@/lib/shopify/token-crypto';
import { normalizeEgyptPhone, egyptPhoneMatches } from './phone';
import { easyOrderCard, easyOrderFacts, easyOrdersStatus, parseEasyOrder } from './orders';
import { EasyOrdersOrderProvider } from './order-provider';
import { connection, order } from './test-fixtures';
let generation = 0;
beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal('fetch', mocks.fetch);
  vi.stubEnv('SHOPIFY_TOKEN_ENC_KEY', Buffer.alloc(32, 7).toString('base64'));
  mocks.rpc.mockResolvedValue({ success: true, reset: Date.now() + 60000 });
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const provider = () => new EasyOrdersOrderProvider(connection({ api_key: encryptToken('key'), order_cache_version: ++generation }));
describe('Egypt phone proof', () => {
  it.each(['+201012345678', '00201012345678', '01012345678', '1012345678', '201012345678', '+20 10-1234-5678', '010 1234 5678', '(010) 1234-5678', '+20 (0)10 1234 5678'])('normalizes %s', (value) => {
    expect(normalizeEgyptPhone(value)).toBe('1012345678');
    expect(egyptPhoneMatches(value, order.phone)).toBe(true);
  });
  it.each(['+9711012345678', '009711012345678', '101234567', '101234567899', '', 'invalid', null, 'x01012345678', '+201012345678ext1'])('rejects %s', (value) => expect(normalizeEgyptPhone(value)).toBeNull());
  it('never matches two invalid phones', () => expect(egyptPhoneMatches('', '')).toBe(false));
});
describe('status mapping', () => {
  it.each([
    ['pending','preparing','pending'], ['confirmed','preparing','unknown'], ['pending_payment','preparing','pending'],
    ['paid','preparing','paid'], ['paid_failed','preparing','unknown'], ['processing','preparing','unknown'],
    ['waiting_for_pickup','preparing','unknown'], ['in_delivery','on_its_way','unknown'], ['delivered','delivered','unknown'],
    ['canceled','cancelled','unknown'], ['returning_from_delivery','preparing','unknown'], ['request_refund','preparing','unknown'],
    ['refund_in_progress','preparing','unknown'], ['refunded','cancelled','refunded'], ['unknown','preparing','unknown'], ['constructor','preparing','unknown'],
  ])('maps %s', (status, stage, payment) => {
    expect(easyOrdersStatus(status)).toMatchObject({ stage, payment, meaning: expect.any(String) });
  });
});
describe('EasyOrders guest lookup', () => {
  it('accepts phone and email proofs without disclosing personal data or tracking', async () => {
    mocks.fetch.mockResolvedValue(Response.json(order));
    const p = provider();
    const byPhone = await p.lookupGuestCard({ orderNumber: '1027', email: '', phone: '01012345678', withAmounts: true });
    expect(byPhone).toMatchObject({ ok: true, card: { stage: 'on_its_way', carrier: null, trackingUrl: null, cashDue: false } });
    expect(JSON.stringify(byPhone)).not.toMatch(/Private|Mona|1012345678|totalMinor/);
    expect(await p.lookupByEmailAndNumber({ orderNumber: '1027', email: ' mona@EXAMPLE.com ' })).toMatchObject({ ok: true, facts: { tracking: null, destination: null } });
    expect(mocks.fetch).toHaveBeenCalledTimes(1); // short cache shared by both proof paths
  });
  it('returns indistinguishable not-found for wrong phone, wrong email, absent order and wrong returned number', async () => {
    const denied = { ok: false, reason: 'not_found' };
    mocks.fetch.mockResolvedValueOnce(Response.json(order)).mockResolvedValueOnce(new Response('', { status: 404 }))
      .mockResolvedValueOnce(Response.json({ ...order, short_id: 9999 }));
    const p = provider();
    expect(await p.lookupByEmailAndNumber({ orderNumber: '1027', phone: '01111111111', email: null })).toEqual(denied);
    expect(await p.lookupByEmailAndNumber({ orderNumber: '1027', email: 'wrong@example.com' })).toEqual(denied);
    expect(await p.lookupByEmailAndNumber({ orderNumber: '9999', email: 'mona@example.com' })).toEqual(denied);
    expect(await p.lookupByEmailAndNumber({ orderNumber: '8888', email: 'mona@example.com' })).toEqual(denied);
  });
  it('invalidates every process cache through the persisted connection epoch', async () => {
    mocks.fetch.mockResolvedValue(Response.json(order));
    await provider().lookupByEmailAndNumber({ orderNumber: '1027', email: 'mona@example.com' });
    mocks.fetch.mockResolvedValue(Response.json({ ...order, status: 'delivered' }));
    expect(await provider().lookupGuestCard({ orderNumber: '1027', email: 'mona@example.com', withAmounts: false })).toMatchObject({ ok: true, card: { stage: 'delivered' } });
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
  });
  it('refuses fabricated verified customers and missing proof without API calls', async () => {
    const p = provider();
    expect(await p.lookupForCustomer()).toEqual({ ok: false, reason: 'missing_proof' });
    expect(await p.lookupCustomerCard()).toEqual({ ok: false, reason: 'missing_proof' });
    expect(await p.lookupByEmailAndNumber({ orderNumber: '1027', email: null })).toEqual({ ok: false, reason: 'not_found' });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it('fails closed on malformed payload and rate limit', async () => {
    mocks.fetch.mockResolvedValueOnce(Response.json({ data: { id: 1 } })).mockResolvedValueOnce(new Response('', { status: 429 }));
    for (let i = 0; i < 2; i++) expect(await provider().lookupByEmailAndNumber({ orderNumber: '1027', email: 'mona@example.com' })).toEqual({ ok: false, reason: 'provider_error' });
  });
  it('supports documented data envelopes, omits missing fields and never invents dates or currency', () => {
    const parsed = parseEasyOrder({ data: { id: 1, short_id: '42', cart_items: [{ name: 'x', quantity: -1 }] } })!;
    expect(easyOrderCard(parsed, true)).toMatchObject({ placedAt: '', timeline: [], items: [], trackingUrl: null });
    expect(easyOrderFacts(parsed).fulfillment_status).toBe('Order being prepared');
    expect(easyOrderCard(parsed, true)).not.toHaveProperty('currency');
  });
});
