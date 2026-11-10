// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

let db: PGlite;
const token = 'a'.repeat(64);
const nonce = 'b'.repeat(64);
const key = JSON.stringify({ ciphertext: 'cipher', iv: 'iv', tag: 'tag' });
async function value<T>(sql: string, args: unknown[] = []): Promise<T> {
  return (await db.query<{ v: T }>(sql, args)).rows[0]?.v as T;
}
const site = () => value<string>('insert into widget_sites default values returning id as v');
const begin = (id: string, n = nonce, tok = token) => value<boolean>(
  "select begin_easyorders_install($1,'owner',$2,now()+interval '10 minutes',$3,'https://grindctrl.cloud') as v", [id, n, tok]);
const stage = (id: string, n = nonce, user = 'owner', keyHash = id) => value<boolean>(
  "select stage_easyorders_install($1,$2,$3,'store-1',$4::jsonb,$5) as v", [id, user, n, key, keyHash]);
type Activation = { status: string; activated?: boolean; store_id?: string; store_name?: string | null };
const activate = (id: string, n = nonce, user = 'owner', name: string | null = 'Store One') => value<Activation>(
  'select activate_easyorders_install($1,$2,$3,$4) as v', [id, user, n, name]);
const discard = (id: string, outcome = 'rejected', n = nonce) => value<boolean>(
  'select discard_easyorders_install($1,$2,$3) as v', [id, n, outcome]);
/** The full install: callback staging, then the creator's confirmation. */
const complete = async (id: string, n = nonce, user = 'owner', keyHash = id) =>
  (await stage(id, n, user, keyHash)) && (await activate(id, n, user)).status === 'active';
const reserve = (id: string, tok = token, verify = false) => value<{ success: boolean; reset: number }>(
  'select reserve_easyorders_request($1,$2,false,$3) as v', [id, tok, verify]);
const row = (id: string) => value<Record<string, unknown>>('select row_to_json(c) as v from easyorders_connections c where widget_site_id=$1', [id]);
const installRow = (id: string) => value<Record<string, unknown>>('select row_to_json(s) as v from easyorders_install_states s where widget_site_id=$1', [id]);
async function active() {
  const id = await site(); const tok = id.replaceAll('-', '').repeat(2);
  await begin(id, nonce, tok); await complete(id);
  return { id, tok };
}
async function asRole(role: 'anon' | 'authenticated' | 'service_role', work: () => Promise<unknown>) {
  await db.exec(`set role ${role}`);
  try { return await work(); } finally { await db.exec('reset role'); }
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create table widget_sites(id uuid primary key default gen_random_uuid());
    create table messenger_knowledge(id uuid primary key default gen_random_uuid(),widget_site_id uuid references widget_sites(id),
      title text not null,content text not null,source text not null,status text not null default 'active',
      last_synced_at timestamptz,updated_at timestamptz not null default now());
    grant select,insert,update,delete on messenger_knowledge to service_role;`);
  const sql = await readFile(resolve(process.cwd(), '../../supabase/20261109_easyorders_connector.sql'), 'utf8');
  await db.exec(sql); await db.exec(sql); // idempotent delta, real in-memory Postgres
}, 60000);
afterAll(async () => { await db?.close(); });

describe('EasyOrders additive SQL and access', () => {
  it('enables RLS with no browser policies on connection, state and budget tables', async () => {
    const rows = await db.query<{ relrowsecurity: boolean }>("select relrowsecurity from pg_class where relname in ('easyorders_connections','easyorders_install_states','easyorders_api_budgets')");
    expect(rows.rows).toEqual([{ relrowsecurity: true }, { relrowsecurity: true }, { relrowsecurity: true }]);
    expect(await value("select count(*)::int as v from pg_policies where tablename like 'easyorders_%'")).toBe(0);
  });
  it.each(['anon','authenticated'] as const)('denies %s table reads/writes and every connector RPC', async (role) => {
    for (const table of ['easyorders_connections','easyorders_install_states','easyorders_api_budgets']) {
      await expect(asRole(role, () => db.query(`select * from ${table}`))).rejects.toMatchObject({ code: '42501' });
      await expect(asRole(role, () => db.query(`delete from ${table}`))).rejects.toMatchObject({ code: '42501' });
    }
    const functions = await db.query<{ proname: string; allowed: boolean }>(
      "select proname,has_function_privilege($1,p.oid,'EXECUTE') as allowed from pg_proc p where proname like '%easyorders%'", [role]);
    expect(functions.rows.length).toBe(11);
    expect(functions.rows.every((f) => !f.allowed)).toBe(true);
  });
  it('permits service_role and uses no security-definer function', async () => {
    await expect(asRole('service_role', () => db.query('select * from easyorders_connections'))).resolves.toBeDefined();
    expect(await value("select count(*)::int as v from pg_proc where proname like '%easyorders%' and prosecdef")).toBe(0);
  });
});
describe('atomic installation state', () => {
  it('the callback only stages: binds site, user and nonce, once, and never activates', async () => {
    const id = await site(); await begin(id);
    expect(await stage(id, 'c'.repeat(64))).toBe(false);
    expect(await stage(id, nonce, 'other-user')).toBe(false);
    expect(await stage(await site())).toBe(false);
    expect(await stage(id)).toBe(true);
    expect(await stage(id)).toBe(false); // replayed callback
    expect(await row(id)).toMatchObject({ status: 'pending_confirmation', api_key: null, api_key_hash: null, store_id: null });
    expect(await installRow(id)).toMatchObject({ staged_key: JSON.parse(key), staged_store_id: 'store-1', consumed_at: null, outcome: null });
    expect(await value("select staged_expires_at between now()+interval '14 minutes' and now()+interval '16 minutes' as v from easyorders_install_states where widget_site_id=$1", [id])).toBe(true);
    // A staged key is not a usable connection.
    expect((await reserve(id, token)).success).toBe(false);
    expect(await value('select record_easyorders_webhook($1,$2,true) as v', [id, token])).toBe(false);
  });
  it('activates only for the creator, once; a replay reports without changing anything', async () => {
    const id = await site(); await begin(id, nonce, '3'.repeat(64)); await stage(id);
    expect(await activate(id, nonce, 'other-user')).toEqual({ status: 'invalid' });
    expect(await activate(id, 'c'.repeat(64))).toEqual({ status: 'invalid' });
    expect((await row(id)).status).toBe('pending_confirmation');
    expect(await activate(id)).toEqual({ status: 'active', activated: true, store_id: 'store-1', store_name: 'Store One' });
    const live = await row(id);
    expect(live).toMatchObject({ status: 'active', store_id: 'store-1', store_name: 'Store One', api_key: JSON.parse(key) });
    expect(await activate(id)).toEqual({ status: 'active', activated: false, store_id: 'store-1', store_name: 'Store One' });
    expect((await row(id)).order_cache_version).toBe(live.order_cache_version);
    expect(await installRow(id)).toMatchObject({ staged_key: null, staged_key_hash: null, outcome: 'active' });
  });
  it('a discarded staging erases the key and kills the link', async () => {
    const id = await site(); await begin(id, nonce, '4'.repeat(64)); await stage(id);
    expect(await discard(id, 'rejected', 'c'.repeat(64))).toBe(false);
    expect(await discard(id)).toBe(true);
    expect(await discard(id)).toBe(false);
    expect(await installRow(id)).toMatchObject({ staged_key: null, staged_key_hash: null, outcome: 'rejected' });
    expect(await row(id)).toMatchObject({ status: 'pending', api_key: null, last_error: 'install_rejected' });
    expect(await activate(id)).toEqual({ status: 'invalid' });
    expect(await stage(id)).toBe(false);
    await expect(discard(id, 'active')).rejects.toThrow('invalid_outcome');
  });
  it('expired staging is discarded at the database boundary, never activated', async () => {
    const id = await site(); await begin(id, nonce, '5'.repeat(64)); await stage(id);
    await db.query("update easyorders_install_states set staged_expires_at=now()-interval '1 second' where widget_site_id=$1", [id]);
    expect(await activate(id)).toEqual({ status: 'expired' });
    expect(await installRow(id)).toMatchObject({ staged_key: null, outcome: 'expired' });
    expect(await row(id)).toMatchObject({ status: 'pending', api_key: null });
    expect(await activate(id)).toEqual({ status: 'expired' });
  });
  it('rejects expired state at the database boundary', async () => {
    const id = await site(); await begin(id, nonce, 'c'.repeat(64));
    await db.query("update easyorders_install_states set expires_at=now()-interval '1 second' where widget_site_id=$1", [id]);
    expect(await stage(id)).toBe(false);
    expect(await activate(id)).toEqual({ status: 'expired' });
    expect((await row(id)).api_key).toBeNull();
  });
  it('spends only the staged key budget for the verification read', async () => {
    const id = await site(); const tok = '6'.repeat(64);
    await begin(id, nonce, tok); await stage(id, nonce, 'owner', 'staged-hash');
    expect((await reserve(id, tok)).success).toBe(false);
    expect((await reserve(id, tok, true)).success).toBe(true);
    expect(await value('select cardinality(request_times) as v from easyorders_api_budgets where api_key_hash=$1', ['staged-hash'])).toBe(1);
    await db.query('select cooldown_easyorders($1,$2,120)', [id, tok]);
    expect((await reserve(id, tok, true)).success).toBe(false);
    await discard(id, 'unverified');
    expect((await reserve(id, tok, true)).success).toBe(false);
  });
  it('supersedes a previous link and refuses overwriting an active connection', async () => {
    const id = await site(); await begin(id, nonce, 'd'.repeat(64));
    await begin(id, 'e'.repeat(64), 'f'.repeat(64));
    expect(await complete(id)).toBe(false);
    expect(await complete(id, 'e'.repeat(64))).toBe(true);
    expect(await begin(id, nonce, 'd'.repeat(64))).toBe(false);
    expect((await row(id)).webhook_token).toBe('f'.repeat(64));
  });
  it('refuses a key another site already holds and discards the staging', async () => {
    const a = await active(); const b = await site(); await begin(b, nonce, '1'.repeat(64));
    expect(await stage(b, nonce, 'owner', a.id)).toBe(true); // staging never blocks the key's real owner
    expect(await activate(b)).toEqual({ status: 'conflict' });
    expect(await row(b)).toMatchObject({ status: 'pending', api_key: null, api_key_hash: null });
    expect(await installRow(b)).toMatchObject({ staged_key: null, outcome: 'rejected' });
    expect((await row(a.id)).status).toBe('active');
  });
});
describe('shared API ceiling and health', () => {
  it('permits exactly 40 requests in the rolling minute, not 41', async () => {
    const { id, tok } = await active();
    for (let i = 0; i < 40; i++) expect((await reserve(id, tok)).success).toBe(true);
    expect((await reserve(id, tok)).success).toBe(false);
    expect((await reserve(id, '9'.repeat(64))).success).toBe(false);
    await db.query("update easyorders_api_budgets set request_times=array[now()-interval '61 seconds'] where api_key_hash=$1", [id]);
    expect((await reserve(id, tok)).success).toBe(true);
  });
  it('persists provider cooldown, even across independent callers', async () => {
    const { id, tok } = await active();
    await reserve(id, tok);
    await db.query('select cooldown_easyorders($1,$2,120)', [id, tok]);
    const result = await reserve(id, tok);
    expect(result.success).toBe(false);
    expect(result.reset).toBeGreaterThan(Date.now() + 100000);
  });
  it('does not refill a key budget by disconnecting and installing on another site', async () => {
    const { id, tok } = await active();
    for (let i = 0; i < 40; i++) await reserve(id, tok);
    await db.query('select begin_easyorders_disconnect($1,$2)', [id, tok]);
    expect((await reserve(id, tok)).success).toBe(false); // no reads while disconnecting
    await db.query('select finish_easyorders_disconnect($1,$2)', [id, tok]);
    const next = await site(); const nextToken = next.replaceAll('-', '').repeat(2);
    await begin(next, nonce, nextToken); await complete(next, nonce, 'owner', id);
    expect((await reserve(next, nextToken)).success).toBe(false);
  });
  it('records delivery time at most once a minute and the cache epoch only on a status change', async () => {
    const { id, tok } = await active();
    const record = (changed: boolean, t = tok) => value<boolean>('select record_easyorders_webhook($1,$2,$3) as v', [id, t, changed]);
    const xmin = async () => value<string>('select xmin::text as v from easyorders_connections where widget_site_id=$1', [id]);
    expect(await record(false, token)).toBe(false);
    const before = await row(id);
    expect(await record(false)).toBe(true);
    const first = await row(id);
    expect(first.last_webhook_at).not.toBeNull();
    expect(first.order_cache_version).toBe(before.order_cache_version);
    // Within the minute an unchanged delivery does not write the row at all.
    const version = await xmin();
    expect(await record(false)).toBe(true);
    expect(await xmin()).toBe(version);
    expect(await record(true)).toBe(true);
    const changed = await row(id);
    expect(changed.order_cache_version).toBe(Number(before.order_cache_version) + 1);
    expect(changed.last_webhook_at).toBe(first.last_webhook_at);
    await db.query("update easyorders_connections set last_webhook_at=now()-interval '61 seconds' where widget_site_id=$1", [id]);
    expect(await record(false)).toBe(true);
    expect(Date.parse(String((await row(id)).last_webhook_at))).toBeGreaterThan(Date.now() - 5000);
  });
  it('stores coarse API health and disables lookups on revoked credentials', async () => {
    const { id, tok } = await active();
    await db.query("select record_easyorders_api_result($1,$2,'api_unavailable')", [id, tok]);
    expect((await row(id)).last_error).toBe('api_unavailable');
    await db.query('select record_easyorders_api_result($1,$2,null)', [id, tok]);
    expect((await row(id)).last_error).toBeNull();
    await expect(db.query("select record_easyorders_api_result($1,$2,'private error body')", [id, tok])).rejects.toThrow('invalid_error');
    await db.query("select record_easyorders_api_result($1,$2,'unauthorized')", [id, tok]);
    expect((await row(id)).status).toBe('error');
    expect((await reserve(id, tok)).success).toBe(false);
    expect(await value<{ success: boolean }>('select reserve_easyorders_request($1,$2,true) as v', [id, tok])).toMatchObject({ success: true });
  });
});
describe('product knowledge and disconnect transactions', () => {
  it('imports only this connection, preserves manual entries and disables stale products', async () => {
    const { id, tok } = await active();
    await db.query("insert into messenger_knowledge(widget_site_id,title,content,source) values($1,'Manual','Keep','manual')", [id]);
    const sync = (entries: unknown, t = tok) => value<number>('select sync_easyorders_knowledge($1,$2,$3) as v', [id, t, JSON.stringify(entries)]);
    expect(await sync([{ id: '1', title: 'Shirt', content: 'Cotton' }])).toBe(1);
    await sync([{ id: '2', title: 'Dress', content: 'Linen' }]);
    expect(await value("select status as v from messenger_knowledge where widget_site_id=$1 and source='manual'", [id])).toBe('active');
    expect(await value("select status as v from messenger_knowledge where widget_site_id=$1 and easyorders_product_id='1'", [id])).toBe('disabled');
    await expect(sync([], token)).rejects.toThrow('connection_unavailable');
    await expect(sync(Array(51).fill({ id: 'x', title: 'x', content: 'x' }))).rejects.toThrow('invalid_products');
  });
  it('revokes pending state and imported knowledge, then clears only connection credentials', async () => {
    const { id, tok } = await active();
    await value('select sync_easyorders_knowledge($1,$2,$3) as v', [id, tok, '[{"id":"x","title":"x","content":"x"}]']);
    expect(await value('select begin_easyorders_disconnect($1,$2) as v', [id, tok])).toBe(true);
    expect((await row(id)).api_key).not.toBeNull(); // key retained until remote cleanup succeeds
    expect(await value('select finish_easyorders_disconnect($1,$2) as v', [id, tok])).toBe(true);
    expect(await row(id)).toMatchObject({ status: 'disconnected', api_key: null, api_key_hash: null });
    expect((await reserve(id, tok)).success).toBe(false);
    expect(await value('select record_easyorders_webhook($1,$2,true) as v', [id, tok])).toBe(false);
    expect(await complete(id)).toBe(false);
  });
  it('disconnecting a pending install invalidates its callback', async () => {
    const id = await site(); await begin(id, nonce, '2'.repeat(64));
    await db.query('select begin_easyorders_disconnect($1,$2)', [id, '2'.repeat(64)]);
    expect(await complete(id)).toBe(false);
  });
  it('disconnecting a staged install erases the staged key', async () => {
    const id = await site(); await begin(id, nonce, '7'.repeat(64)); await stage(id);
    expect(await value('select begin_easyorders_disconnect($1,$2) as v', [id, '7'.repeat(64)])).toBe(true);
    expect(await installRow(id)).toMatchObject({ staged_key: null, staged_key_hash: null });
    expect(await activate(id)).toEqual({ status: 'invalid' });
  });
  it('a newer link supersedes a staged key', async () => {
    const id = await site(); await begin(id, nonce, '8'.repeat(64)); await stage(id);
    expect(await begin(id, 'e'.repeat(64), '9'.repeat(64))).toBe(true);
    expect(await installRow(id)).toMatchObject({ staged_key: null, outcome: null, nonce_hash: 'e'.repeat(64) });
    expect((await row(id)).status).toBe('pending');
    expect(await activate(id)).toEqual({ status: 'invalid' });
  });
});
