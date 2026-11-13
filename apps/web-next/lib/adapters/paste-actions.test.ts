// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ auth: vi.fn(), access: vi.fn(), limit: vi.fn(), enable: vi.fn(), add: vi.fn(), remove: vi.fn(), prove: vi.fn(), proveMeta: vi.fn(), rotate: vi.fn(),
  connection: vi.fn(), status: vi.fn(), invalidate: vi.fn(), check: vi.fn(), fingerprint: vi.fn(), domainCheck: vi.fn(), grant: vi.fn(), list: vi.fn(), audit: vi.fn(), privacy: vi.fn(), disconnect: vi.fn(), appInstalled: vi.fn(), woo: vi.fn() }));
vi.mock('@/lib/paste/privacy', () => ({ pasteShopperPrivacy: m.privacy }));
vi.mock('@/lib/woo/connection', () => ({ listActiveWooSiteIds: m.woo }));
vi.mock('@/lib/messenger/conversations', () => ({ recordAudit: m.audit }));
vi.mock('@/lib/paste/platform-check', () => ({ schedulePasteDomainPlatformCheck: m.fingerprint }));
vi.mock('@/lib/paste/domain-check', () => ({ checkPasteDomain: m.domainCheck }));
vi.mock('@clerk/nextjs/server', () => ({ auth: m.auth }));
vi.mock('@/lib/messenger/provisioning', async (original) => ({ ...await original<object>(), requireSiteAccess: m.access }));
vi.mock('@/lib/request-rate-limit', async (original) => ({ ...await original<object>(), requireMerchantRateLimit: m.limit }));
vi.mock('@/lib/paste/store', async (original) => ({ pasteTrust: (await original<typeof import('@/lib/paste/store')>()).pasteTrust,
  normalizePasteDomain: (await original<typeof import('@/lib/paste/store')>()).normalizePasteDomain, disconnectPasteInstall: m.disconnect,
  shopAppInstalled: m.appInstalled,
  enablePasteInstall: m.enable, addPasteDomain: m.add, removePasteDomain: m.remove,
  provePasteDomain: m.prove, provePasteDomainMeta: m.proveMeta, rotatePasteSecret: m.rotate, getPasteConnection: m.connection,
  grantPasteDomainPlan: m.grant, listPasteDomains: m.list }));
vi.mock('@/lib/paste/status', () => ({ readPasteInstallStatus: m.status }));
vi.mock('@/lib/paste/shop-proof', () => ({ checkPasteShop: m.check }));
vi.mock('@/lib/shopify/proxy-config-cache', () => ({ invalidateProxyConfig: m.invalidate }));
import { enablePasteInstallAction, addPasteDomainAction, removePasteDomainAction, provePasteDomainAction, provePasteDomainMetaAction, rotatePasteSecretAction, getPasteSnippetAction, getPasteInstallStatusAction, provePasteShopAction, checkPasteDomainAction, pastePrivacyRequestAction, disconnectPasteInstallAction } from '@/app/dashboard/store-chat/paste-actions';
import { PasteError } from '@/lib/paste/types';
import { UnauthorizedError } from '@/lib/messenger/provisioning';
import { RoleNotAllowedError } from '@/lib/rbac/dashboard-policy';
import { RequestRateLimitError } from '@/lib/request-rate-limit';
const SITE = '11111111-1111-4111-8111-111111111111';
const site = { id: SITE, embed_key: 'gc_public_123456', status: 'active', role: 'owner' };
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv('GRINDCTRL_CAPABILITY_SECRET', 'test-only-independent-core-secret-at-least-32-bytes');
  m.auth.mockResolvedValue({ userId: 'owner' }); m.access.mockResolvedValue(site); m.limit.mockResolvedValue(undefined);
  m.connection.mockResolvedValue({ widget_site_id: SITE, platform: 'shopify', shop_domain: 'merchant.myshopify.com', secret_version: 1, status: 'active',
    shop_proven_at: '2026-11-08T00:00:00Z', app_installed: false });
  m.rotate.mockResolvedValue({ version: 2, overlapUntil: '2026-11-08T15:15:00Z' });
  m.add.mockResolvedValue({ id: 'domain-a', domain: 'merchant.example', state: 'claimed' });
});
afterEach(() => vi.unstubAllEnvs());
describe('owner-authorized paste plumbing actions', () => {
  it('requires the store capability before either privacy operation', async () => {
    m.privacy.mockResolvedValue({ done: true });
    expect(await pastePrivacyRequestAction(SITE, 'erase', { email: 'a@example.com' })).toEqual({ ok: true, data: { done: true } });
    expect(m.access).toHaveBeenCalledWith('owner', SITE, 'store');
    expect(m.privacy).toHaveBeenCalledWith(SITE, 'erase', { email: 'a@example.com' });
    m.privacy.mockClear();
    m.access.mockRejectedValue(new RoleNotAllowedError('store'));
    expect(await pastePrivacyRequestAction(SITE, 'export', {})).toMatchObject({ ok: false, code: 'forbidden' });
    expect(m.privacy).not.toHaveBeenCalled();
  });

  it('audits domain changes and key rotation with actor and target, excluding secrets', async () => {
    await addPasteDomainAction(SITE, 'merchant.example');
    await removePasteDomainAction(SITE, 'domain-a');
    await rotatePasteSecretAction(SITE);
    expect(m.audit).toHaveBeenCalledWith({ siteId: SITE, actorClerkUserId: 'owner', action: 'trusted_domain_added', detail: { domain_id: 'domain-a', domain: 'merchant.example', state: 'claimed' } });
    expect(m.audit).toHaveBeenCalledWith({ siteId: SITE, actorClerkUserId: 'owner', action: 'trusted_domain_removed', detail: { domain_id: 'domain-a' } });
    expect(m.audit).toHaveBeenCalledWith({ siteId: SITE, actorClerkUserId: 'owner', action: 'site_key_regenerated', detail: { version: 2 } });
  });
  it('creates a site tenant without granting credits or changing visible setup', async () => {
    expect(await enablePasteInstallAction(SITE, 'shopify', 'Merchant.MyShopify.com')).toEqual({ ok: true, data: { tenantKey: `site:${SITE}` } });
    expect(m.access).toHaveBeenCalledWith('owner', SITE, 'store');
    expect(m.enable).toHaveBeenCalledExactlyOnceWith(SITE, 'shopify', 'merchant.myshopify.com');
  });
  it('allows the owner to enable another shop while the privacy trigger has disabled serving', async () => {
    m.access.mockResolvedValue({ ...site, status: 'disabled' });
    expect(await enablePasteInstallAction(SITE, 'shopify', 'another.myshopify.com'))
      .toEqual({ ok: true, data: { tenantKey: `site:${SITE}` } });
    expect(m.access).toHaveBeenCalledWith('owner', SITE, 'store');
    expect(m.limit).toHaveBeenCalledWith(`paste:${SITE}:owner`, 'write');
    expect(m.enable).toHaveBeenCalledExactlyOnceWith(SITE, 'shopify', 'another.myshopify.com');
    expect(m.invalidate).toHaveBeenCalledWith(`site:${SITE}`);
  });
  it('rejects unknown platforms and invalid Shopify domains', async () => {
    expect(await enablePasteInstallAction(SITE, 'shopify', 'attacker.example')).toMatchObject({ ok: false, code: 'invalid_platform' });
    expect(m.enable).not.toHaveBeenCalled();
  });
  it.each([
    ['add', () => addPasteDomainAction(SITE, 'merchant.example')], ['remove', () => removePasteDomainAction(SITE, 'domain-a')],
    ['proof', () => provePasteDomainAction(SITE, 'domain-a')], ['rotate', () => rotatePasteSecretAction(SITE)],
    ['meta proof', () => provePasteDomainMetaAction(SITE, 'domain-a')],
    ['snippet', () => getPasteSnippetAction(SITE)], ['status', () => getPasteInstallStatusAction(SITE)],
    ['shop proof', () => provePasteShopAction(SITE, 'pw')], ['domain check', () => checkPasteDomainAction(SITE, 'domain-a')],
    ['disconnect', () => disconnectPasteInstallAction(SITE)],
  ] as const)('rejects unauthenticated and foreign site %s before any service mutation/read', async (_name, action) => {
    // Signed out is still refused, and says so for the sign-in prompt.
    m.auth.mockResolvedValue({ userId: null }); expect(await action()).toEqual({ ok: false, code: 'forbidden', signedOut: true });
    expect(m.access).not.toHaveBeenCalled();
    m.auth.mockResolvedValue({ userId: 'other' }); m.access.mockRejectedValue(new UnauthorizedError());
    expect(await action()).toEqual({ ok: false, code: 'forbidden' });
    for (const method of [m.add, m.remove, m.prove, m.proveMeta, m.rotate, m.connection, m.status, m.check, m.domainCheck, m.list, m.grant, m.disconnect]) {
      expect(method).not.toHaveBeenCalled();
    }
  });
  it('keeps secrets/snippets owner-only, even for admins who may manage settings', async () => {
    m.access.mockImplementation(async (_user, _site, capability) => {
      if (capability === 'store') throw new RoleNotAllowedError('store'); return { ...site, role: 'admin' };
    });
    expect(await getPasteSnippetAction(SITE)).toEqual({ ok: false, code: 'forbidden' });
    expect(await rotatePasteSecretAction(SITE)).toEqual({ ok: false, code: 'forbidden' });
    expect(await provePasteShopAction(SITE)).toEqual({ ok: false, code: 'forbidden' });
    expect(m.check).not.toHaveBeenCalled();
    expect((await addPasteDomainAction(SITE, 'merchant.example')).ok).toBe(true);
    expect(m.connection).not.toHaveBeenCalled();
  });
  it('looks for the code as soon as a domain is added, and still adds it when the check cannot run', async () => {
    const added = { id: 'domain-a', domain: 'merchant.example', state: 'trusted', domainVerified: false };
    const confirmed = { ...added, domainVerified: true };
    m.add.mockResolvedValue(added);
    m.domainCheck.mockResolvedValue({ domain: confirmed, outcome: 'verified', retryAfterSeconds: null });
    expect(await addPasteDomainAction(SITE, 'merchant.example')).toEqual({ ok: true, data: confirmed });
    expect(m.domainCheck).toHaveBeenCalledExactlyOnceWith({ id: SITE, embedKey: site.embed_key }, added, 'added');
    m.domainCheck.mockRejectedValue(new PasteError('unavailable'));
    expect(await addPasteDomainAction(SITE, 'merchant.example')).toEqual({ ok: true, data: added });
    // A host another site proved stays the owner's call: no check on add.
    m.domainCheck.mockClear(); m.add.mockResolvedValue({ ...added, state: 'disputed' });
    await addPasteDomainAction(SITE, 'merchant.example');
    expect(m.domainCheck).not.toHaveBeenCalled();
    // No fingerprint or plan from merely adding: the check does both once it finds the code.
    expect(m.fingerprint).not.toHaveBeenCalled(); expect(m.grant).not.toHaveBeenCalled();
  });
  it('checks one domain for the owner, reusing a confirmed result, and refuses another site\'s domain', async () => {
    const waiting = { id: 'domain-a', domain: 'merchant.example', state: 'trusted', domainVerified: false };
    m.list.mockResolvedValue([waiting]);
    m.domainCheck.mockResolvedValue({ domain: waiting, outcome: 'not_found', retryAfterSeconds: null });
    expect(await checkPasteDomainAction(SITE, 'domain-a')).toEqual({ ok: true, data: { domain: waiting, outcome: 'not_found', retryAfterSeconds: null } });
    expect(m.domainCheck).toHaveBeenCalledWith({ id: SITE, embedKey: site.embed_key }, waiting, 'owner');
    expect(m.access).toHaveBeenCalledWith('owner', SITE, 'settings');
    expect(await checkPasteDomainAction(SITE, 'domain-b')).toEqual({ ok: false, code: 'not_found' });
    m.domainCheck.mockClear(); m.list.mockResolvedValue([{ ...waiting, domainVerified: true }]);
    expect(await checkPasteDomainAction(SITE, 'domain-a')).toMatchObject({ ok: true, data: { outcome: 'verified' } });
    expect(m.domainCheck).not.toHaveBeenCalled();
  });
  it('claims the plan and fingerprints a domain proven by DNS or meta tag, never a failed proof', async () => {
    const domain = (state: string) => ({ id: 'domain-a', domain: 'merchant.example', state, domainVerified: state === 'trusted' });
    m.prove.mockResolvedValue(domain('trusted')); m.proveMeta.mockResolvedValue(domain('trusted'));
    await provePasteDomainAction(SITE, 'domain-a'); await provePasteDomainMetaAction(SITE, 'domain-a');
    expect(m.fingerprint).toHaveBeenCalledTimes(2);
    expect(m.grant).toHaveBeenCalledWith(SITE, 'merchant.example');
    m.prove.mockRejectedValue(new PasteError('proof_failed'));
    expect(await provePasteDomainAction(SITE, 'domain-a')).toEqual({ ok: false, code: 'proof_failed' });
    expect(m.fingerprint).toHaveBeenCalledTimes(2); expect(m.grant).toHaveBeenCalledTimes(2);
  });
  it('returns rotation metadata and no secret, with the same authorized site scope', async () => {
    const result = await rotatePasteSecretAction(SITE);
    expect(result).toEqual({ ok: true, data: { version: 2, overlapUntil: '2026-11-08T15:15:00Z' } });
    expect(m.rotate).toHaveBeenCalledWith(SITE); expect(JSON.stringify(result)).not.toContain('secret');
  });
  it('fails closed on Redis failures before snippet disclosure or mutation', async () => {
    m.limit.mockRejectedValue(new RequestRateLimitError(503, 30));
    expect(await getPasteSnippetAction(SITE)).toEqual({ ok: false, code: 'unavailable', retryAfterSeconds: 30 });
    expect(await addPasteDomainAction(SITE, 'merchant.example')).toMatchObject({ ok: false, code: 'unavailable' });
    expect(m.connection).not.toHaveBeenCalled(); expect(m.add).not.toHaveBeenCalled();
  });
  it('returns the secret only inside the snippet result, never during status', async () => {
    const result = await getPasteSnippetAction(SITE);
    expect(result.ok && result.data.snippet).toContain('hmac_sha256');
    expect(m.limit).toHaveBeenCalledWith(`paste:${SITE}:owner`, 'read');
    m.status.mockResolvedValue({ siteId: SITE, domains: [], connected: true });
    expect(await getPasteInstallStatusAction(SITE)).toEqual({ ok: true, data: { siteId: SITE, domains: [], connected: true } });
  });
  it('checks the store for its owner, passing the storefront password through once and never echoing it', async () => {
    const pending = { widget_site_id: SITE, platform: 'shopify', shop_domain: 'merchant.myshopify.com', secret_version: 1, status: 'pending',
      shop_proven_at: null, app_installed: false };
    m.connection.mockResolvedValue(pending);
    const proof = { shopProof: 'pending', shopProvenAt: null, outcome: 'password_rejected', checkedAt: '2026-11-08T15:00:00.000Z', retryAfterSeconds: 30 };
    m.check.mockResolvedValue(proof);
    const result = await provePasteShopAction(SITE, 'hunter2-storefront');
    expect(result).toEqual({ ok: true, data: proof });
    expect(JSON.stringify(result)).not.toContain('hunter2');
    expect(m.access).toHaveBeenCalledWith('owner', SITE, 'store');
    expect(m.limit).toHaveBeenCalledWith(`paste:${SITE}:owner`, 'write');
    expect(m.check).toHaveBeenCalledExactlyOnceWith(pending, { kind: 'owner', password: 'hunter2-storefront' });
    await provePasteShopAction(SITE, '');
    expect(m.check).toHaveBeenLastCalledWith(pending, { kind: 'owner', password: undefined });
    await provePasteShopAction(SITE, 42 as unknown as string);
    expect(m.check).toHaveBeenLastCalledWith(pending, { kind: 'owner', password: undefined });
  });
  it('adds the custom domain the shop sent our check to, audited like Add, and says so (B2)', async () => {
    const found = { shopProof: 'pending', shopProvenAt: null, outcome: 'awaiting_visit', checkedAt: '2026-11-08T15:00:00.000Z', retryAfterSeconds: null,
      storefront: { productUrl: 'https://www.brand.com/products/dress', passwordPage: false, primaryHost: 'www.brand.com' } };
    const added = { id: 'domain-b', domain: 'brand.com', state: 'trusted', domainVerified: false };
    m.check.mockResolvedValue(found); m.list.mockResolvedValue([]); m.add.mockResolvedValue(added);
    m.domainCheck.mockResolvedValue({ domain: { ...added, domainVerified: true }, outcome: 'verified', retryAfterSeconds: null });
    expect(await provePasteShopAction(SITE)).toEqual({ ok: true, data: { ...found, storefront: { ...found.storefront, addedDomain: 'brand.com' } } });
    expect(m.add).toHaveBeenCalledExactlyOnceWith(SITE, 'brand.com');
    expect(m.audit).toHaveBeenCalledWith({ siteId: SITE, actorClerkUserId: 'owner', action: 'trusted_domain_added',
      detail: { domain_id: 'domain-b', domain: 'brand.com', state: 'trusted', source: 'shop_check' } });
    expect(m.domainCheck).toHaveBeenCalledExactlyOnceWith({ id: SITE, embedKey: site.embed_key }, added, 'added');

    // Behind its password page the home page shows only the form: leave it to the automatic check.
    m.domainCheck.mockClear();
    m.check.mockResolvedValue({ ...found, storefront: { ...found.storefront, passwordPage: true } });
    expect(await provePasteShopAction(SITE)).toMatchObject({ ok: true, data: { storefront: { addedDomain: 'brand.com' } } });
    expect(m.domainCheck).not.toHaveBeenCalled();

    // Already there, or the add is refused: nothing added, the check result stands.
    m.add.mockClear(); m.list.mockResolvedValue([added]);
    expect(await provePasteShopAction(SITE)).toMatchObject({ ok: true, data: { outcome: 'awaiting_visit', storefront: { addedDomain: null } } });
    expect(m.add).not.toHaveBeenCalled();
    m.list.mockResolvedValue([]); m.add.mockRejectedValue(new PasteError('limit_reached'));
    vi.spyOn(console, 'error').mockImplementationOnce(() => {});
    expect(await provePasteShopAction(SITE)).toMatchObject({ ok: true, data: { outcome: 'awaiting_visit', storefront: { addedDomain: null } } });

    // The shop host itself is no custom domain.
    m.add.mockClear();
    m.check.mockResolvedValue({ ...found, storefront: { productUrl: null, passwordPage: false, primaryHost: null } });
    await provePasteShopAction(SITE);
    expect(m.add).not.toHaveBeenCalled();
  });

  it('maps proof refusals to their codes without leaking the password', async () => {
    m.check.mockRejectedValue(new PasteError('connection_conflict'));
    expect(await provePasteShopAction(SITE, 'hunter2-storefront')).toEqual({ ok: false, code: 'connection_conflict' });
    m.check.mockRejectedValue(new Error('boom hunter2-storefront'));
    expect(await provePasteShopAction(SITE, 'hunter2-storefront')).toEqual({ ok: false, code: 'unavailable' });
  });
  it('disconnects the pasted install for its owner only, with an audit row (B5)', async () => {
    m.disconnect.mockResolvedValue({ platform: 'shopify', shopDomain: 'typo.myshopify.com' });
    expect(await disconnectPasteInstallAction(SITE)).toEqual({ ok: true, data: null });
    expect(m.access).toHaveBeenCalledWith('owner', SITE, 'store');
    expect(m.limit).toHaveBeenCalledWith(`paste:${SITE}:owner`, 'write');
    expect(m.disconnect).toHaveBeenCalledExactlyOnceWith(SITE);
    expect(m.audit).toHaveBeenCalledExactlyOnceWith({ siteId: SITE, actorClerkUserId: 'owner', action: 'store_disconnected',
      detail: { install: 'paste', platform: 'shopify', shop_domain: 'typo.myshopify.com' } });

    // An admin may manage settings but not undo the store.
    m.disconnect.mockClear(); m.audit.mockClear();
    m.access.mockRejectedValueOnce(new RoleNotAllowedError('store'));
    expect(await disconnectPasteInstallAction(SITE)).toEqual({ ok: false, code: 'forbidden' });
    expect(m.disconnect).not.toHaveBeenCalled();

    // Nothing connected, or the migration not run yet: a plain answer, no audit row.
    m.disconnect.mockRejectedValueOnce(new PasteError('not_found'));
    expect(await disconnectPasteInstallAction(SITE)).toEqual({ ok: false, code: 'not_found' });
    m.disconnect.mockRejectedValueOnce(new PasteError('schema_not_ready'));
    expect(await disconnectPasteInstallAction(SITE)).toEqual({ ok: false, code: 'unavailable' });
    expect(m.audit).not.toHaveBeenCalled();
  });

  it('says which connection holds the store when enabling is refused (m4)', async () => {
    m.enable.mockRejectedValue(new PasteError('connection_conflict'));
    m.woo.mockResolvedValue(new Set()); m.appInstalled.mockResolvedValue(false);
    m.connection.mockResolvedValue({ widget_site_id: SITE, platform: 'website', shop_domain: null, status: 'active', app_installed: false });
    expect(await enablePasteInstallAction(SITE, 'shopify', 'other.myshopify.com')).toEqual({ ok: false, code: 'connection_conflict',
      heldBy: { kind: 'paste', platform: 'website', store: null } });
    m.connection.mockResolvedValue({ widget_site_id: SITE, platform: 'shopify', shop_domain: 'typo.myshopify.com', status: 'pending', app_installed: false });
    expect(await enablePasteInstallAction(SITE, 'website')).toMatchObject({ heldBy: { kind: 'paste', platform: 'shopify', store: 'typo.myshopify.com' } });
    m.connection.mockResolvedValue(null);
    m.woo.mockResolvedValue(new Set([SITE]));
    expect(await enablePasteInstallAction(SITE, 'website')).toMatchObject({ heldBy: { kind: 'woocommerce' } });
    m.woo.mockResolvedValue(new Set()); m.appInstalled.mockResolvedValue(true);
    expect(await enablePasteInstallAction(SITE, 'shopify', 'app.myshopify.com')).toMatchObject({ heldBy: { kind: 'shopify_app', store: 'app.myshopify.com' } });
    expect(m.appInstalled).toHaveBeenCalledWith('app.myshopify.com');
    // Cannot tell: the plain refusal, never a guess.
    m.appInstalled.mockResolvedValue(false);
    expect(await enablePasteInstallAction(SITE, 'shopify', 'x.myshopify.com')).toEqual({ ok: false, code: 'connection_conflict' });
    m.connection.mockRejectedValue(new PasteError('unavailable'));
    expect(await enablePasteInstallAction(SITE, 'website')).toEqual({ ok: false, code: 'connection_conflict' });
    // Any other refusal reads nothing more.
    m.connection.mockClear(); m.enable.mockRejectedValue(new PasteError('invalid_platform'));
    expect(await enablePasteInstallAction(SITE, 'website')).toEqual({ ok: false, code: 'invalid_platform' });
    expect(m.connection).not.toHaveBeenCalled();
  });

  it('gives a pending Shopify shop its snippet (pasting it is the proof) but not a shop the app holds', async () => {
    const pending = { widget_site_id: SITE, platform: 'shopify', shop_domain: 'merchant.myshopify.com', secret_version: 1, status: 'pending',
      shop_proven_at: null, app_installed: false };
    m.connection.mockResolvedValue(pending);
    expect((await getPasteSnippetAction(SITE)).ok).toBe(true);
    m.connection.mockResolvedValue({ ...pending, app_installed: true });
    expect(await getPasteSnippetAction(SITE)).toEqual({ ok: false, code: 'connection_conflict' });
    m.connection.mockResolvedValue({ ...pending, status: 'disconnected', disconnected_reason: 'displaced' });
    expect(await getPasteSnippetAction(SITE)).toEqual({ ok: false, code: 'not_found' });
  });
});
