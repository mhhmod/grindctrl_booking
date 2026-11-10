// @vitest-environment node
import { it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

it('adds nullable store product metadata twice, bounds it, and rolls back', { timeout: 60_000 }, async () => {
  const db = new PGlite();
  try {
    await db.exec('create table public.tryon_jobs (id text primary key); insert into tryon_jobs values (\'old\');');
    const sql = readFileSync('../../supabase/20261111_tryon_job_product_info.sql', 'utf8');
    await db.exec(sql);
    await db.exec(sql);
    expect((await db.query('select * from tryon_jobs')).rows).toEqual([{ id: 'old', product_title: null, product_image_url: null }]);
    await db.query('update tryon_jobs set product_title = $1, product_image_url = $2', ['x'.repeat(200), 'https://' + 'x'.repeat(2040)]);
    for (const [title, url] of [['x'.repeat(201), null], ['Tee', 'http://shop.example/x.jpg'], ['Tee', 'https://' + 'x'.repeat(2041)]]) {
      await expect(db.query('update tryon_jobs set product_title = $1, product_image_url = $2', [title, url])).rejects.toMatchObject({ code: '23514' });
    }
    await db.exec('begin; alter table public.tryon_jobs drop column if exists product_title, drop column if exists product_image_url; commit;');
    expect((await db.query('select * from tryon_jobs')).rows).toEqual([{ id: 'old' }]);
  } finally { await db.close(); }
});
