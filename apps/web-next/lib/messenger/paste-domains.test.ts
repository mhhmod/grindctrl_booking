// @vitest-environment node
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ rpc: vi.fn(), rows: [] as Array<Record<string, unknown>>, error: null as null | { code: string },
  installError: null as null | { code: string } }));
vi.mock('@/lib/messenger/db', () => ({ getMessengerServiceClient: () => ({
  rpc: m.rpc,
  from: (table: string) => {
    const filters: Array<(row: Record<string, unknown>) => boolean> = [];
    const result = () => ({ data: m.rows.filter((r) => filters.every((f) => f(r))),
      error: table === 'shopify_installations' ? m.installError : m.error });
    const b = { select: () => b, eq: (k: string, v: unknown) => { filters.push((r) => r[k] === v); return b; },
      neq: (k: string, v: unknown) => { filters.push((r) => r[k] !== v); return b; },
      in: (k: string, v: unknown[]) => { filters.push((r) => v.includes(r[k])); return b; }, order: () => b, limit: () => b,
      maybeSingle: async () => ({ ...result(), data: result().data[0] ?? null }),
      then: (resolve: (value: unknown) => void) => resolve(result()) };
    return b;
  },
}) }));
import { addPasteDomain, listPasteDomains, provePasteDomain, removePasteDomain, normalizePasteDomain, recordPasteSignal, getPasteConnection,
  pasteProofHosts, pasteShopHost, pasteTrust, pasteTrustedHosts, provePasteShop, recordPasteShopRender, beginPasteShopCheck,
  finishPasteShopCheck } from '@/lib/paste/store';
import type { PasteConnection } from '@/lib/paste/types';
import type { StorefrontEvidence } from '@/lib/paste/storefront-scan';
import { decideOrigin } from './origins';
const SITE = '11111111-1111-4111-8111-111111111111';
const row = { id: 'domain-a', widget_site_id: SITE, domain: 'merchant.example', verification_status: 'trusted', verification_method: 'paste_trusted',
  verification_token: 'abcdefghijklmnopqrstuvwx', first_seen_at: null, last_seen_at: null };
beforeEach(() => { vi.resetAllMocks(); m.rows = []; m.error = null; m.installError = null; m.rpc.mockResolvedValue({ data: { code: 'ok', domain: row }, error: null }); });
afterEach(() => vi.restoreAllMocks());

describe('trusted domain lifecycle boundary', () => {
  it.each([
    [' HTTPS://WWW.Merchant.Example/products/tee?q=1 ', 'merchant.example'],
    ['merchant.example.', 'merchant.example'], ['www.متجر.مصر/path', 'xn--pgbep1f.xn--wgbh1c'],
  ])('normalizes %s to %s', (raw, host) => expect(normalizePasteDomain(raw)).toBe(host));
  it.each(['localhost', '127.0.0.1', '*.example.com', 'https://user:pass@example.com', 'example.com:8443', 'other.myshopify.com', 'grindctrl.cloud'])('rejects %s', async (host) => {
    await expect(addPasteDomain(SITE, host)).rejects.toMatchObject({ code: 'invalid_domain' }); expect(m.rpc).not.toHaveBeenCalled();
  });
  it('trusts a newly available domain without a DNS call or a credit grant', async () => {
    expect(await addPasteDomain(SITE, 'https://www.merchant.example/a')).toMatchObject({ state: 'trusted', firstSeenAt: null, lastSeenAt: null });
    expect(m.rpc).toHaveBeenCalledExactlyOnceWith('paste_domain_operation', expect.objectContaining({ p_site: SITE, p_operation: 'add', p_domain: 'merchant.example' }));
  });
  it('returns the collision proof path without treating a claimed domain as trusted', async () => {
    m.rpc.mockResolvedValue({ data: { code: 'ok', domain: { ...row, verification_status: 'pending', verification_method: 'paste_dns_txt' } }, error: null });
    expect(await addPasteDomain(SITE, 'merchant.example')).toMatchObject({ state: 'claimed', proof: {
      txtName: '_grindctrl-verification.merchant.example', txtValue: 'grindctrl-verification=abcdefghijklmnopqrstuvwx',
    } });
  });
  it('requires the exact current DNS token and uses a site-scoped dispute operation', async () => {
    m.rows = [{ ...row, verification_status: 'pending', verification_method: 'paste_dns_txt' }];
    await expect(provePasteDomain(SITE, row.id, async () => [['grindctrl-verification=wrong']])).rejects.toMatchObject({ code: 'proof_failed' });
    expect(m.rpc).not.toHaveBeenCalled();
    expect(await provePasteDomain(SITE, row.id, async () => [['grindctrl-verification=abcdefghijklmnopqrstuvwx']])).toMatchObject({ state: 'trusted' });
    expect(m.rpc).toHaveBeenCalledWith('paste_domain_operation', expect.objectContaining({ p_site: SITE, p_domain_id: row.id, p_token: row.verification_token, p_operation: 'prove' }));
  });
  it('isolates domain reads/proofs and scopes removal to the authorized site', async () => {
    m.rows = [{ ...row, widget_site_id: 'other-site' }];
    expect(await listPasteDomains(SITE)).toEqual([]);
    await expect(provePasteDomain(SITE, row.id, async () => [['grindctrl-verification=abcdefghijklmnopqrstuvwx']])).rejects.toMatchObject({ code: 'not_found' });
    await removePasteDomain(SITE, row.id);
    expect(m.rpc).toHaveBeenCalledWith('paste_domain_operation', expect.objectContaining({ p_site: SITE, p_domain_id: row.id, p_operation: 'remove' }));
  });
  it('reports the atomic five-domain ceiling and a failed proof fence', async () => {
    m.rpc.mockResolvedValue({ data: { code: 'limit_reached' }, error: null });
    await expect(addPasteDomain(SITE, 'six.example')).rejects.toMatchObject({ code: 'limit_reached' });
    m.rows = [row]; m.rpc.mockResolvedValue({ data: { code: 'proof_failed' }, error: null });
    await expect(provePasteDomain(SITE, row.id, async () => [['grindctrl-verification=abcdefghijklmnopqrstuvwx']])).rejects.toMatchObject({ code: 'proof_failed' });
  });
  it('tolerates the absent migration for old installs and reports it for new writes', async () => {
    m.error = { code: '42P01' }; expect(await getPasteConnection(SITE)).toBeNull();
    m.rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202' } });
    expect(await recordPasteSignal(SITE, 'https://merchant.example')).toBe('ignored');
    await expect(addPasteDomain(SITE, 'merchant.example')).rejects.toMatchObject({ code: 'schema_not_ready' });
  });
});

describe('observed-origin signal and apex grant', () => {
  it('only submits an https production host, normalized to its apex, after the origin gate', async () => {
    m.rpc.mockResolvedValue({ data: 'granted', error: null });
    expect(await recordPasteSignal(SITE, 'https://www.shop.example.co.uk')).toBe('granted');
    expect(m.rpc).toHaveBeenCalledWith('record_paste_install_signal', { p_site: SITE, p_domain: 'shop.example.co.uk', p_apex: 'example.co.uk', p_signed: false });
    m.rpc.mockClear();
    expect(await recordPasteSignal(SITE, 'http://merchant.example')).toBe('ignored');
    expect(await recordPasteSignal(SITE, 'https://localhost')).toBe('ignored');
    expect(m.rpc).not.toHaveBeenCalled();
  });
  it('submits a .myshopify.com shop host as its own apex, never myshopify.com', async () => {
    m.rpc.mockResolvedValue({ data: 'granted', error: null });
    expect(await recordPasteSignal(SITE, 'https://merchant.myshopify.com')).toBe('granted');
    expect(m.rpc).toHaveBeenCalledWith('record_paste_install_signal', { p_site: SITE, p_domain: 'merchant.myshopify.com', p_apex: 'merchant.myshopify.com', p_signed: false });
    m.rpc.mockClear();
    expect(await recordPasteSignal(SITE, 'https://merchant.myshopify.com', { signed: true })).toBe('granted');
    expect(m.rpc).toHaveBeenCalledWith('record_paste_install_signal', expect.objectContaining({ p_signed: true }));
    m.rpc.mockClear();
    for (const origin of ['https://myshopify.com', 'http://merchant.myshopify.com', 'https://merchant.myshopify.com:8443', 'https://a.b.myshopify.com']) {
      expect(await recordPasteSignal(SITE, origin)).toBe('ignored');
    }
    expect(m.rpc).not.toHaveBeenCalled();
  });
  it.each(['granted', 'apex_taken', 'recorded', 'ignored', 'unavailable'])('preserves the atomic grant result %s', async (result) => {
    m.rpc.mockResolvedValue({ data: result, error: null });
    expect(await recordPasteSignal(SITE, 'https://merchant.example')).toBe(result);
  });
  it('denies unknown or failed grant results', async () => {
    m.rpc.mockResolvedValue({ data: true, error: null });
    expect(await recordPasteSignal(SITE, 'https://merchant.example')).toBe('unavailable');
    m.rpc.mockRejectedValue(new Error('DB outage'));
    expect(await recordPasteSignal(SITE, 'https://merchant.example')).toBe('unavailable');
  });
});

describe('origin authorization after trust and disputes', () => {
  const trusted = { pattern: 'merchant.example', verification_status: 'trusted', verification_method: 'paste_trusted', environment: 'production' };
  it('admits only the exact host and its www alias, not all subdomains', () => {
    for (const origin of ['https://merchant.example', 'https://www.merchant.example']) expect(decideOrigin({ origin, patterns: [trusted], security: {} }).allowed).toBe(true);
    for (const origin of ['https://evil.example', 'https://sub.merchant.example', 'http://merchant.example', 'https://merchant.example:8443']) expect(decideOrigin({ origin, patterns: [trusted], security: {} }).allowed).toBe(false);
  });
  it('admits the connection shop host exactly like a trusted row, with no widget_domains row', () => {
    const allowed = (origin: string, pasteShopDomain: string | null = 'merchant.myshopify.com') =>
      decideOrigin({ origin, patterns: [], security: {}, pasteShopDomain }).allowed;
    expect(allowed('https://merchant.myshopify.com')).toBe(true);
    for (const origin of ['https://other.myshopify.com', 'https://www.merchant.myshopify.com', 'http://merchant.myshopify.com',
      'https://merchant.myshopify.com:8443']) expect(allowed(origin)).toBe(false);
    expect(allowed('https://merchant.myshopify.com', null)).toBe(false);
  });
  it.each(['paste_disputed', 'paste_removed'])('revokes legacy implicit and wildcard allowances for %s', (method) => {
    expect(decideOrigin({ origin: 'https://www.merchant.example', siteDomain: 'www.merchant.example', security: {},
      patterns: [{ ...trusted, verification_method: method, verification_status: method === 'paste_removed' ? 'disabled' : 'disputed' },
        { pattern: '*.merchant.example', verification_status: 'verified', environment: 'production' }] }).allowed).toBe(false);
  });
});

describe('trusted hosts include the signed shop', () => {
  const shop: PasteConnection = { widget_site_id: SITE, platform: 'shopify', shop_domain: 'merchant.myshopify.com', status: 'active',
    secret_version: 1, previous_secret_version: null, previous_valid_until: null, first_seen_at: null, last_seen_at: null,
    shop_proven_at: '2026-11-08T00:00:00.000Z', disconnected_reason: null, shop_render_at: null, shop_check_outcome: null,
    shop_checked_at: null, app_installed: false };
  it('returns the shop host for a store with no domain rows, plus trusted rows and their www alias', async () => {
    expect(pasteShopHost(shop)).toBe('merchant.myshopify.com');
    expect(await pasteTrustedHosts(shop)).toEqual(['merchant.myshopify.com']);
    m.rows = [row, { ...row, id: 'domain-b', domain: 'claimed.example', verification_status: 'pending', verification_method: 'paste_dns_txt' }];
    expect(await pasteTrustedHosts(shop)).toEqual(['merchant.myshopify.com', 'merchant.example', 'www.merchant.example']);
  });
  it('trusts nothing for a disconnected connection and no shop host for a website', async () => {
    m.rows = [row];
    expect(await pasteTrustedHosts({ ...shop, status: 'disconnected' })).toEqual([]);
    expect(pasteShopHost({ ...shop, status: 'disconnected' })).toBeNull();
    expect(await pasteTrustedHosts({ ...shop, platform: 'website', shop_domain: null })).toEqual(['merchant.example', 'www.merchant.example']);
  });
  it('trusts nothing for a pending shop or one the Shopify app holds; a pending shop may only prove from its own hosts', async () => {
    m.rows = [row];
    const pending: PasteConnection = { ...shop, status: 'pending', shop_proven_at: null };
    expect(pasteTrust(pending)).toBe('shop_proof_pending');
    expect(pasteShopHost(pending)).toBeNull();
    expect(await pasteTrustedHosts(pending)).toEqual([]);
    expect(await pasteProofHosts(pending)).toEqual(['merchant.myshopify.com', 'merchant.example', 'www.merchant.example']);
    expect(await pasteProofHosts(shop)).toEqual([]);
    for (const held of [{ ...shop, app_installed: true }, { ...pending, app_installed: true }]) {
      expect(pasteTrust(held)).toBe('shopify_app_installed');
      expect(pasteShopHost(held)).toBeNull();
      expect(await pasteTrustedHosts(held)).toEqual([]);
      expect(await pasteProofHosts(held)).toEqual([]);
    }
    expect(pasteTrust({ ...shop, status: 'disconnected', disconnected_reason: 'displaced' })).toBe('not_connected');
    expect(pasteTrust({ ...shop, shop_proven_at: null })).toBe('shop_proof_pending');
  });
});

describe('connection read', () => {
  const stored = { widget_site_id: SITE, platform: 'shopify', shop_domain: 'merchant.myshopify.com', status: 'pending',
    secret_version: 1, previous_secret_version: null, previous_valid_until: null, first_seen_at: null, last_seen_at: null,
    shop_proven_at: null, disconnected_reason: null };
  it('reads a pending shop and whether the Shopify app holds it, at read time', async () => {
    m.rows = [stored];
    expect(await getPasteConnection(SITE)).toMatchObject({ status: 'pending', app_installed: false });
    m.rows = [stored, { shop_domain: 'merchant.myshopify.com', status: 'active' }];
    expect(await getPasteConnection(SITE)).toMatchObject({ app_installed: true });
    m.rows = [stored, { shop_domain: 'merchant.myshopify.com', status: 'uninstalled' }];
    expect(await getPasteConnection(SITE)).toMatchObject({ app_installed: false });
  });
  it('fails closed when the install lookup fails', async () => {
    m.rows = [stored]; m.installError = { code: '500' };
    await expect(getPasteConnection(SITE)).rejects.toMatchObject({ code: 'unavailable' });
    m.rows = [{ ...stored, platform: 'website', shop_domain: null, status: 'active' }];
    expect(await getPasteConnection(SITE)).toMatchObject({ app_installed: false });
  });
});

describe('shop proof', () => {
  const pending: PasteConnection = { widget_site_id: SITE, platform: 'shopify', shop_domain: 'merchant.myshopify.com', status: 'pending',
    secret_version: 1, previous_secret_version: null, previous_valid_until: null, first_seen_at: null, last_seen_at: null,
    shop_proven_at: null, disconnected_reason: null, shop_render_at: null, shop_check_outcome: null, shop_checked_at: null,
    app_installed: false };
  const evidence = { siteId: SITE, shopDomain: 'merchant.myshopify.com' } as StorefrontEvidence;
  it.each(['proven', 'render_required', 'shopify_app_installed', 'not_pending'])('passes through %s', async (result) => {
    m.rpc.mockResolvedValue({ data: result, error: null });
    expect(await provePasteShop(pending, evidence)).toBe(result);
    expect(m.rpc).toHaveBeenCalledWith('prove_paste_shop', { p_site: SITE, p_shop: 'merchant.myshopify.com' });
  });
  it('never proves a website or with evidence for another site or shop, and fails closed on an unknown answer', async () => {
    expect(await provePasteShop({ ...pending, platform: 'website', shop_domain: null }, evidence)).toBe('not_pending');
    for (const other of [{ siteId: '22222222-2222-4222-8222-222222222222', shopDomain: 'merchant.myshopify.com' },
      { siteId: SITE, shopDomain: 'victim.myshopify.com' }]) {
      await expect(provePasteShop(pending, other as StorefrontEvidence)).rejects.toMatchObject({ code: 'proof_failed' });
    }
    expect(m.rpc).not.toHaveBeenCalled();
    m.rpc.mockResolvedValue({ data: 'yes', error: null });
    await expect(provePasteShop(pending, evidence)).rejects.toMatchObject({ code: 'unavailable' });
  });
  it('records renders, leases checks and stores outcomes through their RPCs, failing closed on unknown answers', async () => {
    m.rpc.mockResolvedValue({ data: 'recorded', error: null });
    expect(await recordPasteShopRender(pending)).toBe('recorded');
    expect(m.rpc).toHaveBeenLastCalledWith('record_paste_shop_render', { p_site: SITE, p_shop: 'merchant.myshopify.com' });
    await finishPasteShopCheck(pending, 'password_required');
    expect(m.rpc).toHaveBeenLastCalledWith('finish_paste_shop_check', { p_site: SITE, p_shop: 'merchant.myshopify.com', p_outcome: 'password_required' });
    m.rpc.mockResolvedValue({ data: 'busy', error: null });
    expect(await beginPasteShopCheck(pending)).toBe('busy');
    expect(m.rpc).toHaveBeenLastCalledWith('begin_paste_shop_check', { p_site: SITE, p_shop: 'merchant.myshopify.com' });
    await expect(recordPasteShopRender(pending)).rejects.toMatchObject({ code: 'unavailable' });
  });
});

describe('unapplied migration shop-host contract', () => {
  it('records shop-host signals on the connection, with the shop as its own apex and one active holder per shop', () => {
    const sql = readFileSync(new URL('../../../../supabase/20261108_paste_install.sql', import.meta.url), 'utf8');
    expect(sql).toContain('add column if not exists first_seen_at timestamptz');
    expect(sql).toMatch(/paste_site_connections_active_shop_unique\s+on public\.paste_site_connections \(shop_domain\) where status = 'active'/);
    const enable = sql.slice(sql.indexOf('create or replace function public.enable_paste_install'), sql.indexOf('create or replace function public.paste_host('));
    // Another site's claim never blocks enabling: shops start pending.
    expect(enable).not.toContain("select 1 from public.paste_site_connections where shop_domain = p_shop_domain");
    expect(enable).toContain('public.paste_shop_app_installed(p_shop_domain)');
    expect(enable).toContain("case when p_platform = 'shopify' then 'pending' else 'active' end");
    const signal = sql.slice(sql.indexOf('create or replace function public.record_paste_install_signal'), sql.indexOf('revoke all on function'));
    expect(signal).toContain("p_apex = 'myshopify.com'");
    expect(signal).toContain("if p_apex <> c.shop_domain then return 'ignored'");
    expect(signal.indexOf('update public.paste_site_connections set first_seen_at')).toBeLessThan(signal.indexOf('public.claim_site_free_plan'));
    expect(signal).toContain("c.platform = 'shopify' and p_domain = c.shop_domain");
  });
});

describe('unapplied migration security contract', () => {
  const sql = readFileSync(new URL('../../../../supabase/20261108_paste_install.sql', import.meta.url), 'utf8');
  it('keeps the new RPCs service-only and invoker-scoped, with RLS and transaction boundaries', () => {
    expect(sql).toContain('begin;'); expect(sql).toContain('commit;'); expect(sql).toContain('enable row level security');
    const publicFunctions = sql.match(/create or replace function public\.[\s\S]*?(?=create or replace function|$)/g) ?? [];
    expect(publicFunctions.length).toBeGreaterThan(0);
    for (const fn of publicFunctions) expect(fn.toLowerCase()).not.toContain('language plpgsql security definer');
    expect(sql).toContain('function grindctrl_paste_private.guard_domain()');
    expect(sql).toContain('guard_paste_site_domain before insert or update of domain');
    expect(sql).toContain('from public, anon, authenticated');
    expect(sql).toContain('guard_paste_domain before insert or update or delete');
  });
  it('gates the existing serialized apex grant on an observed trusted host, not typing/provisioning', () => {
    const signal = sql.slice(sql.indexOf('create or replace function public.record_paste_install_signal'));
    expect(signal.indexOf("verification_status = 'trusted'")).toBeLessThan(signal.indexOf('public.claim_site_free_plan'));
    const beforeSignal = sql.slice(0, sql.indexOf('create or replace function public.record_paste_install_signal'));
    expect(beforeSignal).not.toContain('ensure_free_tryon_subscription(');
    expect(beforeSignal).not.toContain('claim_site_free_plan(');
    expect(signal).toContain('if not found then return \'ignored\'');
    const apexSql = readFileSync(new URL('../../../../supabase/20261105_woo_dashboard_plans.sql', import.meta.url), 'utf8');
    expect(apexSql).toContain('apex text primary key'); expect(apexSql).toContain("'tryon-free-apex:' || one");
    expect(apexSql).toContain("return 'apex_taken'");
    expect(sql).toContain('first_widget_site_id uuid not null');
    expect(sql).toContain('guard_paste_free_apex before insert or update');
    const history = sql.slice(sql.indexOf('create table if not exists public.tryon_free_apex_history'), sql.indexOf('alter table public.tryon_free_apex_history'));
    expect(history).not.toContain('references public.widget_sites');
  });
});
