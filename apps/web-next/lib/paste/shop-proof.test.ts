// @vitest-environment node
import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ render: vi.fn(), begin: vi.fn(), finish: vi.fn(), release: vi.fn(), prove: vi.fn(), siteLimit: vi.fn(), shopLimit: vi.fn(), email: vi.fn() }));
vi.mock('@/lib/paste/store', () => ({ recordPasteShopRender: m.render, beginPasteShopCheck: m.begin,
  finishPasteShopCheck: m.finish, releasePasteShopCheck: m.release, provePasteShop: m.prove }));
vi.mock('@/lib/email/store-connected-sender', () => ({ scheduleStoreConnectedEmail: m.email }));
vi.mock('@/lib/ratelimit', () => ({ pasteShopCheckSiteRatelimit: { limit: m.siteLimit }, pasteShopCheckShopRatelimit: { limit: m.shopLimit } }));

import { checkPasteShop, SHOP_CHECK_RETRY_SECONDS } from './shop-proof';
import { liquidSignedMessage, pasteLiquidSecret } from './signing';
import { scanShopStorefront, type StorefrontEvidence, type StorefrontRequest, type StorefrontScan } from './storefront-scan';
import { PasteError, type PasteConnection } from './types';

const SITE = '11111111-1111-4111-8111-111111111111';
const SQUATTER = '33333333-3333-4333-8333-333333333333';
const SHOP = 'victim.myshopify.com';
const NOW = new Date('2033-05-18T03:33:20.000Z');
const PASSWORD = 'storefront-password-do-not-leak';
const pending: PasteConnection = {
  widget_site_id: SITE, platform: 'shopify', shop_domain: SHOP, status: 'pending', secret_version: 1,
  previous_secret_version: null, previous_valid_until: null, first_seen_at: null, last_seen_at: null, shop_proven_at: null,
  disconnected_reason: null, shop_render_at: null, shop_check_outcome: null, shop_checked_at: null, app_installed: false,
};
const evidence = { siteId: SITE, shopDomain: SHOP } as StorefrontEvidence;
const PRODUCT = `https://${SHOP}/products/dress`;
const found = vi.fn(async (): Promise<StorefrontScan> => ({ outcome: 'found', evidence, host: SHOP, productUrl: PRODUCT, passwordPage: false }));
const ago = (seconds: number) => new Date(NOW.getTime() - seconds * 1000).toISOString();
const allowed = { success: true, reset: NOW.getTime() + 1000 };

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('GRINDCTRL_CAPABILITY_SECRET', 'test-only-independent-core-key-with-at-least-32-bytes');
  found.mockImplementation(async () => ({ outcome: 'found', evidence, host: SHOP, productUrl: PRODUCT, passwordPage: false }));
  m.render.mockResolvedValue('recorded'); m.begin.mockResolvedValue('started'); m.finish.mockResolvedValue(undefined); m.release.mockResolvedValue(undefined);
  m.prove.mockResolvedValue('proven'); m.siteLimit.mockResolvedValue(allowed); m.shopLimit.mockResolvedValue(allowed);
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe('storefront proof for a pending Shopify shop', () => {
  it('proves from a verified render once the storefront shows this site\'s code', async () => {
    const result = await checkPasteShop(pending, { kind: 'render' }, { scan: found, now: NOW });
    expect(result).toEqual({ shopProof: 'proven', shopProvenAt: NOW.toISOString(), outcome: 'proven', checkedAt: NOW.toISOString(), retryAfterSeconds: null,
      storefront: { productUrl: PRODUCT, passwordPage: false, primaryHost: null } });
    expect(m.render).toHaveBeenCalledExactlyOnceWith(pending);
    expect(m.siteLimit).toHaveBeenCalledWith(`paste-shop-check:site:${SITE}`);
    expect(m.shopLimit).toHaveBeenCalledWith(`paste-shop-check:shop:${SHOP}`);
    expect(m.prove).toHaveBeenCalledExactlyOnceWith(pending, evidence);
    expect(m.render.mock.invocationCallOrder[0]).toBeLessThan(m.prove.mock.invocationCallOrder[0]);
    expect(m.finish).not.toHaveBeenCalled();
  });

  it("gives the owner's check its own budget, so shopper visits never use up the owner's click (m9)", async () => {
    await checkPasteShop(pending, { kind: 'owner' }, { scan: found, now: NOW });
    expect(m.siteLimit).toHaveBeenCalledExactlyOnceWith(`paste-shop-check:owner:site:${SITE}`);
    expect(m.shopLimit).toHaveBeenCalledExactlyOnceWith(`paste-shop-check:owner:shop:${SHOP}`);
    // A render whose budget is spent is refused; the owner's next click still checks.
    m.siteLimit.mockImplementation(async (key: string) => key.includes(':owner:') ? allowed : { success: false, reset: NOW.getTime() + 60_000 });
    expect(await checkPasteShop(pending, { kind: 'render' }, { scan: found, now: NOW })).toMatchObject({ outcome: 'rate_limited' });
    expect(await checkPasteShop(pending, { kind: 'owner' }, { scan: found, now: NOW })).toMatchObject({ outcome: 'proven' });
  });

  it('reports the custom primary domain the shop sent our fetch to, and nothing for the shop host itself (B2)', async () => {
    m.prove.mockResolvedValue('render_required');
    const custom = vi.fn(async (): Promise<StorefrontScan> => ({ outcome: 'found', evidence, host: 'www.brand.com',
      productUrl: 'https://www.brand.com/products/dress', passwordPage: false }));
    expect(await checkPasteShop(pending, { kind: 'owner' }, { scan: custom, now: NOW })).toMatchObject({
      outcome: 'awaiting_visit', storefront: { primaryHost: 'www.brand.com', productUrl: 'https://www.brand.com/products/dress' } });
    expect(await checkPasteShop(pending, { kind: 'owner' }, { scan: found, now: NOW })).toMatchObject({ storefront: { primaryHost: null } });
  });

  it("never lets a squatter's forged render displace the merchant: our fetch finds the merchant's code, not the squatter's", async () => {
    // The squatter's render verified with the squatter's own secret, naming
    // the victim shop. The victim's storefront carries the real merchant's code.
    const squatter = { ...pending, widget_site_id: SQUATTER };
    const merchantTag = (() => {
      const claims = { siteId: SITE, shopDomain: SHOP, productId: '', variantId: '', issuedAt: String(Math.floor(NOW.getTime() / 1000)), customerId: '' };
      const mac = createHmac('sha256', pasteLiquidSecret(SITE, 1)!).update(liquidSignedMessage(claims)).digest('hex');
      return `<script async data-gc-install="paste" data-gc-platform="shopify" data-gc-site="${SITE}" data-gc-shop="${SHOP}" data-gc-product="" `
        + `data-gc-variant="" data-gc-issued-at="${claims.issuedAt}" data-gc-customer="" data-gc-signature="${mac}"></script>`;
    })();
    const transport = vi.fn(async (_request: StorefrontRequest) => ({ status: 200, location: null, contentType: 'text/html', setCookie: [],
      body: Buffer.from(`<html><body><footer>${merchantTag}</footer></body></html>`) }));
    const scan: typeof scanShopStorefront = (connection, options) => scanShopStorefront(connection, {
      ...options, transport, lookup: async () => [{ address: '23.227.38.65', family: 4 }] });
    const result = await checkPasteShop(squatter, { kind: 'render' }, { scan, now: NOW });
    expect(result).toMatchObject({ shopProof: 'pending', outcome: 'wrong_site', retryAfterSeconds: SHOP_CHECK_RETRY_SECONDS.render });
    expect(m.prove).not.toHaveBeenCalled();
    expect(m.finish).toHaveBeenCalledExactlyOnceWith(squatter, 'wrong_site');
    expect(transport.mock.calls[0][0].url.href).toBe(`https://${SHOP}/`);
    // The same storefront proves the merchant's own site.
    expect((await checkPasteShop(pending, { kind: 'owner' }, { scan, now: NOW })).outcome).toBe('proven');
    expect(m.prove).toHaveBeenCalledExactlyOnceWith(pending, expect.objectContaining({ siteId: SITE, shopDomain: SHOP }));
  });

  it.each(['not_found', 'outdated_code', 'password_required', 'unreachable'] as const)('stores %s and never proves', async (outcome) => {
    const result = await checkPasteShop(pending, { kind: 'owner' }, { scan: async () => ({ outcome }), now: NOW });
    expect(result).toEqual({ shopProof: 'pending', shopProvenAt: null, outcome, checkedAt: NOW.toISOString(), retryAfterSeconds: SHOP_CHECK_RETRY_SECONDS.owner });
    expect(m.finish).toHaveBeenCalledExactlyOnceWith(pending, outcome);
    expect(m.prove).not.toHaveBeenCalled(); expect(m.render).not.toHaveBeenCalled();
  });

  it('waits for a visit when the code is on the storefront but no signed render arrived yet', async () => {
    m.prove.mockResolvedValue('render_required');
    const result = await checkPasteShop(pending, { kind: 'owner' }, { scan: found, now: NOW });
    expect(result).toMatchObject({ shopProof: 'pending', outcome: 'awaiting_visit', retryAfterSeconds: null });
    expect(m.finish).toHaveBeenCalledExactlyOnceWith(pending, 'awaiting_visit');
  });

  it('lets the next render finish a recent finding without fetching again, and refetches an old one', async () => {
    const waiting = { ...pending, shop_check_outcome: 'awaiting_visit' as const, shop_checked_at: ago(5 * 60) };
    expect((await checkPasteShop(waiting, { kind: 'render' }, { scan: found, now: NOW })).outcome).toBe('proven');
    expect(found).not.toHaveBeenCalled(); expect(m.siteLimit).not.toHaveBeenCalled(); expect(m.begin).not.toHaveBeenCalled();
    expect(m.prove).toHaveBeenCalledExactlyOnceWith(waiting, { siteId: SITE, shopDomain: SHOP });
    await checkPasteShop({ ...waiting, shop_checked_at: ago(20 * 60) }, { kind: 'render' }, { scan: found, now: NOW });
    expect(found).toHaveBeenCalledOnce();
  });
});

describe('dedupe, cache and limits', () => {
  it('reuses a recent failed check instead of fetching again', async () => {
    const failed = { ...pending, shop_check_outcome: 'not_found' as const, shop_checked_at: ago(30) };
    expect(await checkPasteShop(failed, { kind: 'render' }, { scan: found, now: NOW }))
      .toEqual({ shopProof: 'pending', shopProvenAt: null, outcome: 'not_found', checkedAt: failed.shop_checked_at, retryAfterSeconds: 90 });
    expect(await checkPasteShop({ ...failed, shop_checked_at: ago(10) }, { kind: 'owner' }, { scan: found, now: NOW }))
      .toMatchObject({ outcome: 'not_found', retryAfterSeconds: 20 });
    expect(found).not.toHaveBeenCalled(); expect(m.siteLimit).not.toHaveBeenCalled();
    // The render is still recorded: it is the second factor.
    expect(m.render).toHaveBeenCalledOnce();
    // A storefront password is new input: it checks again at once.
    const locked = { ...failed, shop_check_outcome: 'password_required' as const };
    expect((await checkPasteShop(locked, { kind: 'owner', password: PASSWORD }, { scan: found, now: NOW })).outcome).toBe('proven');
    expect(found).toHaveBeenCalledOnce();
  });

  it('runs one check at a time per site', async () => {
    m.begin.mockResolvedValue('busy');
    expect(await checkPasteShop(pending, { kind: 'owner' }, { scan: found, now: NOW }))
      .toMatchObject({ shopProof: 'pending', outcome: 'rate_limited', checkedAt: null, retryAfterSeconds: 10 });
    expect(found).not.toHaveBeenCalled(); expect(m.finish).not.toHaveBeenCalled();
  });

  it.each(['site', 'shop'] as const)('reports rate_limited with a retry-after when the %s budget is spent', async (which) => {
    (which === 'site' ? m.siteLimit : m.shopLimit).mockResolvedValue({ success: false, reset: NOW.getTime() + 42_000 });
    vi.useFakeTimers({ now: NOW });
    try {
      expect(await checkPasteShop(pending, { kind: 'owner' }, { scan: found, now: NOW }))
        .toMatchObject({ outcome: 'rate_limited', retryAfterSeconds: 42 });
    } finally { vi.useRealTimers(); }
    expect(m.begin).not.toHaveBeenCalled(); expect(found).not.toHaveBeenCalled();
  });

  it('fails closed when rate enforcement is unavailable', async () => {
    m.siteLimit.mockRejectedValue(new Error('redis down'));
    await expect(checkPasteShop(pending, { kind: 'owner' }, { scan: found, now: NOW })).rejects.toMatchObject({ code: 'unavailable' });
    m.siteLimit.mockResolvedValue({ success: true, reason: 'timeout', reset: NOW.getTime() });
    await expect(checkPasteShop(pending, { kind: 'owner' }, { scan: found, now: NOW })).rejects.toMatchObject({ code: 'unavailable' });
    expect(found).not.toHaveBeenCalled();
  });
});

describe('connection states', () => {
  it('returns a proven shop as proven without any work', async () => {
    const proven = { ...pending, status: 'active' as const, shop_proven_at: ago(60), shop_check_outcome: 'proven' as const, shop_checked_at: ago(60) };
    expect(await checkPasteShop(proven, { kind: 'owner' }, { scan: found, now: NOW }))
      .toEqual({ shopProof: 'proven', shopProvenAt: ago(60), outcome: 'proven', checkedAt: ago(60), retryAfterSeconds: null });
    expect(found).not.toHaveBeenCalled(); expect(m.render).not.toHaveBeenCalled();
  });

  it.each([
    ['no connection', null, 'not_found'], ['a website', { ...pending, platform: 'website' as const, shop_domain: null }, 'not_found'],
    ['a displaced claim', { ...pending, status: 'disconnected' as const, disconnected_reason: 'displaced' as const }, 'not_found'],
    ['an app-held shop', { ...pending, app_installed: true }, 'connection_conflict'],
  ])('refuses %s', async (_name, connection, code) => {
    await expect(checkPasteShop(connection, { kind: 'owner' }, { scan: found, now: NOW })).rejects.toMatchObject({ code });
    expect(found).not.toHaveBeenCalled();
  });

  it('maps a claim displaced or taken by the app meanwhile', async () => {
    m.render.mockResolvedValue('not_pending');
    await expect(checkPasteShop(pending, { kind: 'render' }, { scan: found, now: NOW })).rejects.toMatchObject({ code: 'not_found' });
    m.render.mockResolvedValue('recorded'); m.prove.mockResolvedValue('shopify_app_installed');
    await expect(checkPasteShop(pending, { kind: 'render' }, { scan: found, now: NOW })).rejects.toMatchObject({ code: 'connection_conflict' });
    m.begin.mockResolvedValue('shopify_app_installed');
    await expect(checkPasteShop(pending, { kind: 'owner' }, { scan: found, now: NOW })).rejects.toBeInstanceOf(PasteError);
  });
});

describe('a finding survives a later check that could not look (root cause 2)', () => {
  const foundAt = ago(5 * 60);
  const waiting = { ...pending, shop_check_outcome: 'awaiting_visit' as const, shop_checked_at: foundAt };

  it.each(['password_required', 'password_rejected', 'unreachable'] as const)(
    'keeps an unexpired finding, and its time, when the next check says %s', async (outcome) => {
      const result = await checkPasteShop(waiting, { kind: 'owner' }, { scan: async () => ({ outcome }), now: NOW });
      expect(result).toEqual({ shopProof: 'pending', shopProvenAt: null, outcome: 'awaiting_visit', checkedAt: foundAt, retryAfterSeconds: null });
      expect(m.finish).not.toHaveBeenCalled();
      expect(m.release).toHaveBeenCalledExactlyOnceWith(waiting);
      expect(vi.mocked(console.info)).toHaveBeenCalledWith('[paste] storefront check', expect.objectContaining({ outcome }));
    });

  it('keeps it when the owner is rate limited or another check holds the lease', async () => {
    m.begin.mockResolvedValue('busy');
    expect(await checkPasteShop(waiting, { kind: 'owner' }, { scan: found, now: NOW }))
      .toEqual({ shopProof: 'pending', shopProvenAt: null, outcome: 'awaiting_visit', checkedAt: foundAt, retryAfterSeconds: 10 });
    m.begin.mockResolvedValue('started');
    m.siteLimit.mockResolvedValue({ success: false, reset: NOW.getTime() + 42_000 });
    vi.useFakeTimers({ now: NOW });
    try {
      expect(await checkPasteShop(waiting, { kind: 'owner' }, { scan: found, now: NOW })).toMatchObject({ outcome: 'awaiting_visit', checkedAt: foundAt });
    } finally { vi.useRealTimers(); }
    expect(m.finish).not.toHaveBeenCalled();
  });

  it('lets the next render finish the proof after such a check', async () => {
    await checkPasteShop(waiting, { kind: 'owner' }, { scan: async () => ({ outcome: 'password_required' }), now: NOW });
    // The stored row is unchanged, so the render still completes the proof.
    expect((await checkPasteShop(waiting, { kind: 'render' }, { scan: found, now: NOW })).outcome).toBe('proven');
    expect(m.prove).toHaveBeenCalledExactlyOnceWith(waiting, { siteId: SITE, shopDomain: SHOP });
  });

  it.each(['not_found', 'wrong_site', 'outdated_code'] as const)('replaces the finding when a check positively finds %s', async (outcome) => {
    const result = await checkPasteShop(waiting, { kind: 'owner' }, { scan: async () => ({ outcome }), now: NOW });
    expect(result.outcome).toBe(outcome);
    expect(m.finish).toHaveBeenCalledExactlyOnceWith(waiting, outcome);
    expect(m.release).not.toHaveBeenCalled();
  });

  it('stores password_required once the finding has expired', async () => {
    const old = { ...waiting, shop_checked_at: ago(16 * 60) };
    expect((await checkPasteShop(old, { kind: 'render' }, { scan: async () => ({ outcome: 'password_required' }), now: NOW })).outcome)
      .toBe('password_required');
    expect(m.finish).toHaveBeenCalledExactlyOnceWith(old, 'password_required');
  });
});

describe('what a successful check tells the dashboard, and the connected email', () => {
  it('returns the product page and password page the check saw, without proving yet', async () => {
    m.prove.mockResolvedValue('render_required');
    found.mockImplementation(async () => ({ outcome: 'found', evidence, host: SHOP, productUrl: PRODUCT, passwordPage: true }));
    expect(await checkPasteShop(pending, { kind: 'owner', password: PASSWORD }, { scan: found, now: NOW })).toMatchObject({
      outcome: 'awaiting_visit', storefront: { productUrl: PRODUCT, passwordPage: true } });
    expect(m.email).not.toHaveBeenCalled();
  });

  it('schedules the connected email for the site the moment its shop is proven', async () => {
    await checkPasteShop(pending, { kind: 'render' }, { scan: found, now: NOW });
    expect(m.email).toHaveBeenCalledExactlyOnceWith(SITE, { path: 'shopify_paste', host: SHOP });
  });
});

describe('storefront password handling', () => {
  it('passes the password only to the scan and never into a result or a log', async () => {
    const logs = [vi.spyOn(console, 'log'), vi.spyOn(console, 'warn'), vi.spyOn(console, 'error'), vi.mocked(console.info)];
    const scan = vi.fn(async (): Promise<StorefrontScan> => ({ outcome: 'password_rejected' }));
    const result = await checkPasteShop(pending, { kind: 'owner', password: PASSWORD }, { scan, now: NOW });
    expect(result.outcome).toBe('password_rejected');
    expect(scan).toHaveBeenCalledWith(pending, expect.objectContaining({ password: PASSWORD }));
    expect(JSON.stringify(result)).not.toContain(PASSWORD);
    expect(JSON.stringify(m.finish.mock.calls)).not.toContain(PASSWORD);
    for (const spy of logs) expect(JSON.stringify(spy.mock.calls)).not.toContain(PASSWORD);
    expect(vi.mocked(console.info)).toHaveBeenCalledWith('[paste] storefront check', expect.objectContaining({ outcome: 'password_rejected' }));
  });

  it('rejects an implausibly long password without sending it anywhere', async () => {
    const scan = vi.fn(found);
    expect((await checkPasteShop(pending, { kind: 'owner', password: 'x'.repeat(257) }, { scan, now: NOW })).outcome).toBe('password_rejected');
    expect(scan).not.toHaveBeenCalled(); expect(m.siteLimit).not.toHaveBeenCalled();
  });
});
