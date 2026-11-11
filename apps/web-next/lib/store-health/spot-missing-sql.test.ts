// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const SITE = '11111111-1111-4111-8111-111111111111';
const file = (name: string) => readFile(resolve(process.cwd(), '../../supabase', name), 'utf8');
describe('store health spot_missing additive migration', { timeout: 60_000 }, () => {
  it('runs twice after the counters migration, counts per site and day, keeps every old rule', async () => {
    const db = new PGlite();
    try {
      await db.exec("create role anon; create role authenticated; create role service_role bypassrls; create table public.widget_sites(id uuid primary key); insert into public.widget_sites values ('" + SITE + "');");
      await db.exec(await file('20261110_store_health_signals.sql'));
      const sql = await file('20261111_store_health_spot_missing.sql');
      await db.exec(sql); await db.exec(sql);
      const write = (counters: object[]) => db.query('select public.increment_store_health_signals($1::uuid, $2::jsonb)', [SITE, JSON.stringify(counters)]);
      await db.exec('set role service_role');
      const page = [{ metric: 'product_detected', dimension: 'yes', count: 1 }, { metric: 'placement', dimension: 'inline', count: 1 }, { metric: 'spot_missing', dimension: '', count: 1 }];
      await write(page); await write(page);
      expect((await db.query("select count::integer, day = (now() at time zone 'UTC')::date as today from public.store_health_spot_signals")).rows).toEqual([{ count: 2, today: true }]);
      expect((await db.query('select metric, dimension, count::integer from public.store_health_signals order by metric')).rows).toEqual([
        { metric: 'placement', dimension: 'inline', count: 2 }, { metric: 'product_detected', dimension: 'yes', count: 2 },
      ]);
      await expect(write([{ metric: 'spot_missing', dimension: 'x', count: 1 }])).rejects.toThrow('invalid dimension');
      await expect(write([{ metric: 'spot_missing', dimension: '', count: 201 }])).rejects.toThrow('invalid increment');
      await expect(write([{ metric: 'placement', dimension: 'sideways', count: 1 }])).rejects.toMatchObject({ code: '23514' });
      await expect(write([...page, page[0]])).rejects.toThrow('invalid counters');
      await db.exec('reset role');
      expect((await db.query("select relrowsecurity from pg_class where relname = 'store_health_spot_signals'")).rows).toEqual([{ relrowsecurity: true }]);
      expect((await db.query("select * from pg_policies where tablename = 'store_health_spot_signals'")).rows).toEqual([]);
      for (const role of ['anon', 'authenticated']) {
        await db.exec('set role ' + role);
        await expect(write(page)).rejects.toMatchObject({ code: '42501' });
        await expect(db.query('select * from public.store_health_spot_signals')).rejects.toMatchObject({ code: '42501' });
        await db.exec('reset role');
      }
      // Additive only, comments included: no drop, delete or truncate statement (the
      // foreign key's on delete cascade matches store_health_signals so removing a site still works).
      expect(sql.replace(/on delete cascade/gi, '')).not.toMatch(/\b(drop|delete|truncate)\b/i);
    } finally { await db.close(); }
  });
});
