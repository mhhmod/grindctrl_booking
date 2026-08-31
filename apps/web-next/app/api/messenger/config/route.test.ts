// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  loadPublicSite: vi.fn(),
  loadPublicSiteByDomain: vi.fn(),
  originAllowed: vi.fn(),
  toPublicPayload: vi.fn(),
  recordEvent: vi.fn(),
}));

vi.mock('@/lib/messenger/public-api', () => ({
  loadPublicSite: mocks.loadPublicSite,
  loadPublicSiteByDomain: mocks.loadPublicSiteByDomain,
  originAllowed: mocks.originAllowed,
  toPublicPayload: mocks.toPublicPayload,
}));

vi.mock('@/lib/messenger/conversations', () => ({
  recordEvent: mocks.recordEvent,
}));

import { GET } from './route';

const SITE = { id: 'site-1' };
const PAYLOAD = { v: 1, site: { id: 'site-1' } };

function req(url: string) {
  return new NextRequest(new Request(url));
}

describe('GET /api/messenger/config', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.originAllowed.mockReturnValue(true);
    mocks.toPublicPayload.mockReturnValue(PAYLOAD);
    mocks.recordEvent.mockResolvedValue(undefined);
  });

  it('loads config by Shopify domain when no key is provided', async () => {
    mocks.loadPublicSiteByDomain.mockResolvedValue(SITE);

    const response = await GET(
      req(
        'https://app.example.com/api/messenger/config?shop=grindctrl.myshopify.com&origin=https%3A%2F%2Fgrindctrl.myshopify.com',
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(PAYLOAD);
    expect(mocks.loadPublicSiteByDomain).toHaveBeenCalledWith('grindctrl.myshopify.com');
    expect(mocks.loadPublicSite).not.toHaveBeenCalled();
  });

  it('loads config by embed key when no shop is provided', async () => {
    mocks.loadPublicSite.mockResolvedValue(SITE);

    const response = await GET(
      req(
        'https://app.example.com/api/messenger/config?key=gc_test_key&origin=https%3A%2F%2Fstore.example.com',
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(PAYLOAD);
    expect(mocks.loadPublicSite).toHaveBeenCalledWith('gc_test_key');
    expect(mocks.loadPublicSiteByDomain).not.toHaveBeenCalled();
  });

  it('returns 400 when neither a valid key nor a shop is provided', async () => {
    const response = await GET(
      req('https://app.example.com/api/messenger/config?origin=https%3A%2F%2Fstore.example.com'),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: 'bad_key' });
    expect(mocks.loadPublicSite).not.toHaveBeenCalled();
    expect(mocks.loadPublicSiteByDomain).not.toHaveBeenCalled();
  });

  it('returns 400 without resolving an invalid Shopify domain', async () => {
    const response = await GET(
      req(
        'https://app.example.com/api/messenger/config?shop=not-a-real-domain&origin=https%3A%2F%2Fstore.example.com',
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: 'bad_shop' });
    expect(mocks.loadPublicSiteByDomain).not.toHaveBeenCalled();
    expect(mocks.loadPublicSite).not.toHaveBeenCalled();
  });

  it('returns 403 when the origin is not allowed for a key-resolved site', async () => {
    mocks.loadPublicSite.mockResolvedValue(SITE);
    mocks.originAllowed.mockReturnValue(false);

    const response = await GET(
      req(
        'https://app.example.com/api/messenger/config?key=gc_test_key&origin=https%3A%2F%2Fevil.example.com',
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ error: 'origin_not_allowed' });
    expect(mocks.originAllowed).toHaveBeenCalledWith(SITE, 'https://evil.example.com');
  });

  it('returns 403 when the origin is not allowed for a shop-resolved site', async () => {
    mocks.loadPublicSiteByDomain.mockResolvedValue(SITE);
    mocks.originAllowed.mockReturnValue(false);

    const response = await GET(
      req(
        'https://app.example.com/api/messenger/config?shop=grindctrl.myshopify.com&origin=https%3A%2F%2Fevil.example.com',
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ error: 'origin_not_allowed' });
    expect(mocks.originAllowed).toHaveBeenCalledWith(SITE, 'https://evil.example.com');
  });

  it('returns 404 when key resolution finds no site', async () => {
    mocks.loadPublicSite.mockResolvedValue(null);

    const response = await GET(
      req(
        'https://app.example.com/api/messenger/config?key=gc_test_key&origin=https%3A%2F%2Fstore.example.com',
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: 'not_found' });
  });

  it('returns 404 when shop resolution finds no site', async () => {
    mocks.loadPublicSiteByDomain.mockResolvedValue(null);

    const response = await GET(
      req(
        'https://app.example.com/api/messenger/config?shop=grindctrl.myshopify.com&origin=https%3A%2F%2Fstore.example.com',
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: 'not_found' });
  });
});
