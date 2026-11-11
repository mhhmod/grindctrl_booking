// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/* Executes the real paste migration (twice) and the real free-plan registry
   it builds on, over minimal fixtures for the legacy tables it references. */

let db: PGlite;
const root = resolve(process.cwd(), '../..');
const read = async (file: string) => (await readFile(resolve(root, file), 'utf8')).replace(/^﻿/, '');
let tokenSeq = 0;
const token = () => `tok${String(++tokenSeq).padStart(21, '0')}`;

async function one<T>(sql: string, params: unknown[] = []): Promise<T> {
  return (await db.query<{ value: T }>(sql, params)).rows[0]?.value as T;
}
async function site(domain: string | null = null): Promise<string> {
  return one<string>('insert into widget_sites(domain) values ($1) returning id as value', [domain]);
}
const enable = (id: string, platform: string, shop: string | null = null) =>
  one<string>('select enable_paste_install($1,$2,$3) as value', [id, platform, shop]);
const op = (id: string, operation: string, domain: string | null, domainId: string | null = null, tok: string | null = token()) =>
  one<{ code: string; domain?: { id: string; verification_status: string; verification_token: string; verification_method: string } }>(
    'select paste_domain_operation($1,$2,$3,$4,$5) as value', [id, operation, domain, domainId, tok]);
const render = (id: string, shop: string) => one<string>('select record_paste_shop_render($1,$2) as value', [id, shop]);
const begin = (id: string, shop: string) => one<string>('select begin_paste_shop_check($1,$2) as value', [id, shop]);
const finish = (id: string, shop: string, outcome: string | null) =>
  one<string>('select finish_paste_shop_check($1,$2,$3) as value', [id, shop, outcome]);
const proveOnly = (id: string, shop: string) => one<string>('select prove_paste_shop($1,$2) as value', [id, shop]);
/** The server calls prove only after its storefront fetch found the site's
 *  snippet; a signed render (the second factor) must have arrived too. */
const prove = async (id: string, shop: string) => { await render(id, shop); return proveOnly(id, shop); };
const signal = (id: string, domain: string, apex: string, signed = false) =>
  one<string>('select record_paste_install_signal($1,$2,$3,$4) as value', [id, domain, apex, signed]);
const connection = (id: string) => db.query<{ status: string; shop_proven_at: string | null; disconnected_reason: string | null;
  last_seen_at: string | null; shop_render_at: string | null; shop_check_outcome: string | null; shop_checked_at: string | null;
  shop_check_started_at: string | null }>('select * from paste_site_connections where widget_site_id=$1', [id]).then((r) => r.rows[0]);
const subscribed = (id: string) => one<boolean>('select exists(select 1 from tryon_subscriptions where shop_domain=$1) as value', [`site:${id}`]);
const apexes = (id: string) => db.query<{ apex: string }>('select apex from tryon_free_plan_apexes where widget_site_id=$1 order by apex', [id])
  .then((r) => r.rows.map((row) => row.apex));
async function fails(sql: string, params: unknown[] = []): Promise<string | undefined> {
  try { await db.query(sql, params); return undefined; } catch (error) { return (error as { code?: string }).code; }
}
/** session_user is what the guard checks in production (PostgREST's authenticator). */
async function as<T>(role: 'authenticated' | 'service_role', work: () => Promise<T>): Promise<T> {
  await db.exec(`set session authorization authenticator; set role ${role};`);
  // PGlite keeps the switched session user on RESET; name the superuser.
  try { return await work(); } finally { await db.exec('reset role; set session authorization postgres;'); }
}

let legacy: Record<string, string>;
let provenBefore: string;
/** What our server does after its fetch found this site's snippet on the page. */
const verify = (id: string, domainId: string) => op(id, 'verify', null, domainId, null);
const grant = (id: string, domain: string, apex = domain) =>
  one<string>('select grant_paste_domain_free_plan($1,$2,$3) as value', [id, domain, apex]);
const history = async (apex: string) =>
  (await one<string | undefined>('select first_widget_site_id::text as value from tryon_free_apex_history where apex=$1', [apex])) ?? null;
const domainRow = (id: string) => db.query<{ verification_status: string; paste_verified_at: string | null; paste_check_outcome: string | null }>(
  'select verification_status, paste_verified_at, paste_check_outcome from widget_domains where id=$1', [id]).then((r) => r.rows[0]);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create role authenticator noinherit; grant anon, authenticated, service_role to authenticator;
    create table widget_sites(id uuid primary key default gen_random_uuid(), domain text, status text not null default 'active');
    create table widget_domains(id uuid primary key default gen_random_uuid(),
      widget_site_id uuid not null references widget_sites(id) on delete cascade, domain text not null, pattern text not null,
      environment text not null default 'production', verification_status text not null default 'pending',
      verification_method text not null default 'dns_txt', verification_token text, verified_at timestamptz,
      last_checked_at timestamptz, disabled_at timestamptz, created_at timestamptz not null default now(),
      constraint widget_domains_verification_status_check check (verification_status in ('pending','verified','failed','disabled')));
    create table tryon_shops(shop_domain text primary key, status text default 'installed', platform text not null default 'shopify',
      widget_site_id uuid references widget_sites(id), installed_at timestamptz, last_seen_at timestamptz, updated_at timestamptz,
      uninstalled_at timestamptz);
    create table woo_site_connections(widget_site_id uuid primary key references widget_sites(id), status text not null default 'active');
    create table shopify_installations(id uuid primary key default gen_random_uuid(), shop_domain text not null,
      app_client_id text not null, status text not null, unique(shop_domain, app_client_id));
    create table tryon_subscriptions(id uuid primary key default gen_random_uuid(), shop_domain text unique not null);
    create function ensure_free_tryon_subscription(p text) returns void language sql
      as $$ insert into tryon_subscriptions(shop_domain) values (p) on conflict do nothing $$;
    grant select, insert, update, delete on widget_domains, widget_sites to authenticated;
    grant select, insert, update, delete on all tables in schema public to service_role;`);
  await db.exec(await read('supabase/20261105_woo_dashboard_plans.sql'));
  const legacySite = await site();
  legacy = {};
  for (const status of ['pending', 'verified', 'failed', 'disabled']) {
    legacy[status] = await one<string>(`insert into widget_domains(widget_site_id, domain, pattern, verification_status)
      values ($1,$2,$2,$3) returning id as value`, [legacySite, `legacy-${status}.example`, status]);
  }
  const sql = await read('supabase/20261108_paste_install.sql');
  await db.exec(sql);
  await db.exec(sql);
  // A domain proven by DNS/meta before verification existed.
  provenBefore = await site();
  await enable(provenBefore, 'website');
  const claim = await op(provenBefore, 'add', 'proven-before.example');
  await db.query("update widget_domains set verified_at = now() - interval '3 days' where id=$1", [claim.domain!.id]);
  const verification = await read('supabase/20261109_paste_domain_verification.sql');
  await db.exec(verification);
  await db.exec(verification);
  const disconnect = await read('supabase/20261111_paste_disconnect.sql');
  await db.exec(disconnect);
  await db.exec(disconnect);
}, 60_000);
afterAll(async () => { await db?.close(); });

describe('widget_domains status check', () => {
  it('keeps every existing status and admits trusted and disputed only', async () => {
    const rows = await db.query<{ verification_status: string }>(
      'select verification_status from widget_domains where id = any($1::uuid[]) order by verification_status', [Object.values(legacy)]);
    expect(rows.rows.map((row) => row.verification_status)).toEqual(['disabled', 'failed', 'pending', 'verified']);
    const owner = await site();
    for (const [status, method] of [['trusted', 'paste_trusted'], ['disputed', 'paste_disputed']]) {
      expect(await fails(`insert into widget_domains(widget_site_id, domain, pattern, verification_status, verification_method)
        values ($1,$2,$2,$3,$4)`, [owner, `status-${status}.example`, status, method])).toBeUndefined();
    }
    expect(await fails(`insert into widget_domains(widget_site_id, domain, pattern, verification_status)
      values ($1,'bogus.example','bogus.example','bogus')`, [owner])).toBe('23514');
  });
});

describe('paste domain operations', () => {
  it('needs an enabled paste connection', async () => {
    expect((await op(await site(), 'add', 'nobody.example')).code).toBe('connection_conflict');
  });

  it('trusts a free host, claims a taken one, proves with the exact token and tombstones on removal', async () => {
    const a = await site(); const b = await site();
    expect(await enable(a, 'website')).toBe('enabled');
    expect(await enable(b, 'website')).toBe('enabled');
    expect((await connection(a)).status).toBe('active');
    const trusted = await op(a, 'add', 'brand-one.example');
    expect(trusted).toMatchObject({ code: 'ok', domain: { verification_status: 'trusted', verification_method: 'paste_trusted' } });
    expect((await op(a, 'add', 'brand-one.example')).domain?.id).toBe(trusted.domain?.id);
    for (const host of ['x.myshopify.com', 'grindctrl.cloud', 'app.grindctrl.cloud', 'not a host']) {
      expect((await op(a, 'add', host)).code).toBe('not_found');
    }

    const claim = await op(b, 'add', 'brand-one.example');
    expect(claim).toMatchObject({ code: 'ok', domain: { verification_status: 'pending', verification_method: 'paste_dns_txt' } });
    const claimId = claim.domain!.id;
    expect((await op(b, 'prove', null, claimId, 'wrong-token-wrong-token0')).code).toBe('proof_failed');
    expect((await op(b, 'prove', null, claimId, claim.domain!.verification_token)).domain?.verification_status).toBe('trusted');
    expect(await one('select verification_status as value from widget_domains where id=$1', [trusted.domain!.id])).toBe('disputed');

    expect((await op(b, 'remove', null, claimId)).code).toBe('ok');
    expect(await one('select verification_status || \'/\' || verification_method as value from widget_domains where id=$1', [claimId]))
      .toBe('disabled/paste_removed');
    expect((await op(a, 'remove', null, claimId)).code).toBe('not_found');
  });

  it('caps a site at five distinct active domains', async () => {
    const s = await site();
    await enable(s, 'website');
    for (let index = 1; index <= 5; index++) expect((await op(s, 'add', `cap${index}.example`)).code).toBe('ok');
    expect((await op(s, 'add', 'cap6.example')).code).toBe('limit_reached');
  });
});

describe('Shopify shop proof', () => {
  it('starts every claim pending, lets the first signed render prove one and displaces the others', async () => {
    const squatter = await site(); const merchant = await site();
    expect(await enable(squatter, 'shopify', 'victim.myshopify.com')).toBe('enabled');
    expect(await enable(merchant, 'shopify', 'victim.myshopify.com')).toBe('enabled');
    expect((await connection(squatter)).status).toBe('pending');
    expect((await connection(merchant)).status).toBe('pending');

    // Pending trusts nothing: no signal, no plan, even a "signed" one.
    expect(await signal(squatter, 'victim.myshopify.com', 'victim.myshopify.com', true)).toBe('ignored');
    expect(await subscribed(squatter)).toBe(false);
    // A pending merchant may add the storefront's own domain while waiting.
    expect((await op(merchant, 'add', 'victim-store.example')).domain?.verification_status).toBe('trusted');
    expect(await one('select rotate_paste_secret($1)->>\'version\' as value', [merchant])).toBe('2');

    expect(await prove(merchant, 'victim.myshopify.com')).toBe('proven');
    expect(await connection(merchant)).toMatchObject({ status: 'active', disconnected_reason: null });
    expect((await connection(merchant)).shop_proven_at).not.toBeNull();
    expect(await connection(squatter)).toMatchObject({ status: 'disconnected', disconnected_reason: 'displaced' });
    expect(await prove(merchant, 'victim.myshopify.com')).toBe('proven');
    expect(await prove(squatter, 'victim.myshopify.com')).toBe('not_pending');
    expect(await prove(merchant, 'other.myshopify.com')).toBe('not_pending');
    expect(await signal(squatter, 'victim.myshopify.com', 'victim.myshopify.com', true)).toBe('ignored');

    // Re-enabling after displacement waits for proof again.
    expect(await enable(squatter, 'shopify', 'victim.myshopify.com')).toBe('enabled');
    expect(await connection(squatter)).toMatchObject({ status: 'pending', disconnected_reason: null });
    expect((await connection(merchant)).status).toBe('active');
  });

  it('needs a recent signed render as the second factor, and a forged render alone proves nothing', async () => {
    const merchant = await site(); const squatter = await site();
    await enable(merchant, 'shopify', 'factor.myshopify.com');
    await enable(squatter, 'shopify', 'factor.myshopify.com');
    // The squatter's forged render is recorded, but only a storefront
    // finding leads the server to call prove; the merchant's does.
    expect(await render(squatter, 'factor.myshopify.com')).toBe('recorded');
    expect(await proveOnly(merchant, 'factor.myshopify.com')).toBe('render_required');
    expect((await connection(merchant)).status).toBe('pending');
    expect((await connection(squatter)).status).toBe('pending');
    await db.query("update paste_site_connections set shop_render_at = now() - interval '25 hours' where widget_site_id=$1", [merchant]);
    expect(await proveOnly(merchant, 'factor.myshopify.com')).toBe('render_required');
    expect(await render(merchant, 'factor.myshopify.com')).toBe('recorded');
    expect(await render(merchant, 'other.myshopify.com')).toBe('not_pending');
    expect(await proveOnly(merchant, 'factor.myshopify.com')).toBe('proven');
    expect(await connection(merchant)).toMatchObject({ status: 'active', shop_check_outcome: 'proven', shop_check_started_at: null });
    expect(await connection(squatter)).toMatchObject({ status: 'disconnected', disconnected_reason: 'displaced' });
    // A proven or displaced connection takes no more renders or checks.
    expect(await render(merchant, 'factor.myshopify.com')).toBe('not_pending');
    expect(await render(squatter, 'factor.myshopify.com')).toBe('not_pending');
    expect(await begin(squatter, 'factor.myshopify.com')).toBe('not_pending');
  });

  it('leases one storefront check at a time and stores only failed outcomes', async () => {
    const s = await site();
    await enable(s, 'shopify', 'lease.myshopify.com');
    expect(await begin(s, 'lease.myshopify.com')).toBe('started');
    expect(await begin(s, 'lease.myshopify.com')).toBe('busy');
    expect(await begin(s, 'other.myshopify.com')).toBe('not_pending');
    for (const bad of ['proven', 'bogus', null]) expect(await finish(s, 'lease.myshopify.com', bad)).toBe('invalid');
    expect(await finish(s, 'lease.myshopify.com', 'password_required')).toBe('recorded');
    expect(await connection(s)).toMatchObject({ shop_check_outcome: 'password_required', shop_check_started_at: null });
    expect((await connection(s)).shop_checked_at).not.toBeNull();
    expect(await begin(s, 'lease.myshopify.com')).toBe('started');
    // An abandoned lease lapses after 30 seconds.
    await db.query("update paste_site_connections set shop_check_started_at = now() - interval '31 seconds' where widget_site_id=$1", [s]);
    expect(await begin(s, 'lease.myshopify.com')).toBe('started');
    expect(await fails("update paste_site_connections set shop_check_outcome='bogus' where widget_site_id=$1", [s])).toBe('23514');
    const w = await site();
    await enable(w, 'website');
    expect(await fails("update paste_site_connections set shop_check_outcome='not_found' where widget_site_id=$1", [w])).toBe('23514');
  });

  it('starts a displaced claim over when it is enabled again, and keeps a live one', async () => {
    const first = await site(); const second = await site();
    await enable(first, 'shopify', 'restart.myshopify.com');
    await enable(second, 'shopify', 'restart.myshopify.com');
    await render(first, 'restart.myshopify.com');
    await finish(first, 'restart.myshopify.com', 'awaiting_visit');
    expect(await enable(first, 'shopify', 'restart.myshopify.com')).toBe('enabled');
    expect(await connection(first)).toMatchObject({ status: 'pending', shop_check_outcome: 'awaiting_visit' });
    expect((await connection(first)).shop_render_at).not.toBeNull();
    expect(await prove(second, 'restart.myshopify.com')).toBe('proven');
    expect(await enable(first, 'shopify', 'restart.myshopify.com')).toBe('enabled');
    expect(await connection(first)).toMatchObject({ status: 'pending', shop_render_at: null, shop_check_outcome: null,
      shop_checked_at: null, shop_check_started_at: null });
  });

  it('enforces the state invariants in the table itself', async () => {
    const a = await site(); const b = await site(); const w = await site();
    await enable(a, 'shopify', 'invariant.myshopify.com');
    await enable(b, 'shopify', 'invariant.myshopify.com');
    await enable(w, 'website');
    expect(await fails("update paste_site_connections set status='active' where widget_site_id=$1", [a])).toBe('23514');
    expect(await fails("update paste_site_connections set status='pending' where widget_site_id=$1", [w])).toBe('23514');
    expect(await fails("update paste_site_connections set disconnected_reason='displaced' where widget_site_id=$1", [w])).toBe('23514');
    expect(await prove(a, 'invariant.myshopify.com')).toBe('proven');
    expect((await connection(b)).disconnected_reason).toBe('displaced');
    // One active holder per shop, whatever writes the row.
    expect(await fails(`update paste_site_connections set status='active', shop_proven_at=now(), disconnected_reason=null
      where widget_site_id=$1`, [b])).toBe('23505');
  });

  it('refuses a platform switch, a malformed shop and a site already holding a tenant', async () => {
    const s = await site();
    await enable(s, 'website');
    expect(await enable(s, 'shopify', 'switch.myshopify.com')).toBe('connection_conflict');
    expect(await enable(await site(), 'shopify', 'Not A Shop')).toBe('invalid_platform');
    expect(await enable(await site(), 'website', 'x.myshopify.com')).toBe('invalid_platform');
    expect(await enable(await site('app.myshopify.com'), 'shopify', 'app.myshopify.com')).toBe('connection_conflict');
  });
});

describe('free plan', () => {
  it('grants a Shopify paste store only from a signed render after proof, claiming the shop and its storefront apex', async () => {
    const merchant = await site();
    await enable(merchant, 'shopify', 'freeplan.myshopify.com');
    const storefront = await op(merchant, 'add', 'freeplan-store.example');
    expect(await signal(merchant, 'freeplan.myshopify.com', 'freeplan.myshopify.com', true)).toBe('ignored');
    await prove(merchant, 'freeplan.myshopify.com');

    expect(await signal(merchant, 'freeplan.myshopify.com', 'freeplan.myshopify.com')).toBe('recorded');
    // The storefront domain counts only once our server found the code there.
    expect(await signal(merchant, 'freeplan-store.example', 'freeplan-store.example', true)).toBe('unverified');
    expect(await history('freeplan-store.example')).toBeNull();
    await verify(merchant, storefront.domain!.id);
    expect(await signal(merchant, 'freeplan-store.example', 'freeplan-store.example')).toBe('recorded');
    expect((await connection(merchant)).last_seen_at).not.toBeNull();
    expect(await subscribed(merchant)).toBe(false);
    expect(await signal(merchant, 'myshopify.com', 'myshopify.com', true)).toBe('ignored');
    expect(await signal(merchant, 'freeplan.myshopify.com', 'myshopify.com', true)).toBe('ignored');

    expect(await signal(merchant, 'freeplan-store.example', 'freeplan-store.example', true)).toBe('granted');
    expect(await subscribed(merchant)).toBe(true);
    expect(await apexes(merchant)).toEqual(['freeplan-store.example', 'freeplan.myshopify.com']);
    expect(await signal(merchant, 'freeplan.myshopify.com', 'freeplan.myshopify.com', true)).toBe('granted');
  });

  it('grants each apex once, even after the first site is deleted', async () => {
    const first = await site(); const second = await site();
    await enable(first, 'website'); await enable(second, 'website');
    const added = await op(first, 'add', 'once.example');
    await verify(first, added.domain!.id);
    expect(await signal(first, 'once.example', 'once.example')).toBe('granted');
    expect(await signal(first, 'once.example', 'once.example')).toBe('granted');

    const claim = await op(second, 'add', 'once.example');
    await op(second, 'prove', null, claim.domain!.id, claim.domain!.verification_token);
    expect(await signal(second, 'once.example', 'once.example')).toBe('apex_taken');

    await db.query('delete from tryon_shops where widget_site_id=$1', [first]);
    await db.query('delete from widget_sites where id=$1', [first]);
    expect(await one('select count(*)::int as value from tryon_free_plan_apexes where apex=$1', ['once.example'])).toBe(0);
    expect(await signal(second, 'once.example', 'once.example')).toBe('apex_taken');
    expect(await subscribed(second)).toBe(false);
  });

  it('refuses a Shopify shop whose apex another site already used', async () => {
    const earlier = await site(); const later = await site();
    await enable(earlier, 'shopify', 'reused.myshopify.com');
    await prove(earlier, 'reused.myshopify.com');
    expect(await signal(earlier, 'reused.myshopify.com', 'reused.myshopify.com', true)).toBe('granted');
    await enable(later, 'shopify', 'reused.myshopify.com');
    await prove(later, 'reused.myshopify.com');
    expect(await signal(later, 'reused.myshopify.com', 'reused.myshopify.com', true)).toBe('apex_taken');
  });
});

describe('domain verification (20261109)', () => {
  it('earns nothing from a forged Origin: an added host is unverified, writes no plan, apex or seen time', async () => {
    const attacker = await site();
    await enable(attacker, 'website');
    const claim = await op(attacker, 'add', 'victim-brand.example');
    expect(claim.domain).toMatchObject({ verification_status: 'trusted', paste_verified_at: null });
    // What /api/messenger/config does with `Origin: https://victim-brand.example`.
    expect(await signal(attacker, 'victim-brand.example', 'victim-brand.example')).toBe('unverified');
    expect(await grant(attacker, 'victim-brand.example')).toBe('unverified');
    expect(await subscribed(attacker)).toBe(false);
    expect(await history('victim-brand.example')).toBeNull();
    expect(await apexes(attacker)).toEqual([]);
    expect(await one('select last_seen_at as value from widget_domains where id=$1', [claim.domain!.id])).toBeNull();
  });

  it('lets the real owner verify and earn the plan after an unverified claim, whether the claim was deleted or still there', async () => {
    const attacker = await site(); const owner = await site(); const later = await site();
    await enable(attacker, 'website'); await enable(owner, 'website'); await enable(later, 'website');
    await op(attacker, 'add', 'squatted.example');
    await signal(attacker, 'squatted.example', 'squatted.example');
    // The attacker still holds the host: the owner's add waits as a claim,
    // and the owner's snippet on the page moves it here. No DNS step.
    const claim = await op(owner, 'add', 'squatted.example');
    expect(claim.domain).toMatchObject({ verification_status: 'pending', verification_method: 'paste_dns_txt' });
    expect((await verify(owner, claim.domain!.id)).domain).toMatchObject({ verification_status: 'trusted', verification_method: 'paste_trusted' });
    expect(await one("select verification_status as value from widget_domains where widget_site_id=$1 and domain='squatted.example'", [attacker]))
      .toBe('disputed');
    expect(await signal(owner, 'squatted.example', 'squatted.example')).toBe('granted');
    expect(await history('squatted.example')).toBe(owner);

    // Deleted claim: nothing of it survives to block the owner.
    await op(later, 'add', 'deleted-claim.example');
    expect(await signal(later, 'deleted-claim.example', 'deleted-claim.example')).toBe('unverified');
    await db.query('delete from tryon_shops where widget_site_id=$1', [later]);
    await db.query('delete from widget_sites where id=$1', [later]);
    const fresh = await site();
    await enable(fresh, 'website');
    const mine = await op(fresh, 'add', 'deleted-claim.example');
    expect(mine.domain?.verification_status).toBe('trusted');
    await verify(fresh, mine.domain!.id);
    expect(await grant(fresh, 'deleted-claim.example')).toBe('granted');
  });

  it('grants once after verification, idempotently, and an unverified sibling never adds its apex', async () => {
    const s = await site();
    await enable(s, 'website');
    const shop = await op(s, 'add', 'grant-once.example');
    await op(s, 'add', 'grant-other.example');
    expect(await grant(s, 'grant-once.example')).toBe('unverified');
    await verify(s, shop.domain!.id);
    expect(await domainRow(shop.domain!.id)).toMatchObject({ paste_check_outcome: 'verified' });
    expect(await grant(s, 'grant-once.example')).toBe('granted');
    expect(await grant(s, 'grant-once.example')).toBe('granted');
    expect(await signal(s, 'grant-other.example', 'grant-other.example')).toBe('unverified');
    expect(await apexes(s)).toEqual(['grant-once.example']);
    expect(await one('select count(*)::int as value from tryon_subscriptions where shop_domain=$1', [`site:${s}`])).toBe(1);
    // Shopify plans come from signed renders only.
    const shopify = await site();
    await enable(shopify, 'shopify', 'grant-shop.myshopify.com');
    expect(await grant(shopify, 'grant-shop.example')).toBe('ignored');
  });

  it('records a failed check without verifying, and a re-added host starts over', async () => {
    const s = await site();
    await enable(s, 'website');
    const added = await op(s, 'add', 'checked.example');
    const check = (outcome: string | null) => one<string>('select record_paste_domain_check($1,$2,$3) as value', [s, added.domain!.id, outcome]);
    for (const bad of ['verified', 'bogus', null]) expect(await check(bad)).toBe('invalid');
    expect(await check('not_found')).toBe('recorded');
    expect(await domainRow(added.domain!.id)).toMatchObject({ paste_verified_at: null, paste_check_outcome: 'not_found' });
    expect(await one<string>('select record_paste_domain_check($1,$2,$3) as value', [await site(), added.domain!.id, 'not_found'])).toBe('not_found');
    await verify(s, added.domain!.id);
    expect((await domainRow(added.domain!.id)).paste_verified_at).not.toBeNull();
    await op(s, 'remove', null, added.domain!.id);
    const again = await op(s, 'add', 'checked.example');
    expect(again.domain).toMatchObject({ verification_status: 'trusted', paste_verified_at: null, paste_check_outcome: null });
    expect(await signal(s, 'checked.example', 'checked.example')).toBe('unverified');
  });

  it('keeps a DNS or meta proof made before this migration as verified', async () => {
    expect(await signal(provenBefore, 'proven-before.example', 'proven-before.example')).toBe('granted');
    expect(await one('select paste_check_outcome as value from widget_domains where widget_site_id=$1', [provenBefore])).toBe('verified');
  });

  it('keeps verify, the check and the grant away from browser roles', async () => {
    const s = await site();
    for (const call of [
      ['select record_paste_domain_check($1,$2,$3)', [s, s, 'not_found']],
      ['select grant_paste_domain_free_plan($1,$2,$3)', [s, 'a.example', 'a.example']],
      ['select paste_domain_operation($1,$2,null,$3,null)', [s, 'verify', s]],
    ] as const) {
      expect(await as('authenticated', () => db.query(call[0], [...call[1]]).then(() => undefined, (e: { code?: string }) => e.code))).toBe('42501');
    }
    expect(await as('authenticated', () => db.query('update widget_domains set paste_verified_at = now() where widget_site_id=$1', [provenBefore])
      .then(() => undefined, (e: { code?: string }) => e.code))).toBe('42501');
  });

  it('ships a SELECT-only review query that lists apexes claimed without verification', async () => {
    const text = await read('supabase/20261109_paste_domain_verification.sql');
    const start = text.indexOf('-- select h.apex');
    const end = text.indexOf('order by h.claimed_at;', start) + 'order by h.claimed_at;'.length;
    const query = text.slice(start, end).split('\n').map((line) => line.replace(/^--\s?/, '')).join('\n');
    expect(query).toMatch(/^select /);
    expect(query).not.toMatch(/\b(insert|update|delete|drop|alter|truncate)\b/i);
    // An apex an old, unverified claim took before this migration.
    const old = await site();
    await enable(old, 'website');
    await op(old, 'add', 'taken-early.example');
    await db.query('insert into tryon_free_apex_history(apex, first_widget_site_id) values ($1,$2)', ['taken-early.example', old]);
    const rows = (await db.query<{ apex: string }>(query)).rows.map((row) => row.apex);
    expect(rows).toContain('taken-early.example');
    // once.example's first claimer site was deleted: listed for a manual look.
    expect(rows).toContain('once.example');
    expect(rows).not.toContain('squatted.example');
    expect(rows).not.toContain('grant-once.example');
  });
});

describe('trigger guards and grants', () => {
  it('lets only the service role write paste trust', async () => {
    const s = await site();
    const insertPaste = (host: string) => db.query(`insert into widget_domains(widget_site_id, domain, pattern, verification_status, verification_method)
      values ($1,$2,$2,'trusted','paste_trusted')`, [s, host]);
    expect(await as('authenticated', () => insertPaste('guard-a.example').then(() => undefined, (e: { code?: string }) => e.code))).toBe('42501');
    expect(await as('authenticated', () => db.query(`insert into widget_domains(widget_site_id, domain, pattern)
      values ($1,'legacy-ok.example','legacy-ok.example')`, [s]).then(() => 'ok'))).toBe('ok');
    expect(await as('service_role', () => insertPaste('guard-b.example').then(() => 'ok'))).toBe('ok');
    const id = await one<string>("select id as value from widget_domains where domain='guard-b.example'");
    expect(await as('authenticated', () => db.query("update widget_domains set verification_status='verified' where id=$1", [id])
      .then(() => undefined, (e: { code?: string }) => e.code))).toBe('42501');
    expect(await as('authenticated', () => db.query('delete from widget_domains where id=$1', [id])
      .then(() => undefined, (e: { code?: string }) => e.code))).toBe('42501');
    expect(await one('select count(*)::int as value from widget_domains where id=$1', [id])).toBe(1);
  });

  it('stops legacy writers from claiming a trusted host, even as the service role', async () => {
    const holder = await site(); const other = await site();
    await enable(holder, 'website');
    await op(holder, 'add', 'held.example');
    expect(await as('service_role', () => db.query(`insert into widget_domains(widget_site_id, domain, pattern, verification_status)
      values ($1,'held.example','held.example','verified')`, [other]).then(() => undefined, (e: { code?: string }) => e.code))).toBe('23505');
    expect(await fails("update widget_sites set domain='www.held.example' where id=$1", [other])).toBe('23505');
    expect(await fails('insert into tryon_free_plan_apexes(apex, widget_site_id) values ($1,$2)', ['freeplan.myshopify.com', other])).toBe('23505');
  });

  it('keeps every paste RPC away from browser roles', async () => {
    const s = await site();
    for (const call of [
      ['select enable_paste_install($1,$2,null)', [s, 'website']],
      ['select prove_paste_shop($1,$2)', [s, 'x.myshopify.com']],
      ['select record_paste_shop_render($1,$2)', [s, 'x.myshopify.com']],
      ['select begin_paste_shop_check($1,$2)', [s, 'x.myshopify.com']],
      ['select finish_paste_shop_check($1,$2,$3)', [s, 'x.myshopify.com', 'not_found']],
      ['select record_paste_install_signal($1,$2,$3,true)', [s, 'a.example', 'a.example']],
      ['select paste_domain_operation($1,$2,$3,null,null)', [s, 'add', 'a.example']],
    ] as const) {
      expect(await as('authenticated', () => db.query(call[0], [...call[1]]).then(() => undefined, (e: { code?: string }) => e.code))).toBe('42501');
    }
    expect(await as('service_role', () => db.query('select prove_paste_shop($1,$2) as value', [s, 'x.myshopify.com'])
      .then((r) => (r.rows[0] as { value: string }).value))).toBe('not_pending');
  });
});

describe('owner disconnect (20261111, B5)', () => {
  const disconnect = (id: string) => one<{ code: string; platform?: string; shop_domain?: string | null }>(
    'select disconnect_paste_install($1) as value', [id]);
  const secret = (id: string) => one<number>('select secret_version as value from paste_site_connections where widget_site_id=$1', [id]);
  const domains = (id: string) => db.query<{ domain: string; verification_status: string; verification_method: string }>(
    'select domain, verification_status, verification_method from widget_domains where widget_site_id=$1 order by domain', [id]).then((r) => r.rows);

  it('lets a wrong pending shop be replaced: disconnect, then enable the right one, which starts over', async () => {
    const s = await site();
    await enable(s, 'shopify', 'typo.myshopify.com');
    await render(s, 'typo.myshopify.com');
    await finish(s, 'typo.myshopify.com', 'not_found');
    expect(await enable(s, 'shopify', 'right.myshopify.com')).toBe('connection_conflict');
    const before = await secret(s);
    expect(await disconnect(s)).toEqual({ code: 'ok', platform: 'shopify', shop_domain: 'typo.myshopify.com' });
    expect(await connection(s)).toMatchObject({ status: 'disconnected', disconnected_reason: null, shop_render_at: null,
      shop_check_outcome: null, shop_checked_at: null, shop_proven_at: null });
    // The pasted code stops at once: a new secret version with no overlap.
    expect(await secret(s)).toBe(before + 1);
    expect(await disconnect(s)).toEqual({ code: 'not_found' });
    expect(await enable(s, 'shopify', 'right.myshopify.com')).toBe('enabled');
    expect(await one('select shop_domain as value from paste_site_connections where widget_site_id=$1', [s])).toBe('right.myshopify.com');
    expect(await connection(s)).toMatchObject({ status: 'pending', shop_check_outcome: null, last_seen_at: null });
  });

  it('releases a proven shop and its addresses, keeps another site\'s denial row, and can switch platform', async () => {
    const s = await site(); const other = await site();
    await enable(s, 'shopify', 'release.myshopify.com');
    await prove(s, 'release.myshopify.com');
    const own = await op(s, 'add', 'release-store.example');
    expect(own.domain?.verification_status).toBe('trusted');
    // s held contested.example until the other site's code was found there.
    await op(s, 'add', 'contested.example');
    await enable(other, 'website');
    const contested = await op(other, 'add', 'contested.example');
    await verify(other, contested.domain!.id);
    await db.query("update paste_site_connections set last_seen_at = now() where widget_site_id=$1", [s]);

    expect((await disconnect(s)).code).toBe('ok');
    const rows = await domains(s);
    expect(rows.find((row) => row.domain === 'release-store.example')).toMatchObject({ verification_status: 'disabled', verification_method: 'paste_removed' });
    expect(rows.find((row) => row.domain === 'contested.example')).toMatchObject({ verification_status: 'disputed' });
    // Another site may now claim the shop and the freed address.
    const next = await site();
    await enable(next, 'shopify', 'release.myshopify.com');
    expect(await prove(next, 'release.myshopify.com')).toBe('proven');
    expect((await op(next, 'add', 'release-store.example')).domain?.verification_status).toBe('trusted');
    // The disconnected site may come back as a website.
    expect(await enable(s, 'website')).toBe('enabled');
    expect(await connection(s)).toMatchObject({ status: 'active', shop_check_outcome: null, last_seen_at: null });
    expect(await one('select shop_domain as value from paste_site_connections where widget_site_id=$1', [s])).toBeNull();
  });

  it('still refuses switching a live connection, and keeps disconnect away from browser roles', async () => {
    const s = await site();
    await enable(s, 'website');
    expect(await enable(s, 'shopify', 'live-switch.myshopify.com')).toBe('connection_conflict');
    expect(await as('authenticated', () => db.query('select disconnect_paste_install($1)', [s])
      .then(() => undefined, (e: { code?: string }) => e.code))).toBe('42501');
    expect((await connection(s)).status).toBe('active');
    expect(await disconnect(await site())).toEqual({ code: 'not_found' });
  });
});

describe('Shopify app installed on the shop', () => {
  it('refuses enabling paste for a shop the app holds', async () => {
    await db.query("insert into shopify_installations(shop_domain, app_client_id, status) values ('appheld.myshopify.com','app','active')");
    expect(await enable(await site(), 'shopify', 'appheld.myshopify.com')).toBe('connection_conflict');
  });

  it('stops trusting an existing paste connection when the app arrives later, with no webhook', async () => {
    const merchant = await site(); const pending = await site();
    await enable(merchant, 'shopify', 'arrives.myshopify.com');
    await prove(merchant, 'arrives.myshopify.com');
    // A later claim on a proven shop is still accepted, as pending.
    expect(await enable(pending, 'shopify', 'arrives.myshopify.com')).toBe('enabled');
    expect(await signal(merchant, 'arrives.myshopify.com', 'arrives.myshopify.com')).toBe('recorded');

    await db.query("insert into shopify_installations(shop_domain, app_client_id, status) values ('arrives.myshopify.com','app','active')");
    expect(await signal(merchant, 'arrives.myshopify.com', 'arrives.myshopify.com', true)).toBe('ignored');
    expect(await subscribed(merchant)).toBe(false);
    expect(await proveOnly(pending, 'arrives.myshopify.com')).toBe('shopify_app_installed');
    expect(await render(pending, 'arrives.myshopify.com')).toBe('shopify_app_installed');
    expect(await begin(pending, 'arrives.myshopify.com')).toBe('shopify_app_installed');
    expect((await connection(pending)).status).toBe('pending');
    expect((await op(merchant, 'add', 'arrives-store.example')).code).toBe('connection_conflict');
    expect(await enable(await site(), 'shopify', 'arrives.myshopify.com')).toBe('connection_conflict');

    await db.query("update shopify_installations set status='uninstalled' where shop_domain='arrives.myshopify.com'");
    expect(await signal(merchant, 'arrives.myshopify.com', 'arrives.myshopify.com', true)).toBe('granted');
  });
});
