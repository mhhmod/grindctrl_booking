// @vitest-environment node
import { createHmac } from 'node:crypto';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { recordEvent, processPrivacy } = vi.hoisted(() => ({ recordEvent: vi.fn(), processPrivacy: vi.fn() }));
vi.mock('@/lib/shopify/installation-events', () => ({ recordInstallationEvent: recordEvent }));
vi.mock('@/lib/shopify/privacy', () => ({ processShopifyPrivacyRequest: processPrivacy }));

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
  recordEvent.mockResolvedValue({ id: 'event', status: 'completed' });
  processPrivacy.mockResolvedValue(undefined);
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
