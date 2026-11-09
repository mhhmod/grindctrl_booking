// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/* Executes the additive migrations behind the card pill and the platform
   image servers (twice each), over minimal fixtures, and before the tables
   they extend exist where they allow it. */

const read = async (file: string) => (await readFile(resolve(process.cwd(), '../..', 'supabase', file), 'utf8')).replace(/^﻿/, '');
const columns = async (db: PGlite, table: string) =>
  (await db.query<{ column_name: string }>('select column_name from information_schema.columns where table_name = $1', [table]))
    .rows.map((row) => row.column_name);

// Each test boots its own PGlite (WASM), which alone can take several seconds.
describe('additive paste migrations', { timeout: 60_000 }, () => {
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

  it('adds the detected platform to trusted domains, limited to known platforms, and runs again harmlessly', async () => {
    const db = new PGlite();
    await db.exec(`create table widget_domains(id uuid primary key, widget_site_id uuid not null, domain text not null);
      insert into widget_domains values ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'shop.example');`);
    const sql = await read('20261109_paste_platform_detected.sql');
    await db.exec(sql);
    await db.exec(sql);
    expect(await columns(db, 'widget_domains')).toEqual(expect.arrayContaining(['platform_detected', 'platform_detected_at']));
    expect((await db.query('select domain, platform_detected from widget_domains')).rows).toEqual([{ domain: 'shop.example', platform_detected: null }]);
    for (const platform of ['easyorders', 'custom']) {
      await db.exec(`update widget_domains set platform_detected = '${platform}', platform_detected_at = now()`);
    }
    await expect(db.exec(`update widget_domains set platform_detected = 'EasyOrders'`)).rejects.toMatchObject({ code: '23514' });
    expect(sql.replace(/^--.*$/gm, '')).not.toMatch(/\b(drop|delete|truncate)\b/i);
    await db.close();
  });
});
