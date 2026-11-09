// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ auto: vi.fn(), owner: vi.fn(), host: vi.fn(), list: vi.fn(), verify: vi.fn(), record: vi.fn(),
  grant: vi.fn(), platform: vi.fn(), site: vi.fn(), after: vi.fn() }));
vi.mock('@/lib/ratelimit', () => ({
  pasteDomainCheckAutoRatelimit: { configured: true, limit: m.auto },
  pasteDomainCheckOwnerRatelimit: { configured: true, limit: m.owner },
  pasteDomainCheckHostRatelimit: { configured: true, limit: m.host },
}));
vi.mock('./store', async (original) => {
  const actual = await original<typeof import('./store')>();
  return { normalizePasteDomain: actual.normalizePasteDomain, domainVerificationReason: actual.domainVerificationReason,
    listPasteDomains: m.list, verifyPasteDomain: m.verify, recordPasteDomainCheck: m.record, grantPasteDomainPlan: m.grant,
    recordPasteDomainPlatform: m.platform };
});
vi.mock('@/lib/messenger/db', () => ({ getMessengerServiceClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: m.site }) }) }) }) }));
vi.mock('next/server', () => ({ after: m.after }));

import { checkPasteDomain, checkPasteDomainForHost, schedulePasteDomainCheck } from './domain-check';
import { findSiteSnippet, scanDomainSnippet, type StorefrontTransport } from './storefront-scan';
import { PasteError, type PasteDomain } from './types';

const SITE = '11111111-1111-4111-8111-111111111111';
const KEY = 'gc_public_key_42';
const site = { id: SITE, embedKey: KEY };
const domain: PasteDomain = { id: 'domain-a', domain: 'merchant.example', state: 'trusted', domainVerified: false, verifiedAt: null,
  verificationReason: 'awaiting_code', check: null, firstSeenAt: null, lastSeenAt: null,
  proof: { txtName: '_grindctrl.merchant.example', txtValue: 'grindctrl-verification=x', meta: { name: 'grindctrl-verification', content: 'x' } } };
const snippet = (key = KEY) => `<script async src="https://grindctrl.cloud/widget/v1/messenger.js" data-key="${key}" data-gc-install="paste" data-gc-platform="website"></script>`;
const page = (body: string) => `<!doctype html><html><head><title>Shop</title></head><body><main>Dresses</main>${body}</body></html>`;

/** Our server's fetch of the domain's home page, answered from memory. */
function serve(html: string, status = 200): { scan: typeof scanDomainSnippet; transport: ReturnType<typeof vi.fn> } {
  const transport = vi.fn<StorefrontTransport>(async () => ({ status, location: null, contentType: 'text/html', setCookie: [],
    body: Buffer.from(html), headers: {} }));
  const lookup = async () => [{ address: '93.184.216.34', family: 4 }];
  return { transport, scan: (s, d) => scanDomainSnippet(s, d, { transport, lookup }) };
}
const allow = { success: true, reset: Date.now() + 1000 };

beforeEach(() => {
  vi.resetAllMocks();
  m.auto.mockResolvedValue(allow); m.owner.mockResolvedValue(allow); m.host.mockResolvedValue(allow);
  m.verify.mockResolvedValue({ ...domain, domainVerified: true, verificationReason: null });
  m.grant.mockResolvedValue('granted'); m.platform.mockResolvedValue(true); m.record.mockResolvedValue(undefined);
  m.list.mockResolvedValue([domain]);
  m.site.mockResolvedValue({ data: { id: SITE, embed_key: KEY, status: 'active' }, error: null });
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('findSiteSnippet', () => {
  it('finds only a real loader tag carrying this site\'s key', () => {
    expect(findSiteSnippet(page(snippet()), KEY)).toBe('found');
    expect(findSiteSnippet(page(snippet('gc_someone_else')), KEY)).toBe('wrong_site');
    expect(findSiteSnippet(page(''), KEY)).toBe('not_found');
  });
  it.each([
    ['a comment', `<!-- ${snippet()} -->`],
    ['JSON in a script', `<script type="application/json">{"html":"${snippet().replace(/"/g, '\\"')}"}</script>`],
    ['escaped text', snippet().replace(/</g, '&lt;').replace(/>/g, '&gt;')],
    ['a template', `<template>${snippet()}</template>`],
    ['a textarea (a shopper review)', `<textarea>${snippet()}</textarea>`],
    ['another host', snippet().replace('https://grindctrl.cloud', 'https://grindctrl.cloud.evil.example')],
    ['plain http', snippet().replace('https://', 'http://')],
    ['another path', snippet().replace('/widget/v1/messenger.js', '/widget/v1/other.js')],
    ['a repeated attribute', snippet().replace('data-key=', `data-key="${KEY}" data-key=`)],
  ])('never counts the key inside %s', (_name, body) => {
    expect(findSiteSnippet(page(body), KEY)).not.toBe('found');
  });
});

describe('checkPasteDomain', () => {
  it('verifies the domain when its page carries the snippet, then claims the plan once and fingerprints it', async () => {
    const { scan } = serve(page(snippet()));
    const result = await checkPasteDomain(site, domain, 'added', { scan });
    expect(result).toMatchObject({ outcome: 'verified', retryAfterSeconds: null, domain: { domainVerified: true } });
    expect(m.verify).toHaveBeenCalledExactlyOnceWith(SITE, expect.objectContaining({ siteId: SITE, domainId: 'domain-a' }));
    expect(m.grant).toHaveBeenCalledExactlyOnceWith(SITE, 'merchant.example');
    expect(m.verify.mock.invocationCallOrder[0]).toBeLessThan(m.grant.mock.invocationCallOrder[0]);
    expect(m.platform).toHaveBeenCalledWith(SITE, 'merchant.example', 'custom');
    expect(m.record).not.toHaveBeenCalled();
  });

  it.each([
    ['not_found', page('')],
    ['wrong_site', page(snippet('gc_someone_else'))],
  ] as const)('stays unverified when the page shows %s, with no plan', async (outcome, html) => {
    const result = await checkPasteDomain(site, domain, 'owner', { scan: serve(html).scan });
    expect(result.outcome).toBe(outcome);
    expect(result.domain).toMatchObject({ domainVerified: false, check: { outcome } });
    expect(m.record).toHaveBeenCalledExactlyOnceWith(SITE, 'domain-a', outcome);
    expect(m.verify).not.toHaveBeenCalled(); expect(m.grant).not.toHaveBeenCalled();
  });

  it('records an unreachable page (error status, private address) without verifying', async () => {
    expect((await checkPasteDomain(site, domain, 'owner', { scan: serve(page(snippet()), 503).scan })).outcome).toBe('unreachable');
    const privateScan: typeof scanDomainSnippet = (s, d) => scanDomainSnippet(s, d, { transport: vi.fn(), lookup: async () => [{ address: '10.0.0.7', family: 4 }] });
    expect((await checkPasteDomain(site, domain, 'owner', { scan: privateScan })).outcome).toBe('unreachable');
    expect(m.verify).not.toHaveBeenCalled();
  });

  it('lets a widget trigger one check per site and domain each ten minutes, and counts every check per host', async () => {
    const { scan, transport } = serve(page(''));
    await checkPasteDomain(site, domain, 'widget', { scan });
    expect(m.auto).toHaveBeenCalledWith(`paste-domain-check:auto:${SITE}:merchant.example`);
    expect(m.host).toHaveBeenCalledWith('paste-domain-check:host:merchant.example');
    expect(m.owner).not.toHaveBeenCalled();
    m.auto.mockResolvedValue({ success: false, reset: Date.now() + 9 * 60_000 });
    const limited = await checkPasteDomain(site, domain, 'widget', { scan });
    expect(limited).toMatchObject({ outcome: 'rate_limited' });
    expect(limited.retryAfterSeconds).toBeGreaterThan(500);
    expect(transport).toHaveBeenCalledTimes(1);
    // The owner's own check is counted separately.
    expect((await checkPasteDomain(site, domain, 'owner', { scan })).outcome).toBe('not_found');
    m.host.mockResolvedValue({ success: false, reset: Date.now() + 60_000 });
    expect((await checkPasteDomain(site, domain, 'owner', { scan })).outcome).toBe('rate_limited');
    expect(transport).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['throws', () => m.auto.mockRejectedValue(new Error('redis down'))],
    ['times out', () => m.auto.mockResolvedValue({ success: true, reason: 'timeout', reset: Date.now() })],
    ['host limiter fails', () => m.host.mockRejectedValue(new Error('redis down'))],
  ])('fails closed when the rate limiter %s: no fetch, no verification', async (_name, arrange) => {
    arrange();
    const { scan, transport } = serve(page(snippet()));
    await expect(checkPasteDomain(site, domain, 'widget', { scan })).rejects.toEqual(new PasteError('unavailable'));
    expect(transport).not.toHaveBeenCalled(); expect(m.verify).not.toHaveBeenCalled(); expect(m.grant).not.toHaveBeenCalled();
  });

  it('does not grant when verification itself fails in the database', async () => {
    m.verify.mockRejectedValue(new PasteError('unavailable'));
    await expect(checkPasteDomain(site, domain, 'owner', { scan: serve(page(snippet())).scan })).rejects.toEqual(new PasteError('unavailable'));
    expect(m.grant).not.toHaveBeenCalled();
  });
});

describe('checkPasteDomainForHost (widget trigger)', () => {
  it('checks a waiting domain, by its www alias too, with the key read from the database', async () => {
    const { scan } = serve(page(snippet()));
    expect(await checkPasteDomainForHost(SITE, 'www.merchant.example', { scan })).toMatchObject({ outcome: 'verified' });
    m.list.mockResolvedValue([{ ...domain, state: 'claimed', verificationReason: 'held_elsewhere' }]);
    expect(await checkPasteDomainForHost(SITE, 'merchant.example', { scan })).toMatchObject({ outcome: 'verified' });
  });

  it.each([
    ['a verified domain', [{ ...domain, domainVerified: true }]],
    ['a host another site proved', [{ ...domain, state: 'disputed' }]],
    ['an unknown host', []],
  ])('never fetches for %s', async (_name, rows) => {
    m.list.mockResolvedValue(rows);
    const { scan, transport } = serve(page(snippet()));
    expect(await checkPasteDomainForHost(SITE, 'merchant.example', { scan })).toBeNull();
    expect(transport).not.toHaveBeenCalled(); expect(m.auto).not.toHaveBeenCalled();
  });

  it('skips a disabled site and fails closed when the site cannot be read', async () => {
    const { scan, transport } = serve(page(snippet()));
    m.site.mockResolvedValue({ data: { id: SITE, embed_key: KEY, status: 'disabled' }, error: null });
    expect(await checkPasteDomainForHost(SITE, 'merchant.example', { scan })).toBeNull();
    m.site.mockResolvedValue({ data: null, error: { code: '500' } });
    await expect(checkPasteDomainForHost(SITE, 'merchant.example', { scan })).rejects.toEqual(new PasteError('unavailable'));
    expect(transport).not.toHaveBeenCalled();
  });

  it('schedules after the response and never throws into the request', async () => {
    schedulePasteDomainCheck(SITE, 'merchant.example');
    expect(m.after).toHaveBeenCalledTimes(1);
    m.list.mockRejectedValue(new PasteError('unavailable'));
    await expect(m.after.mock.calls[0][0]()).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledWith('[paste] domain check failed', expect.objectContaining({ site: SITE }));
    m.after.mockImplementation(() => { throw new Error('outside a request'); });
    expect(() => schedulePasteDomainCheck(SITE, 'merchant.example')).not.toThrow();
  });
});
