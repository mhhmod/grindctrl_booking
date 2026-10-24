// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

let db: PGlite;
const SHOP = 'demo.myshopify.com';
const migration = resolve(process.cwd(), '../../supabase/20261024_shopify_installation_isolation.sql');
async function op(app: string, action: string, lease: string, payload: object = {}, shop = SHOP) {
  const result = await db.query<{ value: Record<string, unknown> | null }>(
    'select shopify_credential_operation($1,$2,$3,$4,$5::jsonb) as value', [shop, app, action, lease, JSON.stringify(payload)]);
  return result.rows[0].value;
}
async function authorize(app: string, shop = SHOP) {
  const lease = randomUUID();
  await op(app, 'acquire', lease, {}, shop);
  await op(app, 'commit', lease, { acquisition: true, scopes: 'read_products',
    access_token_ciphertext: `cipher-${app}`, token_iv: 'iv', token_tag: 'tag' }, shop);
}
async function event(app: string, topic: string, id = randomUUID(), date: string | null = new Date().toISOString(), digest = id) {
  const result = await db.query<{ value: { status: string; duplicate: boolean } }>(
    'select record_shopify_installation_event($1,$2,$3,$4,$5::jsonb,$6,$7::timestamptz) as value',
    [app, SHOP, id, topic, '{}', digest, date]);
  return result.rows[0].value;
}
async function state(app: string, shop = SHOP) {
  return (await db.query<Record<string, unknown>>('select * from shopify_installations where shop_domain=$1 and app_client_id=$2', [shop, app])).rows[0];
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create table tryon_shops(shop_domain text primary key,status text,installed_at timestamptz,last_seen_at timestamptz,
      updated_at timestamptz,uninstalled_at timestamptz);
    create table shopify_shop_tokens(shop_domain text primary key,access_token_ciphertext text);
    insert into shopify_shop_tokens values ('demo.myshopify.com','unknown-legacy-owner');`);
  const sql = await readFile(migration, 'utf8');
  await db.exec(sql); await db.exec(sql); // Manual delta is safely re-applicable.
}, 60000);
afterAll(async () => { await db?.close(); });

describe('real PostgreSQL installation lifecycle and credential transactions', () => {
  it('preserves domain-only legacy records without assigning ownership', async () => {
    expect((await db.query('select * from shopify_installations')).rows).toHaveLength(0);
    expect((await db.query('select * from shopify_shop_tokens')).rows).toHaveLength(1);
  });
  it('stores independent credentials for two apps on a store and two brands', async () => {
    await authorize('app-a'); await authorize('app-b'); await authorize('app-a', 'brand-two.myshopify.com');
    expect((await state('app-a')).access_token_ciphertext).toBe('cipher-app-a');
    expect((await state('app-b')).access_token_ciphertext).toBe('cipher-app-b');
    expect((await state('app-a', 'brand-two.myshopify.com')).id).not.toBe((await state('app-a')).id);
  });
  it('serializes acquisition and refresh with one lease and rejects foreign fenced writes', async () => {
    const first = randomUUID(), other = randomUUID();
    expect(await op('app-a', 'acquire', first)).not.toBeNull();
    expect(await op('app-a', 'acquire', other)).toBeNull();
    await expect(op('app-a', 'commit', other, { scopes: '' })).rejects.toThrow('credential_lease_lost');
    await op('app-a', 'release', first);
  });
  it('uninstalls only A, preserves B and leaves the merchant installed', async () => {
    expect((await event('app-a', 'app/uninstalled')).status).toBe('completed');
    expect((await state('app-a')).access_token_ciphertext).toBeNull();
    expect((await state('app-b')).access_token_ciphertext).toBe('cipher-app-b');
    expect((await db.query<{status:string}>('select status from tryon_shops where shop_domain=$1', [SHOP])).rows[0].status).toBe('installed');
  });
  it('deduplicates deliveries and rejects identity collisions without a second mutation', async () => {
    const id = randomUUID();
    await event('app-a','app/uninstalled',id);
    expect((await event('app-a','app/uninstalled',id)).duplicate).toBe(true);
    await expect(event('app-a','app/scopes_update',id)).rejects.toThrow('webhook_identity_conflict');
  });
  it('ignores delayed pre-reinstall uninstall without reviving or affecting another app', async () => {
    const old = new Date(Date.now()-60000).toISOString();
    await authorize('app-a');
    expect((await event('app-a','app/uninstalled',randomUUID(),old)).status).toBe('ignored');
    expect((await state('app-a')).status).toBe('active');
    expect((await state('app-b')).status).toBe('active');
  });
  it('records uncertain event ordering for manual reconciliation', async () => {
    expect((await event('app-a','app/uninstalled',randomUUID(),null)).status).toBe('manual_required');
    expect((await state('app-a')).status).toBe('active');
  });
  it('never fulfills privacy merely by recording or deletes shared/other-installation data', async () => {
    for (const topic of ['shop/redact','customers/redact','customers/data_request']) {
      expect((await event('app-a',topic)).status).toBe('manual_required');
    }
    expect((await state('app-b')).status).toBe('active');
    expect((await db.query('select * from shopify_shop_tokens')).rows).toHaveLength(1);
  });
  it('fences an exchange that was in flight when uninstall was processed', async () => {
    const lease = randomUUID(); await op('app-a','acquire',lease);
    await event('app-a','app/uninstalled');
    await expect(op('app-a','commit',lease,{ acquisition:true, scopes:'' })).rejects.toThrow('credential_lease_lost');
  });
  it('scope updates never reactivate an uninstalled app or touch B', async () => {
    await event('app-a','app/scopes_update');
    expect((await state('app-a')).status).not.toBe('active');
    expect((await state('app-b')).status).toBe('active');
  });
  it('retires a rejected version without invalidating a newer credential or another app', async () => {
    await authorize('app-a');
    const first = await state('app-a');
    await authorize('app-a');
    const stale = await db.query<{ value: boolean }>('select retire_shopify_credential($1,$2) as value', [first.id, first.credential_version]);
    expect(stale.rows[0].value).toBe(false);
    expect((await state('app-a')).status).toBe('active');
    const latest = await state('app-a');
    const revoked = await db.query<{ value: boolean }>('select retire_shopify_credential($1,$2) as value', [latest.id, latest.credential_version]);
    expect(revoked.rows[0].value).toBe(true);
    expect((await state('app-a')).status).toBe('reauthorization_required');
    expect((await state('app-b')).status).toBe('active');
    expect((await db.query('select * from shopify_credential_audit where installation_id=$1',[latest.id])).rows.length).toBeGreaterThan(0);
  });
  it('denies browser roles access to credentials, event PII and mutation RPCs', async () => {
    await db.exec('set role anon');
    try {
      await expect(db.query('select * from shopify_installations')).rejects.toThrow(/permission denied/);
      await expect(db.query('select * from shopify_installation_events')).rejects.toThrow(/permission denied/);
      await expect(db.query(`select shopify_credential_operation('demo.myshopify.com','app-a','acquire',gen_random_uuid())`)).rejects.toThrow(/permission denied/);
    } finally { await db.exec('reset role'); }
  });
});
