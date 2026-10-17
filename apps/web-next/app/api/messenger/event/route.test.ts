// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  loadSiteByDomain: vi.fn(),
  originAllowed: vi.fn(),
  recordEvent: vi.fn(),
}));

vi.mock('@/lib/ratelimit', () => ({
  publicApiRatelimit: { limit: async () => ({ success: true, reset: Date.now() + 10_000 }) },
  clientIp: () => 'test-ip',
}));
vi.mock('@/lib/messenger/public-api', () => ({
  loadPublicSite: vi.fn(),
  loadPublicSiteByDomain: mocks.loadSiteByDomain,
  originAllowed: mocks.originAllowed,
  provenOrigin: (_key: string, input: { headerOrigin: string | null }) => ({ origin: input.headerOrigin, trusted: true }),
}));
vi.mock('@/lib/messenger/conversations', () => ({ recordEvent: mocks.recordEvent }));

import { POST } from './route';
import { configFailurePayload } from '@/lib/messenger/config-failure';

const SHOP = 'maison-noor.myshopify.com';

function post(name: string, origin: string, payload: unknown = {}) {
  return new NextRequest('https://grindctrl.cloud/api/messenger/event', {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify({ shop: SHOP, origin, name, payload }),
  });
}

/* Phase zero item 5: a store on an unverified custom domain failed silently,
   because the failure event itself came from the refused origin. */
describe('POST /api/messenger/event config failures', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.loadSiteByDomain.mockResolvedValue({ id: 'site-1' });
    mocks.recordEvent.mockResolvedValue(undefined);
  });

  it('keeps a config failure from a refused origin, with the reason and host', async () => {
    mocks.originAllowed.mockReturnValue(false);
    const response = await POST(post('config_fetch_failed', 'https://maisonnoor.com', { status: 0, host: 'spoofed.example' }));

    expect(response.status).toBe(200);
    expect(mocks.recordEvent).toHaveBeenCalledWith({
      siteId: 'site-1',
      conversationId: null,
      eventName: 'config_fetch_failed',
      payload: { reason: 'origin_not_allowed', host: 'maisonnoor.com', status: 0 },
    });
  });

  it('still refuses every other event from a refused origin', async () => {
    mocks.originAllowed.mockReturnValue(false);
    const response = await POST(post('loader_initialized', 'https://maisonnoor.com'));

    expect(response.status).toBe(403);
    expect(mocks.recordEvent).not.toHaveBeenCalled();
  });

  it('records an allowed origin’s failure with the status the loader saw', async () => {
    mocks.originAllowed.mockReturnValue(true);
    await POST(post('config_fetch_failed', 'https://maison-noor.myshopify.com', { status: 503 }));

    expect(mocks.recordEvent.mock.calls[0][0].payload).toEqual({
      reason: 'http_error', host: 'maison-noor.myshopify.com', status: 503,
    });
  });
});

describe('configFailurePayload', () => {
  it('accepts only a real HTTP status and never a host from the payload', () => {
    expect(configFailurePayload({ status: 'x' }, 'https://a.com', true)).toEqual({ reason: 'unreachable', host: 'a.com', status: 0 });
    expect(configFailurePayload({ status: 99999 }, 'https://a.com', true).status).toBe(0);
    expect(configFailurePayload(null, null, false)).toEqual({ reason: 'origin_not_allowed', host: null, status: 0 });
    expect(configFailurePayload({ status: 404 }, 'not a url', true)).toEqual({ reason: 'http_error', host: null, status: 404 });
  });
});

/* Phase zero item 9: each event carries the visitor's holdout arm, and
   nothing else from the browser. */
describe('POST /api/messenger/event holdout arm', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.loadSiteByDomain.mockResolvedValue({ id: 'site-1' });
    mocks.recordEvent.mockResolvedValue(undefined);
    mocks.originAllowed.mockReturnValue(true);
  });

  function postWith(extra: Record<string, unknown>) {
    return new NextRequest('https://grindctrl.cloud/api/messenger/event', {
      method: 'POST',
      headers: { origin: 'https://maisonnoor.com', 'content-type': 'application/json' },
      body: JSON.stringify({ shop: SHOP, origin: 'https://maisonnoor.com', name: 'messenger_opened', payload: { anything: 1 }, ...extra }),
    });
  }

  it('keeps a valid bucket', async () => {
    await POST(postWith({ bucket: 'off' }));
    expect(mocks.recordEvent.mock.calls[0][0].payload).toEqual({ bucket: 'off' });
  });

  it('keeps nothing else', async () => {
    await POST(postWith({ bucket: 'sideways' }));
    expect(mocks.recordEvent.mock.calls[0][0].payload).toEqual({});
  });
});
