// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

let db: PGlite;
const root = resolve(process.cwd(), '../..');
const read = async (file: string) => (await readFile(resolve(root, file), 'utf8')).replace(/^\uFEFF/, '');
const END = new Date(Date.now() + 25 * 86_400_000).toISOString();
type Result = { status?: string; app_handle?: string | null; ok?: boolean };
async function operation(installation: string, action: string, lease: string, payload: Record<string, unknown> = {}) {
  const result = await db.query<{ value: Result }>(
    'select shopify_app_pricing_operation($1,$2,$3,$4::jsonb) as value',
    [installation, action, lease, JSON.stringify({ distribution: 'public', ...payload })]);
  return result.rows[0].value;
}
async function install(prefix: string, app = 'public-app') {
  const shop = `${prefix}.myshopify.com`;
  await db.query('insert into tryon_shops(shop_domain) values ($1) on conflict do nothing', [shop]);
  const result = await db.query<{ id: string }>(`insert into shopify_installations
    (shop_domain,app_client_id,status,authorized_at,access_token_ciphertext,token_iv,token_tag)
    values ($1,$2,'active',clock_timestamp(),'ciphertext','iv','tag') returning id`, [shop, app]);
  return { shop, id: result.rows[0].id };
}
async function sync(id: string, plan = 'launch-v1', end: string | null = END) {
  const lease = randomUUID();
  expect((await operation(id, 'claim', lease, { force: true })).status).toBe('acquired');
  return operation(id, 'apply', lease, { plan_key: plan, current_period_end: end, app_handle: 'grindctrl' });
}
async function balance(shop: string) {
  return (await db.query<{ plan_remaining: number; top_up_remaining: number }>(
    'select b.* from tryon_subscriptions s cross join lateral tryon_credit_balance(s.id) b where s.shop_domain=$1', [shop])).rows[0];
}
async function spend(shop: string, count: number) {
  for (let index = 0; index < count; index++) {
    const key = randomUUID();
    await db.query('select * from reserve_tryon_credit($1,$2,$3,$4,$5,$6)', [shop, key, key, 'session', 'product', 'lite']);
  }
}
async function grantCount(shop: string) {
  return (await db.query<{ count: number }>(
    "select count(*)::integer as count from tryon_credit_ledger where shop_domain=$1 and entry_type='grant'", [shop])).rows[0].count;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema extensions;
    create function extensions.uuid_generate_v4() returns uuid language sql as 'select gen_random_uuid()';
    create table tryon_shops(shop_domain text primary key,status text default 'installed',installed_at timestamptz,
      last_seen_at timestamptz,updated_at timestamptz,uninstalled_at timestamptz);
    create table tryon_jobs(id text primary key,session_id text,product_id text,shop text,status text not null,
      message text,provider text,cost_usd numeric,duration_ms integer,created_at timestamptz not null default now());`);
  await db.exec(await read('supabase-migration-plans.sql'));
  // The historic foundation seeds an older catalog; represent the current
  // catalog explicitly, then exercise the actual additive SQL unchanged.
  await db.exec(`update tryon_plans set active=false where plan_key in ('free-v1','dfy-v1');
    update tryon_plans set renders_included=150,external_refs='{"other":{"keep":true}}' where plan_key='launch-v1';
    insert into tryon_plans(plan_key,name,price_minor,currency,renders_included,model_key,is_free,external_refs) values
      ('free-v2','Free',0,'USD',15,'lite',true,'{}'),
      ('growth-v1','Growth',2900,'USD',350,'lite',false,'{}'),
      ('pro-v1','Pro',4900,'USD',650,'lite',false,'{}'),
      ('launch-v1-egp','Launch',75000,'EGP',150,'lite',false,'{"other":"preserved"}');`);
  await db.exec(await read('supabase/20261024_shopify_installation_isolation.sql'));
  await db.exec(await read('supabase/20261016_tryon_credit_balance.sql'));
  const sql = await read('supabase/20261101_shopify_app_pricing.sql');
  await db.exec(sql);
  await db.exec(sql);
}, 60_000);
afterAll(async () => { await db?.close(); });

describe('Shopify App Pricing uses the real canonical subscription and credit SQL', () => {
  it('adds only the four USD refs, preserves other refs and can be reapplied', async () => {
    const rows = (await db.query<{ plan_key: string; external_refs: Record<string, unknown> }>(
      'select plan_key,external_refs from tryon_plans order by plan_key')).rows;
    expect(rows.find((row) => row.plan_key === 'launch-v1')?.external_refs).toEqual({
      other: { keep: true }, shopify_app_pricing: { handle: 'launch' },
    });
    expect(rows.find((row) => row.plan_key === 'launch-v1-egp')?.external_refs).toEqual({ other: 'preserved' });
    expect(rows.filter((row) => row.external_refs.shopify_app_pricing)).toHaveLength(4);
  });

  it('grants the mapped allowance once; a replay and a later unchanged snapshot preserve spent looks', async () => {
    const { id, shop } = await install('replay');
    expect(await sync(id)).toMatchObject({ status: 'applied' });
    expect((await balance(shop)).plan_remaining).toBe(150);
    await spend(shop, 2);
    const grants = await grantCount(shop);
    expect(await sync(id)).toMatchObject({ status: 'unchanged' });
    expect((await balance(shop)).plan_remaining).toBe(148);
    expect(await grantCount(shop)).toBe(grants);
    expect((await db.query('select * from tryon_subscriptions where shop_domain=$1', [shop])).rows).toHaveLength(1);
  });

  it('serializes competing snapshots and fences a slow response after lease expiry', async () => {
    const { id, shop } = await install('out-of-order');
    const old = randomUUID(), latest = randomUUID();
    expect((await operation(id, 'claim', old)).status).toBe('acquired');
    expect((await operation(id, 'claim', latest, { force: true })).status).toBe('busy');
    await db.query("update shopify_installations set pricing_lease_expires_at=clock_timestamp()-interval '1 second' where id=$1", [id]);
    expect((await operation(id, 'claim', latest, { force: true })).status).toBe('acquired');
    await operation(id, 'apply', latest, { plan_key: 'pro-v1', current_period_end: END });
    await expect(operation(id, 'apply', old, { plan_key: 'launch-v1', current_period_end: END })).rejects.toThrow('pricing_lease_lost');
    expect((await balance(shop)).plan_remaining).toBe(650);
  });

  it('ignores custom/development installations and rejects a missing installation token', async () => {
    const { id, shop } = await install('custom', 'custom-app');
    for (const distribution of ['custom', 'development']) {
      expect(await operation(id, 'claim', randomUUID(), { distribution })).toEqual({ status: 'ignored' });
    }
    expect((await db.query('select * from tryon_subscriptions where shop_domain=$1', [shop])).rows).toHaveLength(0);
    await db.query('update shopify_installations set access_token_ciphertext=null,token_iv=null,token_tag=null where id=$1', [id]);
    await expect(operation(id, 'claim', randomUUID())).rejects.toThrow('pricing_installation_unavailable');
  });

  it('fences snapshots from before reinstall and makes stale release harmless', async () => {
    const { id, shop } = await install('reinstall');
    const first = randomUUID();
    await operation(id, 'claim', first);
    await db.query("update shopify_installations set authorized_at=authorized_at+interval '1 second' where id=$1", [id]);
    await expect(operation(id, 'apply', first, { plan_key: 'launch-v1', current_period_end: END })).rejects.toThrow('pricing_lease_lost');
    await operation(id, 'release', first);
    const second = randomUUID();
    expect((await operation(id, 'claim', second)).status).toBe('acquired');
    await operation(id, 'release', first);
    expect((await operation(id, 'claim', randomUUID())).status).toBe('busy');
    await operation(id, 'apply', second, { plan_key: 'free-v2' });
    expect((await balance(shop)).plan_remaining).toBe(15);
  });

  it('throttles successful bootstrap sync, forces webhooks, and does not throttle failed reads', async () => {
    const { id } = await install('throttle');
    const failed = randomUUID();
    await operation(id, 'claim', failed);
    await operation(id, 'release', failed);
    expect((await operation(id, 'claim', failed)).status).toBe('acquired');
    await operation(id, 'apply', failed, { plan_key: 'free-v2', app_handle: 'grindctrl' });
    expect(await operation(id, 'claim', randomUUID())).toEqual({ status: 'throttled', app_handle: 'grindctrl' });
    expect((await operation(id, 'claim', randomUUID(), { force: true })).status).toBe('acquired');
  });

  it('downgrades to Free without retaining paid allowance, preserves packs, and cannot refill by cycling', async () => {
    const { id, shop } = await install('cycle');
    await sync(id);
    await spend(shop, 20);
    await db.query('select apply_tryon_top_up($1,$2,$3,$4)', [shop, 'pack-lite-v1', 'manual paid pack', randomUUID()]);
    expect(await sync(id, 'free-v2', null)).toMatchObject({ status: 'applied' });
    expect(await balance(shop)).toEqual({ plan_remaining: 0, top_up_remaining: 80 });
    await sync(id);
    expect(await balance(shop)).toEqual({ plan_remaining: 130, top_up_remaining: 80 });
    await sync(id, 'growth-v1');
    expect(await balance(shop)).toEqual({ plan_remaining: 330, top_up_remaining: 80 });
    await sync(id);
    expect(await balance(shop)).toEqual({ plan_remaining: 130, top_up_remaining: 80 });
  });

  it('uses Shopify period end and refuses expired/EGP/unmapped paid snapshots without mutation', async () => {
    const { id, shop } = await install('periods');
    await sync(id);
    const rows = await db.query<{ period_end: string; provider: string }>(
      'select current_period_end::text as period_end,external_provider as provider from tryon_subscriptions where shop_domain=$1', [shop]);
    expect(new Date(rows.rows[0].period_end).toISOString()).toBe(END);
    expect(rows.rows[0].provider).toBe('shopify_app_pricing');
    for (const plan of ['launch-v1-egp', 'dfy-v1']) {
      const lease = randomUUID();
      await operation(id, 'claim', lease, { force: true });
      await expect(operation(id, 'apply', lease, { plan_key: plan, current_period_end: END })).rejects.toThrow('pricing_plan_unmapped');
      await operation(id, 'release', lease);
    }
    const lease = randomUUID();
    await operation(id, 'claim', lease, { force: true });
    await expect(operation(id, 'apply', lease, { plan_key: 'launch-v1', current_period_end: '2020-01-01' })).rejects.toThrow('pricing_period_invalid');
    expect((await balance(shop)).plan_remaining).toBe(150);
  });

  it('isolates cached handles by installation and denies browser RPC execution', async () => {
    const first = await install('handles', 'app-a');
    const second = await install('handles', 'app-b');
    await sync(first.id, 'free-v2', null);
    expect((await operation(second.id, 'claim', randomUUID())).app_handle).toBeNull();
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`);
      try {
        await expect(operation(first.id, 'claim', randomUUID())).rejects.toThrow('permission denied');
        await expect(db.query('select pricing_app_handle from shopify_installations')).rejects.toThrow('permission denied');
      } finally { await db.exec('reset role'); }
    }
  });
});
