// @vitest-environment node
import { createHmac } from 'node:crypto';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { recordEvent, processPrivacy, verifyUninstall, reconcilePricing, markPricingEvent } = vi.hoisted(() => ({
  recordEvent: vi.fn(), processPrivacy: vi.fn(), verifyUninstall: vi.fn(), reconcilePricing: vi.fn(), markPricingEvent: vi.fn(),
}));
vi.mock('@/lib/shopify/tokens', () => ({ verifyShopifyUninstall: verifyUninstall }));
vi.mock('@/lib/shopify/installation-events', () => ({ recordInstallationEvent: recordEvent, markShopifyPricingEvent: markPricingEvent }));
vi.mock('@/lib/shopify/privacy', () => ({ processShopifyPrivacyRequest: processPrivacy }));
vi.mock('@/lib/shopify/app-pricing', () => ({ reconcileShopifyAppPricing: reconcilePricing }));

import { POST } from './route';

function request(topic: string, signature?: string) {
  const body = JSON.stringify({ id: 123, myshopify_domain: 'demo.myshopify.com', shop_domain: 'demo.myshopify.com' });
  return new NextRequest('https://app.example/api/shopify/webhooks', {
    method: 'POST', body,
    headers: {
      'x-shopify-topic': topic,
      'x-shopify-webhook-id': 'delivery-1',
      'x-shopify-shop-domain': 'demo.myshopify.com',
      'x-shopify-hmac-sha256': signature ?? createHmac('sha256', 'test-only-secret').update(body).digest('base64'),
    },
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('SHOPIFY_API_KEY', 'test-only-client-id');
  vi.stubEnv('SHOPIFY_API_SECRET', 'test-only-secret');
  recordEvent.mockResolvedValue({ id: 'event', status: 'manual_required' });
  verifyUninstall.mockResolvedValue(undefined);
  processPrivacy.mockResolvedValue(undefined);
  reconcilePricing.mockResolvedValue(undefined);
  markPricingEvent.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('Shopify lifecycle delivery', () => {
  it('rejects invalid signatures before recording or mutation', async () => {
    expect((await POST(request('app/uninstalled', 'invalid'))).status).toBe(401);
    expect(recordEvent).not.toHaveBeenCalled();
  });
  it('records verified app identity with the uninstall event', async () => {
    expect((await POST(request('app/uninstalled'))).status).toBe(200);
    expect(recordEvent).toHaveBeenCalledWith(expect.objectContaining({
      appClientId: 'test-only-client-id', shopDomain: 'demo.myshopify.com', topic: 'app/uninstalled', webhookId: 'delivery-1',
    }));
    expect(verifyUninstall).toHaveBeenCalledWith('demo.myshopify.com','test-only-client-id','event');
  });
  it('requests retry when atomic persistence fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    recordEvent.mockRejectedValueOnce(new Error('secret storage detail'));
    const response = await POST(request('app/uninstalled'));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('secret storage detail');
  });
  it('passes scopes events without globally reactivating a shop', async () => {
    expect((await POST(request('app/scopes_update'))).status).toBe(200);
    expect(recordEvent).toHaveBeenCalledWith(expect.objectContaining({ topic: 'app/scopes_update' }));
    expect(verifyUninstall).not.toHaveBeenCalled();
  });
  it('does not acknowledge authoritative verification failure as a completed uninstall', async () => {
    vi.spyOn(console,'error').mockImplementation(()=>{});
    verifyUninstall.mockRejectedValue(new Error('provider secret'));
    const response=await POST(request('app/uninstalled'));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('provider secret');
  });
  it('preserves the app that verified a second registration', async () => {
    vi.stubEnv('SHOPIFY_APPS', JSON.stringify([{ clientId: 'other-app', secret: 'other-secret' }]));
    const req = request('app/uninstalled');
    const body = await req.clone().text();
    req.headers.set('x-shopify-hmac-sha256', createHmac('sha256', 'other-secret').update(body).digest('base64'));
    expect((await POST(req)).status).toBe(200);
    expect(recordEvent).toHaveBeenCalledWith(expect.objectContaining({ appClientId: 'other-app' }));
  });
});

describe('public Shopify App Pricing deliveries', () => {
  function pricingRequest(options: { id?: string; triggeredAt?: string; status?: string; name?: string } = {}) {
    const body = JSON.stringify({ app_subscription: {
      name: options.name ?? 'Untrusted payload plan', status: options.status ?? 'ACTIVE',
    } });
    return new NextRequest('https://app.example/api/shopify/webhooks', {
      method: 'POST', body,
      headers: {
        'x-shopify-topic': 'app_subscriptions/update',
        'x-shopify-webhook-id': options.id ?? 'pricing-delivery',
        'x-shopify-shop-domain': 'demo.myshopify.com',
        'x-shopify-triggered-at': options.triggeredAt ?? '2026-11-02T12:00:00Z',
        'x-shopify-hmac-sha256': createHmac('sha256', 'public-secret').update(body).digest('base64'),
      },
    });
  }

  beforeEach(() => {
    vi.stubEnv('SHOPIFY_APPS', JSON.stringify([
      { clientId: 'public-app', secret: 'public-secret', distribution: 'public' },
      { clientId: 'custom-app', secret: 'custom-secret', distribution: 'custom' },
    ]));
  });

  it('reconciles using only the authenticated app and shop, never body plan/status', async () => {
    expect((await POST(pricingRequest())).status).toBe(200);
    expect(recordEvent).toHaveBeenCalledWith(expect.objectContaining({
      appClientId: 'public-app', shopDomain: 'demo.myshopify.com', topic: 'app_subscriptions/update',
    }));
    expect(reconcilePricing).toHaveBeenCalledExactlyOnceWith({
      appClientId: 'public-app', shopDomain: 'demo.myshopify.com', source: 'webhook',
    });
    expect(markPricingEvent).toHaveBeenNthCalledWith(1, {
      appClientId: 'public-app', shopDomain: 'demo.myshopify.com', eventId: 'event',
    }, 'received');
    expect(markPricingEvent).toHaveBeenNthCalledWith(2, {
      appClientId: 'public-app', shopDomain: 'demo.myshopify.com', eventId: 'event',
    }, 'completed');
    expect(markPricingEvent.mock.invocationCallOrder[1]).toBeGreaterThan(reconcilePricing.mock.invocationCallOrder[0]);
  });

  it('reconciles replayed and out-of-order deliveries even when a receipt was completed', async () => {
    recordEvent.mockResolvedValue({ id: 'event', status: 'completed', duplicate: true });
    expect((await POST(pricingRequest())).status).toBe(200);
    expect((await POST(pricingRequest())).status).toBe(200);
    expect((await POST(pricingRequest({
      id: 'older-delivery', triggeredAt: '2026-11-01T12:00:00Z', status: 'CANCELLED', name: 'Free',
    }))).status).toBe(200);
    expect(reconcilePricing).toHaveBeenCalledTimes(3);
    for (const [input] of reconcilePricing.mock.calls) {
      expect(input).toEqual({ appClientId: 'public-app', shopDomain: 'demo.myshopify.com', source: 'webhook' });
    }
  });

  it.each(['installation_token_missing', 'authoritative_read_failed'])('requests retry for %s without applying body state', async message => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    reconcilePricing.mockRejectedValueOnce(new Error(message));
    const response = await POST(pricingRequest());
    expect(response.status).toBe(503);
    expect(response.headers.get('retry-after')).toBe('60');
    expect(await response.text()).not.toContain(message);
    expect(markPricingEvent).not.toHaveBeenCalledWith(expect.anything(), 'completed');
    expect((await POST(pricingRequest())).status).toBe(200);
    expect(reconcilePricing).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['custom-app', 'custom-secret'],
    ['test-only-client-id', 'test-only-secret'],
  ])('ignores pricing for non-public registration %s', async (clientId, secret) => {
    const req = pricingRequest();
    const body = await req.clone().text();
    req.headers.set('x-shopify-hmac-sha256', createHmac('sha256', secret).update(body).digest('base64'));
    expect((await POST(req)).status).toBe(200);
    expect(recordEvent).toHaveBeenCalledWith(expect.objectContaining({ appClientId: clientId }));
    expect(reconcilePricing).not.toHaveBeenCalled();
    expect(markPricingEvent).not.toHaveBeenCalled();
  });

  it('rejects an invalid signature before pricing reconciliation', async () => {
    const req = pricingRequest();
    req.headers.set('x-shopify-hmac-sha256', 'invalid');
    expect((await POST(req)).status).toBe(401);
    expect(reconcilePricing).not.toHaveBeenCalled();
  });

  it('does not reconcile when the durable event cannot be recorded', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    recordEvent.mockRejectedValue(new Error('storage unavailable'));
    expect((await POST(pricingRequest())).status).toBe(503);
    expect(reconcilePricing).not.toHaveBeenCalled();
  });
});

describe('durable mandatory privacy processing', () => {
  it.each(['customers/data_request', 'customers/redact', 'shop/redact'])(
    'records and acknowledges %s through the privacy processor', async (topic) => {
      expect((await POST(request(topic))).status).toBe(200);
      expect(processPrivacy).toHaveBeenCalledWith({
        appClientId: 'test-only-client-id', triggeredAt: null, webhookId: 'delivery-1', topic, shopDomain: 'demo.myshopify.com',
        payload: { id: 123, myshopify_domain: 'demo.myshopify.com', shop_domain: 'demo.myshopify.com' },
      });



    },
  );

  it('still rejects unauthenticated privacy requests without processing or logging their payload', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await POST(request('shop/redact', 'invalid'))).status).toBe(401);
    expect(processPrivacy).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });

  it('asks Shopify to retry only when durable recording is unavailable', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    processPrivacy.mockRejectedValue(new Error('database unavailable'));
    const response = await POST(request('shop/redact'));
    expect(response.status).toBe(503);
    expect(response.headers.get('retry-after')).toBe('60');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.text()).not.toContain('database unavailable');
  });

  it.each(['x-shopify-webhook-id', 'x-shopify-shop-domain'])(
    'rejects a missing %s before recording', async (header) => {
      const req = request('shop/redact');
      req.headers.delete(header);
      expect((await POST(req)).status).toBe(400);
      expect(processPrivacy).not.toHaveBeenCalled();
    },
  );

  it('rejects malformed signed JSON before recording', async () => {
    const body = '{invalid json';
    const req = request('shop/redact');
    req.headers.set('x-shopify-hmac-sha256', createHmac('sha256', 'test-only-secret').update(body).digest('base64'));
    const response = await POST(new NextRequest(req.url, { method: 'POST', headers: req.headers, body }));
    expect(response.status).toBe(400);
    expect(processPrivacy).not.toHaveBeenCalled();
  });

  it.each(['null', '[]', '"text"'])('rejects a signed non-object payload (%s)', async (body) => {
    const req = request('shop/redact');
    req.headers.set('x-shopify-hmac-sha256', createHmac('sha256', 'test-only-secret').update(body).digest('base64'));
    const response = await POST(new NextRequest(req.url, { method: 'POST', headers: req.headers, body }));
    expect(response.status).toBe(400);
    expect(processPrivacy).not.toHaveBeenCalled();
  });

  it('keeps the delivery ID from the header even when the payload contains a different ID', async () => {
    const req = request('customers/data_request');
    req.headers.set('x-shopify-webhook-id', 'delivery-from-header');
    expect((await POST(req)).status).toBe(200);
    expect(processPrivacy).toHaveBeenCalledWith(expect.objectContaining({ webhookId: 'delivery-from-header' }));
  });
});
