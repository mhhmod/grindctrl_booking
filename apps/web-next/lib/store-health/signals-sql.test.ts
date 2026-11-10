// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const SITE = '11111111-1111-4111-8111-111111111111';
describe('store health additive migration', { timeout: 60_000 }, () => {
  it('runs twice, increments atomically, bounds dimensions and denies public access', async () => {
    const db = new PGlite();
    try {
      await db.exec("create role anon; create role authenticated; create role service_role bypassrls; create table public.widget_sites(id uuid primary key); insert into public.widget_sites values ('" + SITE + "');");
      const sql = await readFile(resolve(process.cwd(), '../../supabase/20261110_store_health_signals.sql'), 'utf8');
      await db.exec(sql); await db.exec(sql);
      const write = (metric: string, dimension: string, count = 1) => db.query('select public.increment_store_health_signals($1::uuid, $2::jsonb)', [SITE, JSON.stringify([{ metric, dimension, count }])]);
      await db.exec('set role service_role');
      await write('placement', 'inline'); await write('placement', 'inline');
      expect((await db.query('select metric, dimension, count::integer, day = (now() at time zone \'UTC\')::date as today from public.store_health_signals')).rows).toEqual([{ metric: 'placement', dimension: 'inline', count: 2, today: true }]);
      await expect(write('photo_failure', 'https://cdn.example/path')).rejects.toMatchObject({ code: '23514' });
      for (let i = 0; i < 25; i++) await write('photo_failure', 'cdn' + i + '.example');
      expect((await db.query<{ count: number }>("select count(*)::integer from public.store_health_signals where metric = 'photo_failure'")).rows[0].count).toBe(20);
      await write('photo_failure', 'cdn0.example');
      expect((await db.query("select count::integer from public.store_health_signals where dimension = 'cdn0.example'")).rows).toEqual([{ count: 2 }]);
      await expect(write('placement', 'sideways')).rejects.toMatchObject({ code: '23514' });
      await expect(write('pills', '', 201)).rejects.toThrow('invalid increment');
      await db.exec('reset role');
      expect((await db.query("select relrowsecurity from pg_class where relname = 'store_health_signals'")).rows).toEqual([{ relrowsecurity: true }]);
      expect((await db.query("select * from pg_policies where tablename = 'store_health_signals'")).rows).toEqual([]);
      for (const role of ['anon', 'authenticated']) {
        await db.exec('set role ' + role);
        await expect(write('pills', '')).rejects.toMatchObject({ code: '42501' });
        await expect(db.query('select * from public.store_health_signals')).rejects.toMatchObject({ code: '42501' });
        await db.exec('reset role');
      }
      expect(sql.replace(/^--.*$/gm, '')).not.toMatch(/^\s*(drop|delete\s+from|truncate)\b/im);
    } finally { await db.close(); }
  });
});
