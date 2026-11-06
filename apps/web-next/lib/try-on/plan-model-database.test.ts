// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { TRYON_MODEL_ALIASES, TRYON_PROVIDER_MODELS } from './models';

let db: PGlite;
const root = resolve(process.cwd(), '../..');
const read = async (file: string) => (await readFile(resolve(root, file), 'utf8')).replace(/^\uFEFF/, '');

async function tenant(model: string, site = false) {
  const shop = site ? `site:${randomUUID()}` : `model-${randomUUID()}.myshopify.com`;
  await db.query('insert into tryon_shops(shop_domain) values ($1)', [shop]);
  await db.query('select ensure_free_tryon_subscription($1)', [shop]);
  const planKey = `model-${randomUUID()}`;
  const { rows } = await db.query<{ id: string }>(`insert into tryon_plans
    (plan_key,name,price_minor,currency,renders_included,model_key,is_free)
    values ($1,'Model test',100,'USD',20,$2,false) returning id`, [planKey, model]);
  await db.query('update tryon_subscriptions set plan_id=$1 where shop_domain=$2', [rows[0].id, shop]);
  return shop;
}

async function reserve(shop: string, key = randomUUID(), fallback = 'meta/muse-image') {
  const { rows } = await db.query<{
    job_id: string; created: boolean; recorded_model_key: string; model_fallback_reason: string | null;
  }>('select * from reserve_tryon_plan_credit($1,$2,$3,$4,$5,$6)', [
    shop, `tryon_${key}`, key, 'session', 'product', fallback,
  ]);
  return rows[0];
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
  const sql = await read('supabase/20261106_tryon_job_model.sql');
  await db.exec(sql);
  await db.exec(sql);
}, 60_000);
afterAll(async () => { await db?.close(); });

describe('real SQL plan-model reservation', () => {
  it('keeps the design catalog key bounds while allowing reviewed provider ids', async () => {
    for (const model of ['', '   ', 'x'.repeat(201)]) {
      await expect(db.query(`insert into tryon_plans
        (plan_key,name,price_minor,currency,renders_included,model_key,is_free)
        values ($1,'Invalid model',100,'USD',20,$2,false)`, [`invalid-${randomUUID()}`, model]))
        .rejects.toThrow('tryon_plans_model_check');
    }
  });

  for (const site of [false, true]) {
    it.each(Object.entries(TRYON_MODEL_ALIASES))(
      `pins catalog alias %s for ${site ? 'site' : 'Shopify'} tenants`, async (alias, expected) => {
        const shop = await tenant(alias, site);
        const row = await reserve(shop);
        expect(row).toMatchObject({ created: true, recorded_model_key: expected, model_fallback_reason: null });
        const job = await db.query<{ model_key: string }>('select model_key from tryon_jobs where id=$1', [row.job_id]);
        expect(job.rows[0].model_key).toBe(expected);
      },
    );
  }

  it.each(TRYON_PROVIDER_MODELS)('accepts allowlisted provider id %s directly', async (model) => {
    expect((await reserve(await tenant(model))).recorded_model_key).toBe(model);
  });

  it('falls back for an unknown catalog key and refuses an arbitrary fallback string', async () => {
    const shop = await tenant('arbitrary/merchant-model');
    expect(await reserve(shop, randomUUID(), 'google/gemini-3.1-flash-image')).toMatchObject({
      recorded_model_key: 'google/gemini-3.1-flash-image', model_fallback_reason: 'plan_model_unknown',
    });
    expect(await reserve(shop, randomUUID(), 'arbitrary/fallback-model')).toMatchObject({
      recorded_model_key: 'meta/muse-image', model_fallback_reason: 'plan_model_unknown',
    });
  });

  it('keeps the model and single debit when a retry follows a later plan change', async () => {
    const shop = await tenant('flash', true);
    const key = randomUUID();
    const first = await reserve(shop, key);
    await db.query("update tryon_subscriptions set plan_id=(select id from tryon_plans where plan_key='free-v1') where shop_domain=$1", [shop]);
    const retry = await reserve(shop, key, 'google/gemini-3.1-flash-lite-image');
    expect(retry).toMatchObject({
      job_id: first.job_id, created: false, recorded_model_key: 'google/gemini-3.1-flash-image',
    });
    const debits = await db.query<{ count: number }>("select count(*)::integer as count from tryon_credit_ledger where job_id=$1 and entry_type='debit'", [first.job_id]);
    expect(debits.rows[0].count).toBe(1);
  });

  it('uses the current locked plan when a plan changes after a prior read', async () => {
    const shop = await tenant('flash');
    const prior = await db.query<{ model_key: string }>(
      'select p.model_key from tryon_subscriptions s join tryon_plans p on p.id=s.plan_id where s.shop_domain=$1', [shop],
    );
    expect(prior.rows[0].model_key).toBe('flash');
    await db.query("update tryon_subscriptions set plan_id=(select id from tryon_plans where plan_key='free-v1') where shop_domain=$1", [shop]);
    expect((await reserve(shop, randomUUID(), 'google/gemini-3.1-flash-image')).recorded_model_key)
      .toBe('google/gemini-3.1-flash-lite-image');
  });

  it('denies browser roles permission to execute the reservation wrapper', async () => {
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`);
      try {
        await expect(reserve('store.myshopify.com')).rejects.toThrow('permission denied');
      } finally { await db.exec('reset role'); }
    }
  });
});
