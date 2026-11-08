// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/* Executes the two additive migrations behind the card pill (twice each),
   over minimal fixtures, and before the tables they extend exist. */

const read = async (file: string) => (await readFile(resolve(process.cwd(), '../..', 'supabase', file), 'utf8')).replace(/^﻿/, '');
const columns = async (db: PGlite, table: string) =>
  (await db.query<{ column_name: string }>('select column_name from information_schema.columns where table_name = $1', [table]))
    .rows.map((row) => row.column_name);

describe('card pill migrations', () => {
  it('adds tryon_settings.show_card_pill, nullable, and runs again harmlessly', async () => {
    const db = new PGlite();
    await db.exec(`create table tryon_settings(shop text primary key, show_button boolean, catalog_label text);
      insert into tryon_settings(shop, catalog_label) values ('default', 'Try on'), ('maison.myshopify.com', null);`);
    const sql = await read('20261108_tryon_show_card_pill.sql');
    await db.exec(sql);
    await db.exec(sql);
    expect(await columns(db, 'tryon_settings')).toContain('show_card_pill');
    // Existing rows keep their values; NULL means on.
    expect((await db.query('select shop, catalog_label, show_card_pill from tryon_settings order by shop')).rows).toEqual([
      { shop: 'default', catalog_label: 'Try on', show_card_pill: null },
      { shop: 'maison.myshopify.com', catalog_label: null, show_card_pill: null },
    ]);
    expect(sql).not.toMatch(/^\s*(drop|delete|truncate)\b/im);
    await db.close();
  });

  it('adds the snippet version to paste connections, bounded, and skips itself before the paste migration', async () => {
    const db = new PGlite();
    const sql = await read('20261108_paste_code_version.sql');
    // No paste_site_connections yet: nothing to do, and no error.
    await db.exec(sql);
    await db.exec(`create table paste_site_connections(widget_site_id uuid primary key, platform text not null);
      insert into paste_site_connections values ('11111111-1111-4111-8111-111111111111', 'shopify');`);
    await db.exec(sql);
    await db.exec(sql);
    expect(await columns(db, 'paste_site_connections')).toEqual(expect.arrayContaining(['code_version', 'code_version_seen_at']));
    expect((await db.query('select code_version from paste_site_connections')).rows).toEqual([{ code_version: null }]);
    await db.exec(`update paste_site_connections set code_version = 2, code_version_seen_at = now()`);
    for (const bad of [0, 100]) {
      await expect(db.exec(`update paste_site_connections set code_version = ${bad}`)).rejects.toMatchObject({ code: '23514' });
    }
    expect(sql.replace(/^--.*$/gm, '')).not.toMatch(/\b(drop|delete|truncate)\b/i);
    await db.close();
  });
});
