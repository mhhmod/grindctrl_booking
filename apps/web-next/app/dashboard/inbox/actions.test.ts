// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  facts: vi.fn(),
  rate: vi.fn(),
}));
vi.mock('@clerk/nextjs/server', () => ({ auth: mocks.auth }));
vi.mock('@/lib/auth/locale', () => ({ getRequestLocale: vi.fn(async () => 'en') }));
vi.mock('@/lib/dashboard/active-store-server', () => ({
  getActiveStore: vi.fn(async () => ({ shopDomain: 'maison.myshopify.com', siteId: 's1' })),
  getActiveStoreTimeZone: vi.fn(async () => 'Africa/Cairo'),
}));
vi.mock('@/lib/dashboard/inbox-customer-data', () => ({ getInboxCustomerFacts: mocks.facts }));
vi.mock('@/lib/request-rate-limit', () => ({ requireMerchantRateLimit: mocks.rate }));

import { fetchInboxCustomer } from './actions';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ userId: 'user_1' });
  mocks.rate.mockResolvedValue(undefined);
  mocks.facts.mockResolvedValue({
    name: 'Salma Ahmed',
    email: null,
    identity: null,
    contactEmail: null,
    lastPageUrl: null,
    order: null,
    cart: null,
    past: [],
    shopDomain: null,
  });
});

describe('fetchInboxCustomer', () => {
  it('reads the facts for the signed-in person and builds the view', async () => {
    const result = await fetchInboxCustomer('s1', 'c1');
    expect(mocks.rate).toHaveBeenCalledWith('account:user_1', 'read');
    expect(mocks.facts).toHaveBeenCalledWith({ userId: 'user_1', siteId: 's1', conversationId: 'c1' });
    expect(result).toMatchObject({ ok: true, view: { title: 'About Salma Ahmed' } });
  });

  it('answers not ok when signed out or when the read fails', async () => {
    mocks.auth.mockResolvedValue({ userId: null });
    expect(await fetchInboxCustomer('s1', 'c1')).toEqual({ ok: false });
    mocks.auth.mockResolvedValue({ userId: 'user_1' });
    mocks.facts.mockRejectedValue(new Error('Unauthorized'));
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await fetchInboxCustomer('s1', 'c1')).toEqual({ ok: false });
    error.mockRestore();
  });
});
