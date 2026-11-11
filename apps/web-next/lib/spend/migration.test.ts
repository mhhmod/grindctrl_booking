// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
const db = new PGlite();
let site: string; let shop: string;
beforeAll(async () => {
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
 create table widget_sites(id uuid primary key, settings_json jsonb, settings_version integer default 1);
 create table tryon_shops(shop_domain text primary key);
 create table messenger_audit(widget_site_id uuid, actor_clerk_user_id text, action text, detail jsonb,
   constraint messenger_audit_action_check check (action in ('manual_credit_grant','manual_plan_changed')));
 alter table widget_sites enable row level security; alter table tryon_shops enable row level security; alter table messenger_audit enable row level security;
 grant select, insert, update on widget_sites,tryon_shops,messenger_audit to service_role;`);
 const sql = await readFile(resolve(process.cwd(), '../../supabase/20261111_daily_spend_limits.sql'), 'utf8');
 // The one allowed drop swaps the audit action check for a wider list; no rows change.
 expect(sql.replace(/^--.*$/gm, '').replace('drop constraint if exists messenger_audit_action_check', ''))
   .not.toMatch(/\b(drop|truncate)\b|\bdelete\s+from\b/i);
 await db.exec(sql); await db.exec(sql);
}, 60_000);
afterAll(async () => { await db.close(); });
beforeEach(async () => {
 await db.exec('reset role; set role service_role'); site = randomUUID(); shop = 's-' + site + '.myshopify.com';
 await db.query(`insert into widget_sites(id,settings_json) values($1,'{"merchant":"kept"}');`, [site]);
 await db.query('insert into tryon_shops(shop_domain) values($1)', [shop]);
});
const set = (tenant: string, key: string, value: number | null, actor = 'operator-1') => db.query('select set_store_spend_limit($1,$2,$3,$4)', [tenant, key, value, actor]);
const settings = async (tenant: string) => (await db.query<{ settings_json: { spend_limits?: Record<string, number>; merchant?: string } }>(tenant.startsWith('site:')
 ? 'select settings_json from widget_sites where id=$1' : 'select settings_json from tryon_shops where shop_domain=$1', [tenant.replace(/^site:/, '')])).rows[0].settings_json;
describe('spend migration applied twice', () => {
 it('patches one leaf and audits operator, before/after and tenant atomically', async () => {
   await set('site:' + site, 'tryOnDailyLooks', 0); await set('site:' + site, 'storeChatDailyTurns', 100000);
   expect(await settings('site:' + site)).toEqual({ merchant: 'kept', spend_limits: { tryOnDailyLooks: 0, storeChatDailyTurns: 100000 } });
   await set('site:' + site, 'tryOnDailyLooks', null);
   expect((await settings('site:' + site)).spend_limits).toEqual({ storeChatDailyTurns: 100000 });
   const audit = (await db.query('select * from messenger_audit where widget_site_id=$1', [site])).rows;
   expect(audit).toHaveLength(3); expect(audit[0]).toMatchObject({ actor_clerk_user_id: 'operator-1', action: 'spend_limit_changed', detail: { tenant: 'site:' + site, key: 'tryOnDailyLooks', value: 0 } });
 });
 it('uses the existing Shopify store row', async () => {
   await set(shop, 'tryOnDailyLooks', 7); expect((await settings(shop)).spend_limits).toEqual({ tryOnDailyLooks: 7 });
 });
 it('rejects unknown stores, invalid bounds/keys and missing operator', async () => {
   await expect(set('unknown.myshopify.com', 'tryOnDailyLooks', 5)).rejects.toThrow('Unknown store');
   for (const n of [-1, 100001]) await expect(set(shop, 'tryOnDailyLooks', n)).rejects.toThrow('Invalid spend limit');
   await expect(set(shop, 'no', 5)).rejects.toThrow('Invalid spend limit');
   await expect(set(shop, 'tryOnDailyLooks', 5, '')).rejects.toThrow('Invalid spend limit');
 });
 it('preserves operator limits through a merchant whole-settings write and refuses direct authenticated RPC', async () => {
   await set('site:' + site, 'tryOnDailyLooks', 7);
   await db.query(`update widget_sites set settings_json='{"merchant":"new","spend_limits":{"tryOnDailyLooks":9999}}' where id=$1`, [site]);
   expect(await settings('site:' + site)).toEqual({ merchant: 'new', spend_limits: { tryOnDailyLooks: 7 } });
   await db.exec('reset role; set role authenticated');
   await expect(set(shop, 'tryOnDailyLooks', 5)).rejects.toThrow(/permission denied/);
 });
 it('rolls back settings if audit recording fails', async () => {
   await db.exec('reset role; revoke insert on messenger_audit from service_role; set role service_role');
   await expect(set(shop, 'tryOnDailyLooks', 7)).rejects.toThrow(/permission denied/);
   expect((await settings(shop)).spend_limits).toBeUndefined();
   await db.exec('reset role; grant insert on messenger_audit to service_role; set role service_role');
 });
});
