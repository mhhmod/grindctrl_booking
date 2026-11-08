// @vitest-environment node
import { createHmac } from 'node:crypto';
import { Readable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { liquidSignedMessage, pasteLiquidSecret } from './signing';
import {
  readCapped, recordedStorefrontEvidence, scanShopStorefront, StorefrontTooLargeError, STOREFRONT_MAX_BODY_BYTES,
  type StorefrontLookup, type StorefrontRequest, type StorefrontResponse,
} from './storefront-scan';
import type { PasteConnection } from './types';

const SITE = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const SHOP = 'merchant.myshopify.com';
const NOW = 2_000_000_000;
const PASSWORD = 'open-sesame-correct-horse';
const pending: PasteConnection = {
  widget_site_id: SITE, platform: 'shopify', shop_domain: SHOP, status: 'pending', secret_version: 1,
  previous_secret_version: null, previous_valid_until: null, first_seen_at: null, last_seen_at: null, shop_proven_at: null,
  disconnected_reason: null, shop_render_at: null, shop_check_outcome: null, shop_checked_at: null, app_installed: false,
};

/** The snippet as Liquid renders it; product fields are empty off a product page. */
function tag(over: { site?: string; shop?: string; version?: number; product?: string; variant?: string; signature?: string; extra?: string } = {}) {
  const site = over.site ?? SITE;
  const claims = { siteId: site, shopDomain: over.shop ?? SHOP, productId: over.product ?? '', variantId: over.variant ?? '',
    issuedAt: String(NOW - 600), customerId: '' };
  const signature = over.signature
    ?? createHmac('sha256', pasteLiquidSecret(site, over.version ?? 1)!).update(liquidSignedMessage(claims)).digest('hex');
  return `<script async src="https://grindctrl.cloud/widget/v1/messenger.js" data-key="gc_key_123456" data-gc-install="paste" `
    + `data-gc-platform="shopify" data-gc-site="${site}" data-gc-shop="${claims.shopDomain}" data-gc-product="${claims.productId}" `
    + `data-gc-variant="${claims.variantId}" data-gc-issued-at="${claims.issuedAt}" data-gc-customer=""${over.extra ?? ''} `
    + `data-gc-signature="${signature}"></script>`;
}
const page = (footer = '') => `<!doctype html><html><head><title>Shop</title></head><body><main>Products</main><footer>${footer}</footer></body></html>`;
const passwordPage = `<!doctype html><html><body><form method="post" action="/password" id="login_form" accept-charset="UTF-8">`
  + `<input type="hidden" name="form_type" value="storefront_password" /><input type="hidden" name="utf8" value="✓" />`
  + `<input type="hidden" name="authenticity_token" value="tok123" /><input type="password" name="password" id="Password"></form></body></html>`;

type Route = Partial<StorefrontResponse> | ((request: StorefrontRequest) => Partial<StorefrontResponse>);
function storefront(routes: Record<string, Route>) {
  const calls: StorefrontRequest[] = [];
  const transport = vi.fn(async (request: StorefrontRequest): Promise<StorefrontResponse> => {
    calls.push(request);
    const route = routes[`${request.method} ${request.url.href}`];
    if (!route) throw new Error(`unexpected ${request.method} ${request.url.href}`);
    const value = typeof route === 'function' ? route(request) : route;
    return { status: 200, location: null, contentType: 'text/html', setCookie: [], body: Buffer.alloc(0), ...value };
  });
  return { transport, calls };
}
const html = (body: string, over: Partial<StorefrontResponse> = {}): Partial<StorefrontResponse> => ({ body: Buffer.from(body), ...over });
const redirect = (location: string, over: Partial<StorefrontResponse> = {}): Partial<StorefrontResponse> => ({ status: 302, location, ...over });
const publicLookup = vi.fn(async (_host: string) => [{ address: '23.227.38.65', family: 4 }]);
const scan = (routes: Record<string, Route>, options: { password?: string; lookup?: StorefrontLookup; connection?: PasteConnection } = {}) => {
  const fake = storefront(routes);
  return { fake, result: scanShopStorefront(options.connection ?? pending, {
    transport: fake.transport, lookup: options.lookup ?? publicLookup, nowSeconds: NOW, password: options.password }) };
};

beforeEach(() => { vi.stubEnv('GRINDCTRL_CAPABILITY_SECRET', 'test-only-independent-core-key-with-at-least-32-bytes'); publicLookup.mockClear(); });
afterEach(() => vi.unstubAllEnvs());

describe('storefront proof of theme control', () => {
  it("proves from this site's signed snippet in the storefront footer, fetched from the shop's own pinned host", async () => {
    const { fake, result } = scan({ [`GET https://${SHOP}/`]: html(page(tag())) });
    expect(await result).toMatchObject({ outcome: 'found', host: SHOP, evidence: { siteId: SITE, shopDomain: SHOP } });
    expect(publicLookup).toHaveBeenCalledWith(SHOP);
    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]).toMatchObject({ method: 'GET', address: '23.227.38.65', family: 4, body: undefined });
    expect(fake.calls[0].headers).not.toHaveProperty('cookie');
    expect(fake.calls[0].headers).not.toHaveProperty('authorization');
  });

  it('accepts the product-page render and the previous secret during the rotation overlap', async () => {
    expect((await scan({ [`GET https://${SHOP}/`]: html(page(tag({ product: '42', variant: '77' }))) }).result).outcome).toBe('found');
    const rotated = { ...pending, secret_version: 2, previous_secret_version: 1, previous_valid_until: new Date((NOW + 60) * 1000).toISOString() };
    expect((await scan({ [`GET https://${SHOP}/`]: html(page(tag())) }, { connection: rotated }).result).outcome).toBe('found');
    const retired = { ...rotated, previous_valid_until: new Date((NOW - 60) * 1000).toISOString() };
    expect((await scan({ [`GET https://${SHOP}/`]: html(page(tag())) }, { connection: retired }).result).outcome).toBe('outdated_code');
  });

  it("reports another site's code as wrong_site, never as proof", async () => {
    expect((await scan({ [`GET https://${SHOP}/`]: html(page(tag({ site: OTHER }))) }).result).outcome).toBe('wrong_site');
  });

  it('reports a storefront without our code as not_found, including code that is commented out or only text', async () => {
    for (const body of [page(), page(`<!-- ${tag()} -->`), page(`<script type="application/json">{"review":"${tag().replace(/"/g, "'")}"}</script>`),
      page(`<script>var s = '${tag()}';</script>`), page(`<noscript>${tag()}</noscript>`), page(`<textarea>${tag()}</textarea>`)]) {
      expect((await scan({ [`GET https://${SHOP}/`]: html(body) }).result).outcome).toBe('not_found');
    }
  });

  it("reports this site's code with a bad signature, for another shop or with an ambiguous attribute as outdated_code", async () => {
    for (const footer of [tag({ signature: 'a'.repeat(64) }), tag({ shop: 'victim.myshopify.com' }), tag({ extra: ` data-gc-site="${SITE}"` })]) {
      const outcome = (await scan({ [`GET https://${SHOP}/`]: html(page(footer)) }).result).outcome;
      expect(['outdated_code', 'not_found']).toContain(outcome);
      expect(outcome).not.toBe('found');
    }
    expect((await scan({ [`GET https://${SHOP}/`]: html(page(tag({ signature: 'a'.repeat(64) }))) }).result).outcome).toBe('outdated_code');
  });
});

describe('redirects', () => {
  it('follows the shop host to the primary domain it names, and that domain to its www twin', async () => {
    const { fake, result } = scan({
      [`GET https://${SHOP}/`]: redirect('https://brand.example/'),
      'GET https://brand.example/': redirect('https://www.brand.example/'),
      'GET https://www.brand.example/': html(page(tag())),
    });
    expect(await result).toMatchObject({ outcome: 'found', host: 'www.brand.example' });
    expect(fake.calls.map((call) => call.url.hostname)).toEqual([SHOP, 'brand.example', 'www.brand.example']);
    expect(publicLookup.mock.calls.map(([host]) => host)).toEqual([SHOP, 'brand.example', 'www.brand.example']);
  });

  it.each([
    ['a second foreign host', { 'GET https://brand.example/': redirect('https://evil.example/') }, 'foreign_redirect'],
    ['plain HTTP', { 'GET https://brand.example/': redirect('http://brand.example/') }, 'bad_redirect'],
    ['another port', { 'GET https://brand.example/': redirect('https://brand.example:8443/') }, 'bad_redirect'],
    ['credentials', { 'GET https://brand.example/': redirect('https://user:pass@brand.example/') }, 'bad_redirect'],
    ['an IP literal', { 'GET https://brand.example/': redirect('https://93.184.216.34/') }, 'bad_redirect'],
  ])('refuses a redirect to %s', async (_name, routes, failure) => {
    const { fake, result } = scan({ [`GET https://${SHOP}/`]: redirect('https://brand.example/'), ...routes });
    expect(await result).toEqual({ outcome: 'unreachable', failure });
    expect(fake.calls).toHaveLength(2);
  });

  it("refuses a shop host redirecting to another shop's myshopify host", async () => {
    const { fake, result } = scan({ [`GET https://${SHOP}/`]: redirect('https://victim.myshopify.com/') });
    expect(await result).toEqual({ outcome: 'unreachable', failure: 'foreign_redirect' });
    expect(fake.calls).toHaveLength(1);
  });

  it('stops after a few redirects', async () => {
    const { fake, result } = scan({ [`GET https://${SHOP}/`]: redirect(`https://${SHOP}/`) });
    expect(await result).toEqual({ outcome: 'unreachable', failure: 'too_many_redirects' });
    expect(fake.calls).toHaveLength(5);
  });
});

describe('network safety', () => {
  it.each([[['10.0.0.5']], [['127.0.0.1']], [['23.227.38.65', '192.168.1.1']], [['::1']], [['::ffff:127.0.0.1']]])(
    'never connects when the host resolves to a non-public address %j', async (addresses) => {
      const lookup = vi.fn(async () => addresses.map((address) => ({ address, family: address.includes(':') ? 6 : 4 })));
      const { fake, result } = scan({ [`GET https://${SHOP}/`]: html(page(tag())) }, { lookup });
      expect(await result).toEqual({ outcome: 'unreachable', failure: 'private_address' });
      expect(fake.transport).not.toHaveBeenCalled();
    });

  it('never connects when a redirect target resolves privately', async () => {
    const lookup = vi.fn(async (host: string) => [{ address: host === SHOP ? '23.227.38.65' : '169.254.169.254', family: 4 }]);
    const { fake, result } = scan({ [`GET https://${SHOP}/`]: redirect('https://brand.example/') }, { lookup });
    expect(await result).toEqual({ outcome: 'unreachable', failure: 'private_address' });
    expect(fake.calls).toHaveLength(1);
  });

  it('refuses oversized, non-HTML, error and failed responses', async () => {
    const big = Buffer.alloc(STOREFRONT_MAX_BODY_BYTES + 1, 'a');
    expect(await scan({ [`GET https://${SHOP}/`]: { body: big } }).result).toEqual({ outcome: 'unreachable', failure: 'too_large' });
    expect(await scan({ [`GET https://${SHOP}/`]: () => { throw new StorefrontTooLargeError(); } }).result)
      .toEqual({ outcome: 'unreachable', failure: 'too_large' });
    expect(await scan({ [`GET https://${SHOP}/`]: html(page(tag()), { contentType: 'application/json' }) }).result)
      .toEqual({ outcome: 'unreachable', failure: 'not_html' });
    expect(await scan({ [`GET https://${SHOP}/`]: html(page(tag()), { status: 503 }) }).result).toEqual({ outcome: 'unreachable', failure: 'status' });
    expect(await scan({ [`GET https://${SHOP}/`]: () => { throw new Error('storefront_timeout'); } }).result)
      .toEqual({ outcome: 'unreachable', failure: 'timeout' });
    expect(await scan({ [`GET https://${SHOP}/`]: () => { throw new Error('ECONNRESET'); } }).result)
      .toEqual({ outcome: 'unreachable', failure: 'network' });
  });

  it('caps a streamed body as it arrives', async () => {
    expect((await readCapped(Readable.from([Buffer.alloc(10), Buffer.alloc(10)]), 20)).length).toBe(20);
    await expect(readCapped(Readable.from([Buffer.alloc(10), Buffer.alloc(11)]), 20)).rejects.toBeInstanceOf(StorefrontTooLargeError);
  });
});

describe('password-protected stores', () => {
  const routes = (afterPassword: Route): Record<string, Route> => ({
    [`GET https://${SHOP}/`]: redirect('/password'),
    [`GET https://${SHOP}/password`]: html(passwordPage, { setCookie: ['_shopify_s=session1; Path=/; Secure'] }),
    [`POST https://${SHOP}/password`]: afterPassword,
  });

  it('reports password_required without sending anything when no password is given', async () => {
    const { fake, result } = scan(routes(redirect('/')));
    expect(await result).toEqual({ outcome: 'password_required' });
    expect(fake.calls.map((call) => call.method)).toEqual(['GET', 'GET']);
    // Shopify may answer the password page with 401.
    expect((await scan({ [`GET https://${SHOP}/`]: html(passwordPage, { status: 401 }) }).result).outcome).toBe('password_required');
  });

  it("posts the password once to the store's own form, then proves from the unlocked storefront", async () => {
    let unlocked = false;
    const { fake, result } = scan({
      ...routes(() => { unlocked = true; return redirect('/', { setCookie: ['storefront_digest=digest1; Path=/; HttpOnly'] }); }),
      [`GET https://${SHOP}/`]: (request) => unlocked && request.headers.cookie?.includes('storefront_digest=digest1')
        ? html(page(tag())) : redirect('/password'),
    }, { password: PASSWORD });
    const outcome = await result;
    expect(outcome).toMatchObject({ outcome: 'found' });
    const post = fake.calls.find((call) => call.method === 'POST')!;
    expect(post.url.href).toBe(`https://${SHOP}/password`);
    expect(post.headers).toMatchObject({ 'content-type': 'application/x-www-form-urlencoded', cookie: '_shopify_s=session1' });
    expect(Object.fromEntries(new URLSearchParams(post.body))).toEqual({
      form_type: 'storefront_password', utf8: '✓', authenticity_token: 'tok123', password: PASSWORD });
    expect(fake.calls.filter((call) => call.method === 'POST')).toHaveLength(1);
    expect(fake.calls.filter((call) => call.body?.includes(PASSWORD))).toEqual([post]);
    expect(JSON.stringify(outcome)).not.toContain(PASSWORD);
  });

  it('reports password_rejected when the password does not open the store, and never retries it', async () => {
    const { fake, result } = scan(routes(redirect('/password')), { password: 'wrong-password' });
    const outcome = await result;
    expect(outcome).toEqual({ outcome: 'password_rejected' });
    expect(fake.calls.filter((call) => call.method === 'POST')).toHaveLength(1);
    expect(JSON.stringify(outcome)).not.toContain('wrong-password');
  });

  it("never sends the password to a form that posts anywhere but the store's own /password", async () => {
    const foreign = passwordPage.replace('action="/password"', 'action="https://evil.example/password"');
    const { fake, result } = scan({ [`GET https://${SHOP}/`]: html(foreign) }, { password: PASSWORD });
    expect(await result).toEqual({ outcome: 'unreachable', failure: 'password_form' });
    expect(fake.calls.some((call) => call.method === 'POST')).toBe(false);
  });
});

describe('a recorded storefront finding', () => {
  const at = (secondsAgo: number) => new Date((NOW - secondsAgo) * 1000).toISOString();
  it('counts only a recent awaiting_visit check', () => {
    expect(recordedStorefrontEvidence({ ...pending, shop_check_outcome: 'awaiting_visit', shop_checked_at: at(60) }, NOW * 1000))
      .toEqual({ siteId: SITE, shopDomain: SHOP });
    expect(recordedStorefrontEvidence({ ...pending, shop_check_outcome: 'awaiting_visit', shop_checked_at: at(16 * 60) }, NOW * 1000)).toBeNull();
    expect(recordedStorefrontEvidence({ ...pending, shop_check_outcome: 'not_found', shop_checked_at: at(60) }, NOW * 1000)).toBeNull();
    expect(recordedStorefrontEvidence({ ...pending, shop_check_outcome: 'awaiting_visit', shop_checked_at: null }, NOW * 1000)).toBeNull();
  });
});
