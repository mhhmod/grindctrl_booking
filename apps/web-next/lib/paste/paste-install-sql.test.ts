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
const prove = (id: string, shop: string) => one<string>('select prove_paste_shop($1,$2) as value', [id, shop]);
const signal = (id: string, domain: string, apex: string, signed = false) =>
  one<string>('select record_paste_install_signal($1,$2,$3,$4) as value', [id, domain, apex, signed]);
const connection = (id: string) => db.query<{ status: string; shop_proven_at: string | null; disconnected_reason: string | null;
  last_seen_at: string | null }>('select * from paste_site_connections where widget_site_id=$1', [id]).then((r) => r.rows[0]);
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
    await op(merchant, 'add', 'freeplan-store.example');
    expect(await signal(merchant, 'freeplan.myshopify.com', 'freeplan.myshopify.com', true)).toBe('ignored');
    await prove(merchant, 'freeplan.myshopify.com');

    expect(await signal(merchant, 'freeplan.myshopify.com', 'freeplan.myshopify.com')).toBe('recorded');
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
    await op(first, 'add', 'once.example');
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
      ['select record_paste_install_signal($1,$2,$3,true)', [s, 'a.example', 'a.example']],
      ['select paste_domain_operation($1,$2,$3,null,null)', [s, 'add', 'a.example']],
    ] as const) {
      expect(await as('authenticated', () => db.query(call[0], [...call[1]]).then(() => undefined, (e: { code?: string }) => e.code))).toBe('42501');
    }
    expect(await as('service_role', () => db.query('select prove_paste_shop($1,$2) as value', [s, 'x.myshopify.com'])
      .then((r) => (r.rows[0] as { value: string }).value))).toBe('not_pending');
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
    expect(await prove(pending, 'arrives.myshopify.com')).toBe('shopify_app_installed');
    expect((await connection(pending)).status).toBe('pending');
    expect((await op(merchant, 'add', 'arrives-store.example')).code).toBe('connection_conflict');
    expect(await enable(await site(), 'shopify', 'arrives.myshopify.com')).toBe('connection_conflict');

    await db.query("update shopify_installations set status='uninstalled' where shop_domain='arrives.myshopify.com'");
    expect(await signal(merchant, 'arrives.myshopify.com', 'arrives.myshopify.com', true)).toBe('granted');
  });
});
