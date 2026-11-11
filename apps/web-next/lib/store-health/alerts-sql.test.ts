// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import type { HealthAlert, HealthRepository, HealthSite } from './alerts-store';
import type { HealthAlertDependencies } from './alerts';
import { healthyFacts } from './test-fixtures';

vi.mock('server-only', () => ({}));
vi.mock('./alerts-data', () => ({ readAlertStoreFacts: vi.fn() }));
vi.mock('./owner', () => ({ storeHealthOwner: vi.fn() }));
vi.mock('@/lib/email/store-health-sender', () => ({ sendStoreHealthEmail: vi.fn() }));
import { runStoreHealthAlerts } from './alerts';

const db = new PGlite();
let siteId: string;
const one = async <T,>(sql: string, args: unknown[] = []) => (await db.query<T>(sql, args)).rows[0];
const due = () => db.exec("update widget_sites set store_health_checked_at = now() - interval '16 minutes', store_health_check_until = null");
const repo: HealthRepository = {
  sites: async (token) => (await db.query<HealthSite>('select * from claim_store_health_checks($1::uuid,50)', [token])).rows,
  reconcile: async (site, token, keys) => (await one<{ ok: boolean }>('select reconcile_store_health_alerts($1::uuid,$2::uuid,$3::text[]) as ok', [site, token, keys])).ok,
  pending: async (site) => (await db.query<HealthAlert>("select * from store_health_alerts where site_id=$1 and ((resolved_at is null and alert_delivery='pending') or (resolved_at is not null and recovery_delivery='pending')) order by opened_at,id limit 10", [site])).rows,
  claim: async (row, checkToken, sendToken) => (await one<HealthAlert>('select * from claim_store_health_email($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5)', [row.id, row.site_id, checkToken, sendToken, row.resolved_at !== null])) ?? null,
  finish: async (row, token, outcome) => { await db.query('select finish_store_health_email($1::uuid,$2::uuid,$3,$4)', [row.id, token, row.resolved_at !== null, outcome]); },
  checked: async (site, token, at) => { await db.query('update widget_sites set store_health_checked_at=$3,store_health_check_until=null,store_health_check_token=null where id=$1 and store_health_check_token=$2', [site, token, at]); },
};
let deps: HealthAlertDependencies;

beforeAll(async () => {
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls; create table public.profiles(id uuid primary key, clerk_user_id text); create table public.widget_sites(id uuid primary key default gen_random_uuid(), name text, workspace_id uuid, domain text, settings_json jsonb, settings_version integer not null default 1); grant select,insert,update on widget_sites,profiles to service_role;');
  const sql = await readFile(resolve(process.cwd(), '../../supabase/20261111_store_health_alerts.sql'), 'utf8');
  expect(sql.replace(/^--.*$/gm, '')).not.toMatch(/\b(drop|truncate)\b|\bdelete\s+from\b/i);
  await db.exec(sql); await db.exec(sql);
}, 60_000);
afterAll(async () => { await db.close(); });
beforeEach(async () => {
  await db.exec('reset role; truncate store_health_alerts,widget_sites; set role service_role');
  siteId = randomUUID();
  await db.query("insert into widget_sites(id,name,settings_json) values($1,'Lulu', '{}')", [siteId]);
  const facts = healthyFacts(); facts.tryOn!.looksLeft = 0;
  deps = { repository: () => repo, facts: vi.fn(async () => facts), owner: vi.fn(async () => ({ email: 'owner@example.com', locale: 'en' as const })), send: vi.fn(async () => 'sent' as const) };
});

describe('store health durable checks and sends (migration applied twice)', () => {
  it('sends once per open period, one recovery, and allows a fresh period', async () => {
    await runStoreHealthAlerts(deps); await due(); await runStoreHealthAlerts(deps);
    expect(deps.send).toHaveBeenCalledTimes(1);
    vi.mocked(deps.facts).mockResolvedValue(healthyFacts());
    await due(); await runStoreHealthAlerts(deps); await due(); await runStoreHealthAlerts(deps);
    expect(deps.send).toHaveBeenCalledTimes(2);
    expect(deps.send).toHaveBeenLastCalledWith(expect.objectContaining({ recovery: true }));
    const broken = healthyFacts(); broken.tryOn!.looksLeft = 0;
    vi.mocked(deps.facts).mockResolvedValue(broken);
    await due(); await runStoreHealthAlerts(deps);
    expect(deps.send).toHaveBeenCalledTimes(3);
    expect((await db.query('select id from store_health_alerts')).rows).toHaveLength(2);
  });
  it('has one open problem, one atomic claimant, and fences expired/stale check leases', async () => {
    const token = randomUUID(); await repo.sites(token);
    expect(await repo.reconcile(siteId, token, ['code_gone'])).toBe(true);
    await repo.reconcile(siteId, token, ['code_gone']);
    expect(await repo.reconcile(siteId, randomUUID(), [])).toBe(false);
    const [row] = await repo.pending(siteId);
    const claims = await Promise.all([repo.claim(row, token, randomUUID()), repo.claim(row, token, randomUUID())]);
    expect(claims.filter(Boolean)).toHaveLength(1);
    expect(claims.find(Boolean)?.alerted_at).toBeTruthy();
    await db.query("update widget_sites set store_health_check_until=now()-interval '1 second'");
    expect(await repo.reconcile(siteId, token, [])).toBe(false);
    await expect(db.query("insert into store_health_alerts(site_id,problem_key) values($1,'code_gone')", [siteId])).rejects.toMatchObject({ code: '23505' });
  });
  it('survives a crash after SMTP acceptance without a duplicate, then recovers once', async () => {
    deps.repository = () => ({ ...repo, finish: vi.fn(async () => { throw new Error('crash after send'); }) });
    await runStoreHealthAlerts(deps);
    deps.repository = () => repo;
    await db.exec("update store_health_alerts set send_until=now()-interval '1 second'");
    await due(); await runStoreHealthAlerts(deps);
    expect(deps.send).toHaveBeenCalledTimes(1);
    expect(await one('select alert_delivery from store_health_alerts')).toEqual({ alert_delivery: 'unknown' });
    vi.mocked(deps.facts).mockResolvedValue(healthyFacts());
    await due(); await runStoreHealthAlerts(deps); await due(); await runStoreHealthAlerts(deps);
    expect(deps.send).toHaveBeenCalledTimes(2);
  });
  it('retries definite provider failures four times, gives up and logs, with no orphan recovery', async () => {
    vi.mocked(deps.send).mockResolvedValue('retry');
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    for (let i = 0; i < 6; i++) { await due(); await runStoreHealthAlerts(deps); }
    expect(deps.send).toHaveBeenCalledTimes(4);
    expect(await one('select alert_attempts,alert_delivery,alerted_at from store_health_alerts')).toEqual({ alert_attempts: 4, alert_delivery: 'abandoned', alerted_at: null });
    expect(log).toHaveBeenCalledWith('[store-health] delivery stopped', expect.objectContaining({ attempts: 4 }));
    vi.mocked(deps.facts).mockResolvedValue(healthyFacts());
    await due(); await runStoreHealthAlerts(deps);
    expect(deps.send).toHaveBeenCalledTimes(4);
    log.mockRestore();
  });
  it('retries a failed recovery, then gives up without replaying the original alert', async () => {
    await runStoreHealthAlerts(deps);
    vi.mocked(deps.facts).mockResolvedValue(healthyFacts()); vi.mocked(deps.send).mockResolvedValue('retry');
    for (let i = 0; i < 6; i++) { await due(); await runStoreHealthAlerts(deps); }
    expect(deps.send).toHaveBeenCalledTimes(5);
    expect(await one('select recovery_attempts,recovery_delivery from store_health_alerts')).toEqual({ recovery_attempts: 4, recovery_delivery: 'abandoned' });
  });
  it('retries a pending failure on the next run, succeeds, and never repeats it', async () => {
    vi.mocked(deps.send).mockResolvedValueOnce('retry').mockResolvedValue('sent');
    await runStoreHealthAlerts(deps); await due(); await runStoreHealthAlerts(deps); await due(); await runStoreHealthAlerts(deps);
    expect(deps.send).toHaveBeenCalledTimes(2);
    expect(await one('select alert_attempts,alert_delivery from store_health_alerts')).toEqual({ alert_attempts: 2, alert_delivery: 'sent' });
  });
  it('keeps unrelated store notification settings and advances their concurrency version', async () => {
    await db.query("update widget_sites set settings_json=$2 where id=$1", [siteId, JSON.stringify({ messenger_notifications: { emailOnHandoff: false }, store_health_notifications: { other: true } })]);
    await db.query('select set_store_health_alert_preference($1,false)', [siteId]);
    expect(await one('select settings_json,settings_version from widget_sites')).toEqual({ settings_json: { messenger_notifications: { emailOnHandoff: false }, store_health_notifications: { other: true, emailOnFailure: false } }, settings_version: 2 });
  });
  it('keeps ambiguous failures claimed and does not retry', async () => {
    vi.mocked(deps.send).mockResolvedValue('unknown');
    await runStoreHealthAlerts(deps); await due(); await runStoreHealthAlerts(deps);
    expect(deps.send).toHaveBeenCalledTimes(1);
  });
  it('suppresses a delayed recovery if the same row has already broken again', async () => {
    await runStoreHealthAlerts(deps);
    vi.mocked(deps.facts).mockResolvedValueOnce(healthyFacts());
    vi.mocked(deps.send).mockResolvedValueOnce('retry').mockResolvedValue('sent');
    await due(); await runStoreHealthAlerts(deps);
    await due(); await runStoreHealthAlerts(deps);
    expect(deps.send).toHaveBeenCalledTimes(3);
    expect(deps.send).toHaveBeenLastCalledWith(expect.objectContaining({ recovery: false }));
    expect((await db.query("select recovery_delivery from store_health_alerts where resolved_at is not null")).rows).toEqual([{ recovery_delivery: 'suppressed' }]);
  });
  it('respects opt-out, does not backlog a suppressed period, and rechecks opt-out during the claim', async () => {
    await db.query('select set_store_health_alert_preference($1,false)', [siteId]);
    await runStoreHealthAlerts(deps);
    expect(deps.send).not.toHaveBeenCalled();
    await db.query('select set_store_health_alert_preference($1,true)', [siteId]);
    await due(); await runStoreHealthAlerts(deps);
    expect(deps.send).not.toHaveBeenCalled();
    const token = randomUUID(); await due(); await repo.sites(token); await repo.reconcile(siteId, token, ['product_photos_blocked']);
    const [row] = await repo.pending(siteId);
    await db.query('select set_store_health_alert_preference($1,false)', [siteId]);
    expect(await repo.claim(row, token, randomUUID())).toBeNull();
  });
  it('never resolves problems from a failed or missing facts read', async () => {
    await runStoreHealthAlerts(deps);
    vi.mocked(deps.facts).mockRejectedValueOnce(new Error('read failed')).mockResolvedValueOnce(null);
    await due(); await runStoreHealthAlerts(deps); await due(); await runStoreHealthAlerts(deps);
    expect(deps.send).toHaveBeenCalledTimes(1);
    expect(await one('select resolved_at from store_health_alerts')).toEqual({ resolved_at: null });
  });
  it('bounds each lease to 50 oldest sites, excludes overlapping leases, and resumes expired leases', async () => {
    await db.exec("update widget_sites set store_health_checked_at=now()-interval '1 day'; insert into widget_sites(name) select 'Site' from generate_series(1,59)");
    const first = await repo.sites(randomUUID());
    expect(first).toHaveLength(50); expect(first.some((s) => s.id === siteId)).toBe(false);
    expect(await repo.sites(randomUUID())).toHaveLength(10);
    expect(await repo.sites(randomUUID())).toHaveLength(0);
    await db.exec("update widget_sites set store_health_check_until=now()-interval '1 second'");
    expect(await repo.sites(randomUUID())).toHaveLength(50);
  });
  it('protects state and all RPCs from public roles with RLS and no policies', async () => {
    await db.exec('reset role');
    expect(await one("select relrowsecurity from pg_class where relname='store_health_alerts'")).toEqual({ relrowsecurity: true });
    expect((await db.query("select * from pg_policies where tablename='store_health_alerts'")).rows).toEqual([]);
    for (const role of ['anon', 'authenticated']) {
      await db.exec('set role ' + role);
      await expect(db.query('select * from store_health_alerts')).rejects.toMatchObject({ code: '42501' });
      await expect(repo.sites(randomUUID())).rejects.toMatchObject({ code: '42501' });
      await expect(db.query('select set_store_health_alert_preference($1,false)', [siteId])).rejects.toMatchObject({ code: '42501' });
      await expect(repo.reconcile(siteId, randomUUID(), [])).rejects.toMatchObject({ code: '42501' });
      await db.exec('reset role');
    }
  });
});
