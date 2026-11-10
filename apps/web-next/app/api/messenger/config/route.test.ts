// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  rateLimit: vi.fn(),
  loadPublicSite: vi.fn(),
  loadPublicSiteByDomain: vi.fn(),
  originAllowed: vi.fn(),
  toPublicPayload: vi.fn(),
  recordEvent: vi.fn(),
  storeFlags: vi.fn(),
  getStoreLaunch: vi.fn(),
  isActiveTenant: vi.fn(),
  signal: vi.fn(),
  domainCheck: vi.fn(),
  orderProvider: vi.fn(),
}));
vi.mock('@/lib/paste/store', () => ({ recordPasteSignal: mocks.signal }));
vi.mock('@/lib/paste/domain-check', () => ({ schedulePasteDomainCheck: mocks.domainCheck }));
vi.mock('@/lib/messenger/order-provider', () => ({ resolveOrderProvider: mocks.orderProvider }));

vi.mock('@/lib/shopify/tokens', () => ({ isActiveTenant: mocks.isActiveTenant }));
vi.mock('@/lib/launch/store-launch', () => ({ getStoreLaunch: mocks.getStoreLaunch }));

vi.mock('@/lib/ratelimit', () => ({
  clientIp: () => '203.0.113.9',
  publicApiRatelimit: { configured: true, limit: mocks.rateLimit },
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

vi.mock('@/lib/flags/store-flags', async (original) => ({
  ...(await original<typeof import('@/lib/flags/store-flags')>()),
  storeFlags: mocks.storeFlags,
}));

import { GET } from './route';
import { signPreviewToken } from '@/lib/launch/preview-token';

const SITE = { id: 'site-1' };
const PAYLOAD = { v: 1, site: { id: 'site-1' } };

function req(url: string) {
  return new NextRequest(new Request(url));
}

describe('GET /api/messenger/config', () => {
  it('profiles independent config reads without a network', async () => {
    vi.useFakeTimers();
    const delayed = <T,>(value: T, ms: number) => new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));
    mocks.loadPublicSite.mockImplementation(() => delayed({ id: 'site-1', domain: 'store.myshopify.com' }, 50));
    mocks.storeFlags.mockImplementation(() => delayed(['v16_chat', 'n5_preview_mode'], 35));
    mocks.signal.mockImplementation(() => delayed('verified', 40));
    mocks.orderProvider.mockImplementation(() => delayed(null, 65));
    mocks.getStoreLaunch.mockImplementation(() => delayed(null, 45));
    {
      const start = Date.now();
      const response = GET(new NextRequest('https://app.example/api/messenger/config?key=gc_test_key', { headers: { Origin: 'https://store.example' } }));
      await vi.runAllTimersAsync();
      expect((await response).status).toBe(200);
      expect(Date.now() - start).toBe(160);
    }
    vi.useRealTimers();
  });
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.rateLimit.mockResolvedValue({ success: true, reset: Date.now() + 10_000 });
    mocks.originAllowed.mockReturnValue(true);
    mocks.toPublicPayload.mockReturnValue(PAYLOAD);
    mocks.recordEvent.mockResolvedValue(undefined);
    mocks.storeFlags.mockResolvedValue([]);
  });

  /* v16 per-store flags: the loader and panel learn which features are on. */
  it("hands the store's flags to the payload, keyed by its Shopify shop", async () => {
    mocks.loadPublicSiteByDomain.mockResolvedValue({ id: 'site-1', domain: 'grindctrl.myshopify.com' });
    mocks.storeFlags.mockResolvedValue(['n23_after_hours']);

    await GET(req('https://app.example.com/api/messenger/config?shop=grindctrl.myshopify.com'));

    expect(mocks.storeFlags).toHaveBeenCalledWith({ shopDomain: 'grindctrl.myshopify.com' });
    expect(mocks.toPublicPayload).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'site-1' }),
      expect.any(Date),
      ['n23_after_hours'],
    );
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
    expect(mocks.originAllowed).toHaveBeenCalledWith(SITE, 'https://evil.example.com', {
      // A query-param origin is untrusted, so it can never stand in for the
      // store's own domain — only a browser-set Origin header can.
      trusted: false,
    });
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
    expect(mocks.originAllowed).toHaveBeenCalledWith(SITE, 'https://evil.example.com', {
      // A query-param origin is untrusted, so it can never stand in for the
      // store's own domain — only a browser-set Origin header can.
      trusted: false,
    });
  });

  /* The ?origin= value is chosen by whoever makes the call, so it can claim to
     be the merchant's storefront. The Origin header is set by the browser and
     page script cannot forge it on a cross-origin request. Authorization must
     use the header, and a caller-supplied value must never be treated as
     trusted. */
  it('authorizes on the browser Origin header and ignores a conflicting query param', async () => {
    mocks.loadPublicSiteByDomain.mockResolvedValue(SITE);

    const response = await GET(
      new NextRequest(
        new Request(
          'https://app.example.com/api/messenger/config?shop=grindctrl.myshopify.com&origin=https%3A%2F%2Fspoofed.example.com',
          { headers: { origin: 'https://grindctrl.myshopify.com' } },
        ),
      ),
    );

    expect(response.status).toBe(200);
    expect(mocks.originAllowed).toHaveBeenCalledWith(
      SITE,
      'https://grindctrl.myshopify.com',
      { trusted: true },
    );
  });

  /* The widget fetches this cross-origin from the storefront. Without CORS the
     browser throws the response away even on a 200, the loader falls back to a
     cache that is empty on a first visit, and the launcher is never built — an
     installed, correctly configured block that renders nothing. Vary matters
     just as much: the response is `public` and cacheable, so a shared cache
     must not serve one store's Access-Control-Allow-Origin to another. */
  it('lets the storefront actually read the config cross-origin', async () => {
    mocks.loadPublicSiteByDomain.mockResolvedValue(SITE);

    const response = await GET(
      new NextRequest(
        new Request(
          'https://app.example.com/api/messenger/config?shop=grindctrl.myshopify.com',
          { headers: { origin: 'https://grindctrl.myshopify.com' } },
        ),
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
      'https://grindctrl.myshopify.com',
    );
    expect(response.headers.get('Vary')).toContain('Origin');
  });

  it('does not hand out a wildcard when there is no browser origin', async () => {
    mocks.loadPublicSiteByDomain.mockResolvedValue(SITE);

    const response = await GET(
      req('https://app.example.com/api/messenger/config?shop=grindctrl.myshopify.com'),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
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

  it('earns nothing from a forged Origin on an unverified domain: chat loads, our server checks the page', async () => {
    mocks.loadPublicSite.mockResolvedValue({ ...SITE, status: 'active', patterns: [] });
    mocks.signal.mockResolvedValue('unverified');
    const response = await GET(new NextRequest('https://app.example.com/api/messenger/config?key=gc_test_key',
      { headers: { origin: 'https://victim-brand.example' } }));
    expect(response.status).toBe(200);
    expect(mocks.domainCheck).toHaveBeenCalledExactlyOnceWith(SITE.id, 'victim-brand.example');
    mocks.domainCheck.mockClear(); mocks.signal.mockResolvedValue('granted');
    await GET(new NextRequest('https://app.example.com/api/messenger/config?key=gc_test_key', { headers: { origin: 'https://merchant.example' } }));
    expect(mocks.domainCheck).not.toHaveBeenCalled();
  });

  it('asks for a check when this site claimed a host another site holds, and still refuses the origin', async () => {
    mocks.originAllowed.mockReturnValue(false);
    mocks.loadPublicSite.mockResolvedValue({ ...SITE, status: 'active', patterns: [
      { pattern: 'merchant.example', verification_status: 'pending', verification_method: 'paste_dns_txt', environment: 'production' },
    ] });
    const refused = await GET(new NextRequest('https://app.example.com/api/messenger/config?key=gc_test_key', { headers: { origin: 'https://www.merchant.example' } }));
    expect(refused.status).toBe(403);
    expect(mocks.domainCheck).toHaveBeenCalledExactlyOnceWith(SITE.id, 'www.merchant.example');
    mocks.domainCheck.mockClear();
    // A host this site never claimed, or a query-string origin, asks for nothing.
    await GET(new NextRequest('https://app.example.com/api/messenger/config?key=gc_test_key', { headers: { origin: 'https://evil.example' } }));
    await GET(req('https://app.example.com/api/messenger/config?key=gc_test_key&origin=https://merchant.example'));
    expect(mocks.domainCheck).not.toHaveBeenCalled();
    expect(mocks.signal).not.toHaveBeenCalled();
  });

  it('records a real install signal only after an active site admits a browser Origin', async () => {
    mocks.loadPublicSite.mockResolvedValue({ ...SITE, status: 'active', patterns: [] });
    await GET(new NextRequest('https://app.example.com/api/messenger/config?key=gc_test_key', { headers: { origin: 'https://merchant.example' } }));
    expect(mocks.signal).toHaveBeenCalledExactlyOnceWith(SITE.id, 'https://merchant.example');
    mocks.signal.mockClear();
    await GET(req('https://app.example.com/api/messenger/config?key=gc_test_key&origin=https://merchant.example'));
    expect(mocks.signal).not.toHaveBeenCalled();
    mocks.originAllowed.mockReturnValue(false);
    await GET(new NextRequest('https://app.example.com/api/messenger/config?key=gc_test_key', { headers: { origin: 'https://evil.example' } }));
    expect(mocks.signal).not.toHaveBeenCalled();
  });

  /* Store Chat off leaves the site in `draft`, but the pasted code still runs
     Try-On there. Found on a real store: the dashboard kept saying "Waiting
     for your store" until a shopper pressed the Try-On button. */
  it('records the install signal while Store Chat is off, and never for a disabled site', async () => {
    mocks.loadPublicSite.mockResolvedValue({ ...SITE, status: 'draft', patterns: [] });
    await GET(new NextRequest('https://app.example.com/api/messenger/config?key=gc_test_key', { headers: { origin: 'https://merchant.example' } }));
    expect(mocks.signal).toHaveBeenCalledExactlyOnceWith(SITE.id, 'https://merchant.example');
    mocks.signal.mockClear();
    mocks.loadPublicSite.mockResolvedValue({ ...SITE, status: 'disabled', patterns: [] });
    await GET(new NextRequest('https://app.example.com/api/messenger/config?key=gc_test_key', { headers: { origin: 'https://merchant.example' } }));
    expect(mocks.signal).not.toHaveBeenCalled();
  });
});

/* Phase zero item 9: who sees Store Chat on a Shopify store. */
describe('GET /api/messenger/config launch state (N5)', () => {
  const SHOP_SITE = { id: 'site-1', domain: 'maison.myshopify.com' };
  const URL_BASE = 'https://app.example.com/api/messenger/config?shop=maison.myshopify.com';

  beforeEach(() => {
    vi.resetAllMocks();
    process.env.SHOPIFY_API_KEY = 'client';
    process.env.SHOPIFY_API_SECRET = 'secret';
    process.env.GRINDCTRL_CAPABILITY_SECRET = 'test-only-independent-core-signing-key-2026';
    mocks.rateLimit.mockResolvedValue({ success: true, reset: Date.now() + 10_000 });
    mocks.originAllowed.mockReturnValue(true);
    mocks.toPublicPayload.mockImplementation(() => ({ v: 1, active: true }));
    mocks.recordEvent.mockResolvedValue(undefined);
    mocks.loadPublicSiteByDomain.mockResolvedValue(SHOP_SITE);
    mocks.storeFlags.mockResolvedValue(['n5_preview_mode']);
    mocks.getStoreLaunch.mockResolvedValue({ state: 'preview', holdoutShare: null, holdoutStartedAt: null, holdoutEndsAt: null, salt: '0123456789abcdef0123456789abcdef' });
  });

  it('tells the loader to draw nothing for a shopper while the store is in preview', async () => {
    const body = await (await GET(req(`${URL_BASE}&vid=visitor_1_abcdefghijkl`))).json();
    expect(body.launch).toEqual({ show: false, reason: 'preview', bucket: null, test: false });
  });

  it('shows Store Chat to the owner with a valid preview link', async () => {
    const { token } = signPreviewToken('test-only-independent-core-signing-key-2026', 'maison.myshopify.com');
    const body = await (await GET(req(`${URL_BASE}&preview=${encodeURIComponent(token)}`))).json();
    expect(body.launch).toEqual({ show: true, reason: null, bucket: null, test: true });
  });

  it('adds nothing while the flag is off, or for a site that is not a Shopify store', async () => {
    mocks.storeFlags.mockResolvedValue([]);
    expect((await (await GET(req(URL_BASE))).json()).launch).toBeUndefined();

    mocks.storeFlags.mockResolvedValue(['n5_preview_mode']);
    mocks.loadPublicSite.mockResolvedValue({ id: 'site-2', domain: 'example.com' });
    expect((await (await GET(req('https://app.example.com/api/messenger/config?key=gc_test_key'))).json()).launch).toBeUndefined();
    expect(mocks.getStoreLaunch).not.toHaveBeenCalled();
  });
});

/* WooCommerce parity phase 5: a paired store follows the same launch rule. */
describe('GET /api/messenger/config launch state for a WooCommerce store', () => {
  const SITE_ID = '11111111-1111-4111-8111-111111111111';
  const KEY = `site:${SITE_ID}`;
  const URL_BASE = 'https://app.example.com/api/messenger/config?key=gc_test_key&vid=visitor_1_abcdefghijkl';

  beforeEach(() => {
    vi.resetAllMocks();
    process.env.GRINDCTRL_CAPABILITY_SECRET = 'test-only-independent-core-signing-key-2026';
    mocks.rateLimit.mockResolvedValue({ success: true, reset: Date.now() + 10_000 });
    mocks.originAllowed.mockReturnValue(true);
    mocks.toPublicPayload.mockImplementation(() => ({ v: 1, active: true }));
    mocks.recordEvent.mockResolvedValue(undefined);
    mocks.loadPublicSite.mockResolvedValue({ id: SITE_ID, domain: 'shop.example.com' });
    mocks.storeFlags.mockResolvedValue(['n5_preview_mode']);
    mocks.isActiveTenant.mockResolvedValue(true);
    mocks.getStoreLaunch.mockResolvedValue({ state: 'preview', holdoutShare: null, holdoutStartedAt: null, holdoutEndsAt: null, salt: '0123456789abcdef0123456789abcdef' });
  });

  it('hides Store Chat from shoppers while the store is in preview, reading the launch row by site tenant', async () => {
    const body = await (await GET(req(URL_BASE))).json();
    expect(body.launch).toEqual({ show: false, reason: 'preview', bucket: null, test: false });
    expect(mocks.getStoreLaunch).toHaveBeenCalledWith(KEY);
  });

  it('shows it to the owner with a preview link signed for the site tenant, and not with one for another', async () => {
    const secret = 'test-only-independent-core-signing-key-2026';
    const own = signPreviewToken(secret, KEY).token;
    expect((await (await GET(req(`${URL_BASE}&preview=${encodeURIComponent(own)}`))).json()).launch).toMatchObject({ show: true, test: true });
    const other = signPreviewToken(secret, 'maison.myshopify.com').token;
    expect((await (await GET(req(`${URL_BASE}&preview=${encodeURIComponent(other)}`))).json()).launch).toMatchObject({ show: false });
  });

  it('adds nothing for a site whose plugin connection is not active', async () => {
    mocks.isActiveTenant.mockResolvedValue(false);
    expect((await (await GET(req(URL_BASE))).json()).launch).toBeUndefined();
    expect(mocks.getStoreLaunch).not.toHaveBeenCalled();
  });
});
