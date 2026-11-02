// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const database = vi.hoisted(() => ({ from: vi.fn(), update: vi.fn(), eq: vi.fn(), select: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => database }));
import { markShopifyPricingEvent } from './installation-events';

const event = { appClientId: 'public-app', shopDomain: 'demo.myshopify.com', eventId: 'pricing-event' };

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('SHOPIFY_APPS', JSON.stringify([
    { clientId: 'public-app', secret: 'public-secret', distribution: 'public' },
    { clientId: 'custom-app', secret: 'custom-secret', distribution: 'custom' },
  ]));
  vi.stubEnv('SHOPIFY_API_KEY', '');
  vi.stubEnv('SHOPIFY_API_SECRET', '');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role');
  database.from.mockReturnValue(database);
  database.update.mockReturnValue(database);
  database.eq.mockReturnValue(database);
  database.select.mockResolvedValue({ data: [{ id: event.eventId }], error: null });
});
afterEach(() => vi.unstubAllEnvs());

describe('Shopify pricing receipt completion', () => {
  it('scopes successful completion to the exact verified event, app, shop and topic', async () => {
    await markShopifyPricingEvent(event, 'completed');
    expect(database.from).toHaveBeenCalledWith('shopify_installation_events');
    expect(database.eq.mock.calls).toEqual([
      ['id', 'pricing-event'], ['app_client_id', 'public-app'],
      ['shop_domain', 'demo.myshopify.com'], ['topic', 'app_subscriptions/update'],
    ]);
    expect(database.update).toHaveBeenCalledWith({
      status: 'completed', reason: 'authoritative_snapshot_reconciled', processed_at: expect.any(String),
    });
  });

  it('only changes the legacy ignored status to pending, preserving completed duplicate receipts', async () => {
    database.select.mockResolvedValue({ data: [], error: null });
    await expect(markShopifyPricingEvent(event, 'received')).resolves.toBeUndefined();
    expect(database.eq).toHaveBeenCalledWith('status', 'ignored');
    expect(database.update).toHaveBeenCalledWith({
      status: 'received', reason: 'authoritative_reconciliation_required', processed_at: null,
    });
  });

  it.each([
    { data: [], error: null },
    { data: null, error: { message: 'database detail' } },
  ])('fails closed when the matching receipt cannot be completed', async result => {
    database.select.mockResolvedValue(result);
    await expect(markShopifyPricingEvent(event, 'completed')).rejects.toThrow('pricing_event_not_recorded');
  });

  it('cannot update a custom installation receipt', async () => {
    await expect(markShopifyPricingEvent({ ...event, appClientId: 'custom-app' }, 'completed'))
      .rejects.toThrow('invalid_pricing_event');
    expect(database.from).not.toHaveBeenCalled();
  });
});
