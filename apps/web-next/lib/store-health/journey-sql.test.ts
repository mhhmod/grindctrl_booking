// @vitest-environment node
import { expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
it('M10/M12/M13/M14: migration repeats, separates sites, denies browsers and claims each email event once', { timeout: 60_000 }, async () => {
  const db = new PGlite();
  const site = '11111111-1111-4111-8111-111111111111';
  const other = '22222222-2222-4222-8222-222222222222';
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create table public.widget_sites(id uuid primary key); insert into public.widget_sites values ('${site}'), ('${other}');`);
    const sql = await readFile(resolve(process.cwd(), '../../supabase/20261111_merchant_journey_health.sql'), 'utf8');
    await db.exec(sql); await db.exec(sql);
    await db.exec('set role service_role');
    await db.query('select public.record_store_signature_health($1, $2)', [site, 'bad_signature']);
    await db.query('select public.record_store_signature_health($1, $2)', [site, 'stale_signature']);
    await db.query('select public.record_store_signature_health($1, $2)', [site, 'verified']);
    expect((await db.query('select bad_count::int, stale_count::int, verified_at is not null as verified from public.store_signature_health')).rows).toEqual([{ bad_count: 1, stale_count: 1, verified: true }]);
    await expect(db.query('select public.record_store_signature_health($1, $2)', [site, 'anything'])).rejects.toThrow('invalid outcome');
    const claim = (id: string, key: string) => db.query('insert into public.store_journey_emails(site_id,event_key,claim_token) values ($1,$2,$3) on conflict do nothing returning site_id', [id, key, site]);
    expect((await claim(site, 'daily_limit:2026-11-11')).rows).toHaveLength(1);
    expect((await claim(site, 'daily_limit:2026-11-11')).rows).toHaveLength(0);
    expect((await claim(other, 'daily_limit:2026-11-11')).rows).toHaveLength(1);
    expect((await claim(site, 'daily_limit:2026-11-12')).rows).toHaveLength(1);
    await db.exec('reset role');
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`);
      await expect(db.query('select * from public.store_signature_health')).rejects.toMatchObject({ code: '42501' });
      await expect(claim(site, 'low_looks:2026-11-11')).rejects.toMatchObject({ code: '42501' });
      await expect(db.query('select public.record_store_signature_health($1,$2)', [site, 'verified'])).rejects.toMatchObject({ code: '42501' });
      await db.exec('reset role');
    }
    expect((await db.query("select relrowsecurity from pg_class where relname in ('store_signature_health','store_journey_emails')")).rows).toEqual([{ relrowsecurity: true }, { relrowsecurity: true }]);
  } finally { await db.close(); }
});
