// @vitest-environment node
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

let db: PGlite;
const root = resolve(process.cwd(), '../..');
const read = (file: string) => readFile(resolve(root, file), 'utf8');
type Counts = { subscriptions: number; rolledOver: number; grace: number; expired: number;
  cancelled: number; expiredGrants: number; staleJobs: number };

async function reconcile(limit = 100) {
  return (await db.query<{ value: Counts }>(
    'select public.reconcile_tryon_plans($1) as value', [limit])).rows[0].value;
}
async function subscription(options: {
  shop?: string; plan?: string; endedDaysAgo?: number; installed?: boolean;
  status?: string; cancel?: boolean; anchor?: string;
} = {}) {
  const shop = options.shop ?? `${randomUUID()}.myshopify.com`;
  await db.query('insert into tryon_shops(shop_domain,status) values ($1,$2)',
    [shop, options.installed === false ? 'uninstalled' : 'installed']);
  const result = await db.query<{ id: string }>(`insert into tryon_subscriptions
    (shop_domain,plan_id,status,billing_anchor_at,current_period_start,current_period_end,
      grace_ends_at,activation_source,cancel_at_period_end,expired_at)
    select $1,p.id,$2,coalesce($3::timestamptz,now()-interval '90 days'),
      now()-interval '40 days',now()-make_interval(days=>$4),
      now()-make_interval(days=>$4)+make_interval(days=>p.grace_days),'manual',$5,
      case when $2 in ('expired','cancelled') then now()-interval '1 day' else null end
    from tryon_plans p where p.plan_key=$6 returning id`,
  [shop, options.status ?? 'active', options.anchor ?? null,
    options.endedDaysAgo ?? 1, options.cancel ?? false, options.plan ?? 'free-v1']);
  return { shop, id: result.rows[0].id };
}
async function grant(id: string, kind: 'plan' | 'pack', daysUntilExpiry: number, amount = 20) {
  const result = await db.query<{ id: string }>(`insert into tryon_credit_ledger
    (shop_domain,subscription_id,plan_id,credit_pack_id,entry_type,amount,reason,idempotency_key,expires_at)
    select s.shop_domain,s.id,case when $2='plan' then s.plan_id else null end,
      case when $2='pack' then (select id from tryon_credit_packs where pack_key='pack-lite-v1') else null end,
      'grant',$3,'fixture',$4,now()+make_interval(days=>$5)
    from tryon_subscriptions s where s.id=$1 returning id`,
  [id, kind, amount, randomUUID(), daysUntilExpiry]);
  return result.rows[0].id;
}
async function state(id: string) {
  return (await db.query<{ status: string; plan_id: string; pending_plan_id: string | null;
    current: boolean; anchor: string; period_start: string }>(`select status,plan_id,pending_plan_id,
      current_period_start<=now() and now()<current_period_end as current,
      billing_anchor_at::text as anchor,current_period_start::text as period_start
    from tryon_subscriptions where id=$1`, [id])).rows[0];
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema extensions;
    create function extensions.uuid_generate_v4() returns uuid language sql as 'select gen_random_uuid()';
    create table shopify_installations(id uuid primary key);
    create table tryon_shops(shop_domain text primary key,status text default 'installed');
    create table tryon_jobs(id text primary key,session_id text,product_id text,shop text,status text not null,
      message text,provider text,cost_usd numeric,duration_ms integer,created_at timestamptz default now());`);
  await db.exec(await read('supabase-migration-plans.sql'));
  const sql = await read('supabase/20261106_tryon_plan_reconcile.sql');
  await db.exec(sql);
  await db.exec(sql); // Same real migration must be safely re-applicable.
}, 60_000);
beforeEach(async () => { await db.exec('begin'); });
afterEach(async () => { await db.exec('rollback'); });
afterAll(async () => { await db?.close(); });

describe('bounded plan reconciliation executes actual PostgreSQL migrations', () => {
  it.each(['shop.myshopify.com', 'site:12345678-1234-1234-1234-123456789abc'])(
    'rolls %s free credits to the current anchored period without missed-period backfill', async (shop) => {
      const { id } = await subscription({ shop, anchor: '2024-01-31T10:30:00Z' });
      const old = await grant(id, 'plan', -1);
      expect(await reconcile()).toEqual({ subscriptions: 1, rolledOver: 1, grace: 0,
        expired: 0, cancelled: 0, expiredGrants: 1, staleJobs: 0 });
      const current = await state(id);
      expect(current).toMatchObject({ status: 'active', current: true });
      expect(new Date(current.anchor).toISOString()).toBe('2024-01-31T10:30:00.000Z');
      const grants = (await db.query<{ amount: number }>(
        "select amount from tryon_credit_ledger where subscription_id=$1 and entry_type='grant' and id<>$2", [id, old])).rows;
      expect(grants).toEqual([{ amount: 20 }]);
      expect(await reconcile()).toEqual({ subscriptions: 0, rolledOver: 0, grace: 0,
        expired: 0, cancelled: 0, expiredGrants: 0, staleJobs: 0 });
    });

  it.each(['paid.myshopify.com', 'site:12345678-1234-1234-1234-123456789abd'])(
    'moves unpaid %s to grace without granting or changing its scheduled downgrade', async (shop) => {
      const { id } = await subscription({ shop, plan: 'dfy-v1' });
      await db.query(`update tryon_subscriptions set pending_plan_id=(select id from tryon_plans where plan_key='launch-v1'),
        pending_plan_effective_at=current_period_end where id=$1`, [id]);
      const before = await state(id);
      await grant(id, 'plan', -1, 450);
      const pack = await grant(id, 'pack', 30, 80);
      expect(await reconcile()).toMatchObject({ subscriptions: 1, grace: 1, rolledOver: 0, expiredGrants: 1 });
      expect(await state(id)).toMatchObject({ status: 'grace', plan_id: before.plan_id,
        pending_plan_id: before.pending_plan_id });
      expect((await db.query("select id from tryon_credit_ledger where source_grant_id=$1 and entry_type='expire'", [pack])).rows).toHaveLength(0);
      expect((await reconcile()).subscriptions).toBe(0);
    });

  it('expires grace exactly at its boundary and freezes unexpired packs without consuming them', async () => {
    const { id } = await subscription({ plan: 'launch-v1', endedDaysAgo: 3, status: 'grace' });
    const pack = await grant(id, 'pack', 30, 80);
    expect(await reconcile()).toMatchObject({ subscriptions: 1, expired: 1, expiredGrants: 0 });
    expect((await state(id)).status).toBe('expired');
    expect((await db.query('select * from tryon_credit_ledger where source_grant_id=$1', [pack])).rows).toHaveLength(0);
    expect((await reconcile()).subscriptions).toBe(0);
  });

  it('closes only unused balances and expires packs on their own date even for terminal tenants', async () => {
    const { id } = await subscription({ plan: 'launch-v1', status: 'expired' });
    const expiredPack = await grant(id, 'pack', -1, 80);
    await grant(id, 'pack', 1, 80);
    await db.exec("insert into tryon_jobs(id,status) values ('spent','completed')");
    await db.query(`insert into tryon_credit_ledger (shop_domain,subscription_id,entry_type,
      amount,reason,source_grant_id,job_id,idempotency_key)
      select shop_domain,id,'debit',-1,'fixture',$2,'spent','spent' from tryon_subscriptions where id=$1`, [id, expiredPack]);
    expect(await reconcile()).toMatchObject({ subscriptions: 0, expiredGrants: 1 });
    expect((await db.query<{ amount: number }>(
      "select amount from tryon_credit_ledger where source_grant_id=$1 and entry_type='expire'", [expiredPack])).rows)
      .toEqual([{ amount: -79 }]);
    expect((await reconcile()).expiredGrants).toBe(0);
  });

  it('does not renew uninstalled free tenants; cancellation stops even free renewal', async () => {
    const uninstalled = await subscription({ installed: false });
    const cancelled = await subscription({ cancel: true });
    expect(await reconcile()).toMatchObject({ subscriptions: 1, cancelled: 1, rolledOver: 0 });
    expect((await state(uninstalled.id)).current).toBe(false);
    expect((await state(cancelled.id)).status).toBe('cancelled');
    expect((await reconcile()).subscriptions).toBe(0);
  });

  it('bounds lifecycle and ledger-expiry work independently and drains the next batch', async () => {
    for (let index = 0; index < 3; index++) {
      const { id } = await subscription({ plan: 'launch-v1', endedDaysAgo: 4 });
      await grant(id, 'plan', -1);
    }
    expect(await reconcile(1)).toMatchObject({ subscriptions: 1, expired: 1, expiredGrants: 1 });
    expect(await reconcile(1)).toMatchObject({ subscriptions: 1, expired: 1, expiredGrants: 1 });
    expect(await reconcile(1)).toMatchObject({ subscriptions: 1, expired: 1, expiredGrants: 1 });
    expect(await reconcile(1)).toEqual({ subscriptions: 0, rolledOver: 0, grace: 0,
      expired: 0, cancelled: 0, expiredGrants: 0, staleJobs: 0 });
  });

  it('handles old daily anchors beyond the legacy 1200-period loop and clamps invalid batch sizes', async () => {
    await db.exec("update tryon_plans set period_unit='day' where plan_key='free-v1'");
    const { id } = await subscription({ anchor: '2000-01-01T00:00:00Z' });
    await subscription({ plan: 'launch-v1', endedDaysAgo: 4 });
    expect((await reconcile(0)).subscriptions).toBe(1);
    await reconcile();
    expect(await state(id)).toMatchObject({ status: 'active', current: true });
  });

  it('caps caller-supplied large batches at 500 subscriptions', async () => {
    await db.exec(`insert into tryon_shops(shop_domain,status)
      select 'batch-' || i || '.myshopify.com','installed' from generate_series(1,501) i;
      insert into tryon_subscriptions (shop_domain,plan_id,status,billing_anchor_at,
        current_period_start,current_period_end,grace_ends_at,activation_source)
      select sh.shop_domain,p.id,'active',now()-interval '90 days',now()-interval '40 days',
        now()-interval '4 days',now()-interval '1 day','manual'
      from tryon_shops sh cross join tryon_plans p where p.plan_key='launch-v1'`);
    expect((await reconcile(10000)).subscriptions).toBe(500);
    expect((await reconcile(10000)).subscriptions).toBe(1);
    expect((await reconcile()).subscriptions).toBe(0);
  });

  it('uses original calendar anchors across short months', async () => {
    const rows = (await db.query<{ february: string; march: string }>(`select
      tryon_period_boundary('2024-01-31T10:30:00Z','month',1,1)::text as february,
      tryon_period_boundary('2024-01-31T10:30:00Z','month',1,2)::text as march`)).rows[0];
    expect(new Date(rows.february).toISOString()).toBe('2024-02-29T10:30:00.000Z');
    expect(new Date(rows.march).toISOString()).toBe('2024-03-31T10:30:00.000Z');
  });

  it('refunds stale billable processing jobs in bounded batches without inventing provider costs', async () => {
    const { id, shop } = await subscription({ plan: 'launch-v1', endedDaysAgo: -10 });
    const source = await grant(id, 'plan', 10);
    for (let index = 0; index < 3; index++) {
      await db.query(`insert into tryon_jobs(id,shop,status,billable,subscription_id,created_at,cost_usd)
        values($1,$2,'processing',true,$3,now()-interval '11 minutes',$4)`,
      [`stale-${index}`, shop, id, index === 0 ? 0.03 : null]);
      await db.query(`insert into tryon_credit_ledger (shop_domain,subscription_id,entry_type,
        amount,reason,source_grant_id,job_id,idempotency_key)
        values($1,$2,'debit',-1,'fixture',$3,$4,$4)`, [shop, id, source, `stale-${index}`]);
    }
    expect((await reconcile(1)).staleJobs).toBe(1);
    expect((await reconcile(1)).staleJobs).toBe(1);
    expect((await reconcile(1)).staleJobs).toBe(1);
    expect((await reconcile(1)).staleJobs).toBe(0);
    expect((await db.query<{ status: string; cost_usd: string | null }>(
      'select status,cost_usd::text from tryon_jobs order by id')).rows).toEqual([
      { status: 'failed', cost_usd: '0.03' }, { status: 'failed', cost_usd: null },
      { status: 'failed', cost_usd: null },
    ]);
    expect((await db.query<{ count: number }>(
      "select count(*)::integer as count from tryon_credit_ledger where entry_type='refund'")).rows[0].count).toBe(3);
  });

  it('denies browser execution and permits only the service-role entry point', async () => {
    for (const role of ['anon', 'authenticated']) {
      await db.exec('savepoint role_test');
      await db.exec(`set role ${role}`);
      await expect(reconcile()).rejects.toThrow('permission denied');
      await db.exec('rollback to savepoint role_test; release savepoint role_test');
    }
    await db.exec('set role service_role');
    expect((await reconcile()).subscriptions).toBe(0);
    await db.exec('reset role');
  });
});
