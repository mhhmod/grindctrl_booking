// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const ID = '22222222-2222-4222-8222-222222222222';
const SHOP = 'site:11111111-1111-4111-8111-111111111111';
const ORIGIN = 'https://shop.example';
const CLAIM = 'a'.repeat(64);
const SPOT = { selector: 'form[action*="cart"]', position: 'after', label: 'Add to cart', pathHint: '/products/dress' };

describe('pick a spot migration', { timeout: 60_000 }, () => {
  it('runs twice; claims bind one tab, saves consume once, and only the service role gets in', async () => {
    const db = new PGlite();
    try {
      await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
      const sql = await readFile(resolve(process.cwd(), '../../supabase/20261111_tryon_pick_spot.sql'), 'utf8');
      await db.exec(sql); await db.exec(sql);
      await db.exec('set role service_role');
      const token = (id: string, expires = "now() + interval '30 minutes'") => db.exec(
        `insert into public.tryon_pick_tokens(id, shop, origin, created_by, expires_at, preset) values ('${id}', '${SHOP}', '${ORIGIN}', 'user_1', ${expires}, '{"selector":"#buy","position":"before"}')`);
      const claim = (id: string, origin: string, value: string) =>
        db.query<{ result: { shop: string; preset: unknown } | null }>('select public.claim_tryon_pick_token($1::uuid, $2, $3) as result', [id, origin, value]);
      const save = (id: string, claimHash: string, spot: object = SPOT, shop = SHOP) =>
        db.query<{ saved: boolean }>('select public.save_tryon_picked_spot($1::uuid, $2, $3, $4, $5::jsonb) as saved', [id, shop, ORIGIN, claimHash, JSON.stringify(spot)]);

      await token(ID);
      expect((await claim(ID, ORIGIN, CLAIM)).rows[0].result).toEqual({ shop: SHOP, preset: { selector: '#buy', position: 'before' } });
      // The same tab again (a reload) is fine; another tab, or another store origin, is not.
      expect((await claim(ID, ORIGIN, CLAIM)).rows[0].result).not.toBeNull();
      expect((await claim(ID, ORIGIN, 'b'.repeat(64))).rows[0].result).toBeNull();
      expect((await claim(ID, 'https://evil.example', CLAIM)).rows[0].result).toBeNull();
      await expect(claim(ID, ORIGIN, 'not-a-hash')).rejects.toThrow('invalid claim');

      expect((await save(ID, 'b'.repeat(64))).rows[0].saved).toBe(false);
      expect((await save(ID, CLAIM, SPOT, 'site:other')).rows[0].saved).toBe(false);
      await expect(save(ID, CLAIM, { ...SPOT, position: 'inside' })).rejects.toThrow('invalid spot');
      expect((await save(ID, CLAIM)).rows[0].saved).toBe(true);
      // Single use: the link is spent, for saving and for claiming.
      expect((await save(ID, CLAIM)).rows[0].saved).toBe(false);
      expect((await claim(ID, ORIGIN, CLAIM)).rows[0].result).toBeNull();
      expect((await db.query('select placement, spot from public.tryon_button_placements')).rows).toEqual([{ placement: 'spot', spot: SPOT }]);

      // Expired links neither claim nor save.
      const old = '33333333-3333-4333-8333-333333333333';
      await token(old, "now() - interval '1 second'");
      expect((await claim(old, ORIGIN, CLAIM)).rows[0].result).toBeNull();
      // Claimed before it expired: still not saved after.
      await db.exec(`reset role; update public.tryon_pick_tokens set claim_hash = '${CLAIM}' where id = '${old}'; set role service_role;`);
      expect((await save(old, CLAIM)).rows[0].saved).toBe(false);
      await expect(db.exec(`update public.tryon_pick_tokens set consumed_at = null`)).rejects.toMatchObject({ code: '42501' });

      // Placement rows hold a usable spot or none.
      await expect(db.exec(`insert into public.tryon_button_placements(shop, placement) values ('site:x', 'spot')`)).rejects.toMatchObject({ code: '23514' });
      await expect(db.exec(`insert into public.tryon_button_placements(shop, placement) values ('default', 'auto')`)).rejects.toMatchObject({ code: '23514' });
      await expect(db.exec(`insert into public.tryon_button_placements(shop, placement) values ('site:x', 'sideways')`)).rejects.toMatchObject({ code: '23514' });
      await db.exec(`insert into public.tryon_button_placements(shop, placement) values ('site:x', 'floating')`);

      await db.exec('reset role');
      for (const table of ['tryon_button_placements', 'tryon_pick_tokens']) {
        expect((await db.query(`select relrowsecurity from pg_class where relname = '${table}'`)).rows).toEqual([{ relrowsecurity: true }]);
        expect((await db.query(`select * from pg_policies where tablename = '${table}'`)).rows).toEqual([]);
      }
      for (const role of ['anon', 'authenticated']) {
        await db.exec('set role ' + role);
        await expect(db.query('select * from public.tryon_pick_tokens')).rejects.toMatchObject({ code: '42501' });
        await expect(db.query('select * from public.tryon_button_placements')).rejects.toMatchObject({ code: '42501' });
        await expect(claim(ID, ORIGIN, CLAIM)).rejects.toMatchObject({ code: '42501' });
        await expect(save(ID, CLAIM)).rejects.toMatchObject({ code: '42501' });
        await db.exec('reset role');
      }
      expect(sql).not.toMatch(/\b(drop|delete|truncate)\b/i);
    } finally { await db.close(); }
  });
});
