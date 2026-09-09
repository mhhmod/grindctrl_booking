// @vitest-environment node
import { createHmac } from 'node:crypto';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { markUninstalled, recordSeen, deleteToken, processPrivacy } = vi.hoisted(() => ({
  markUninstalled: vi.fn(), recordSeen: vi.fn(), deleteToken: vi.fn(), processPrivacy: vi.fn(),
}));
vi.mock('@/lib/shopify/shops', () => ({
  markTryOnShopUninstalled: markUninstalled,
  recordTryOnShopSeen: recordSeen,
}));
vi.mock('@/lib/shopify/tokens', () => ({ deleteShopToken: deleteToken }));

vi.mock('@/lib/shopify/privacy', () => ({ processShopifyPrivacyRequest: processPrivacy }));

import { POST } from './route';

function request(topic: string, signature?: string) {
  const body = JSON.stringify({ id: 123, domain: 'demo.myshopify.com' });
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
  vi.stubEnv('SHOPIFY_API_SECRET', 'test-only-secret');
  markUninstalled.mockResolvedValue(true);
  recordSeen.mockResolvedValue(true);
  deleteToken.mockResolvedValue(true);
  processPrivacy.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('Shopify lifecycle delivery', () => {
  it('rejects invalid signatures before any lifecycle or token mutation', async () => {
    const response = await POST(request('app/uninstalled', 'invalid'));
    expect(response.status).toBe(401);
    expect(markUninstalled).not.toHaveBeenCalled();
    expect(deleteToken).not.toHaveBeenCalled();
  });

  it('acknowledges uninstall only when both scoped operations succeeded', async () => {
    expect((await POST(request('app/uninstalled'))).status).toBe(200);
    expect(markUninstalled).toHaveBeenCalledWith('demo.myshopify.com');
    expect(deleteToken).toHaveBeenCalledWith('demo.myshopify.com');
  });

  it('allows retry after failed token cleanup and acknowledges its successful retry', async () => {
    deleteToken.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    expect((await POST(request('app/uninstalled'))).status).toBe(500);
    expect((await POST(request('app/uninstalled'))).status).toBe(200);
    expect(deleteToken).toHaveBeenCalledTimes(2);
  });

  it('still cleans up the token when lifecycle persistence failed, without acknowledging success', async () => {
    markUninstalled.mockResolvedValue(false);
    expect((await POST(request('app/uninstalled'))).status).toBe(500);
    expect(deleteToken).toHaveBeenCalled();
  });

  it('records scope lifecycle without deleting credentials', async () => {
    expect((await POST(request('app/scopes_update'))).status).toBe(200);
    expect(recordSeen).toHaveBeenCalledWith('demo.myshopify.com');
    expect(deleteToken).not.toHaveBeenCalled();
  });
});

describe('durable mandatory privacy processing', () => {
  it.each(['customers/data_request', 'customers/redact', 'shop/redact'])(
    'records and acknowledges %s through the privacy processor', async (topic) => {
      expect((await POST(request(topic))).status).toBe(200);
      expect(processPrivacy).toHaveBeenCalledWith({
        webhookId: 'delivery-1', topic, shopDomain: 'demo.myshopify.com',
        payload: { id: 123, domain: 'demo.myshopify.com' },
      });
      expect(deleteToken).not.toHaveBeenCalled();
      expect(markUninstalled).not.toHaveBeenCalled();
      expect(recordSeen).not.toHaveBeenCalled();
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
