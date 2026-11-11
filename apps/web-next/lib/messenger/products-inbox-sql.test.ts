// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { normalizeSearch } from './product-context';

const SITE = '11111111-1111-4111-8111-111111111111', OTHER = '22222222-2222-4222-8222-222222222222';
const VISITOR = '33333333-3333-4333-8333-333333333333', PROFILE = '44444444-4444-4444-8444-444444444444';
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const db = new PGlite();
type Row = { id: string; last_message_at: string | null; inbox_updated_at: string; status: string; preview: string; unread: number; visitor_name: string };
async function page(query = '', filter = 'all', assignee: string | null = null, at: string | null = null, cursor: string | null = null, changes = false) {
  return (await db.query<{ row: Row }>('select public.messenger_inbox_page($1,$2,$3,$4,$5,$6,$7,clock_timestamp()) as row', [SITE, query, filter, assignee, at, cursor, changes])).rows.map((r) => r.row);
}
describe('product and Inbox additive SQL', { timeout: 60_000 }, () => {
  beforeAll(async () => {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create table widget_sites(id uuid primary key, status text);
      create table messenger_knowledge(id uuid default gen_random_uuid() primary key, widget_site_id uuid not null, title text not null check(length(title)>0), content text not null check(length(content)>0), source text not null, source_url text, status text, last_synced_at timestamptz);
      create table widget_visitors(id uuid primary key, widget_site_id uuid, user_name text, user_email text);
      create table widget_conversations(id uuid primary key, widget_site_id uuid not null, visitor_id uuid, status text, started_at timestamptz default now(), last_message_at timestamptz, assigned_profile_id uuid, handoff_reason text, metadata jsonb default '{}');
      create table widget_messages(id uuid default gen_random_uuid() primary key, conversation_id uuid, role text, content text, created_at timestamptz default now(), metadata jsonb default '{}');
      alter table widget_conversations enable row level security;
      create policy fixture_policy on widget_conversations using (false);
      insert into widget_sites values ('${SITE}','active'),('${OTHER}','active');
      insert into widget_visitors values ('${VISITOR}','${SITE}','أَمـيرة','AMIRA@example.com');`);
    for (const file of ['20261111_messenger_products.sql', '20261111_messenger_inbox.sql']) {
      const sql = await readFile(resolve(process.cwd(), '../..', 'supabase', file), 'utf8');
      await db.exec(sql); await db.exec(sql);
    }
    for (let n = 1; n <= 70; n++) await db.query('insert into widget_conversations(id,widget_site_id,visitor_id,status,last_message_at,assigned_profile_id) values($1,$2,$3,$4,$5,$6)', [id(n), SITE, VISITOR, n <= 25 ? 'handoff_requested' : n <= 50 ? 'open' : 'closed', n <= 60 ? '2026-11-11T10:00:00Z' : null, n <= 10 ? PROFILE : null]);
    await db.query(`insert into widget_conversations(id,widget_site_id,visitor_id,status) values($1,$2,$3,'handoff_requested')`, [id(71), OTHER, VISITOR]);
    await db.query(`insert into widget_messages(conversation_id,role,content,created_at) values($1,'user','إبـرة زرقاء','2026-11-11T10:01:00Z'),($1,'assistant','LINEN delivery','2026-11-11T10:02:00Z'),($1,'system','secret note','2026-11-11T10:03:00Z')`, [id(1)]);
  }, 60_000);
  afterAll(async () => { await db.close(); });

  it('preserves RLS and grants RPC execution only to service_role', async () => {
    expect((await db.query<{ relrowsecurity: boolean }>("select relrowsecurity from pg_class where relname='widget_conversations'")).rows[0].relrowsecurity).toBe(true);
    expect((await db.query("select * from pg_policies where policyname='fixture_policy'")).rows).toHaveLength(1);
    expect((await db.query<{ allowed: boolean }>("select has_function_privilege('anon','public.messenger_inbox_page(uuid,text,text,uuid,timestamptz,uuid,boolean,timestamptz)','EXECUTE') as allowed")).rows[0].allowed).toBe(false);
    expect((await db.query<{ allowed: boolean }>("select has_function_privilege('authenticated','public.messenger_replace_products(uuid,timestamptz,jsonb)','EXECUTE') as allowed")).rows[0].allowed).toBe(false);
  });
  it('replaces only product knowledge for one site atomically, caps at 500, refuses stale leases', async () => {
    const lease = '2026-11-11T10:00:00Z';
    await db.query('update widget_sites set products_sync_attempted_at=$1 where id=$2', [lease, SITE]);
    await db.query("insert into messenger_knowledge(widget_site_id,title,content,source) values($1,'Policy','Keep me','manual'),($2,'Other','Untouched','product')", [SITE, OTHER]);
    const products = Array.from({ length: 500 }, (_, n) => ({ title: `Product ${n}`, url: `https://shop.example/p/${n}`, description: '', sizes: [] }));
    await db.query('select messenger_replace_products($1,$2,$3)', [SITE, lease, JSON.stringify(products)]);
    expect((await db.query("select count(*)::int as n from messenger_knowledge where widget_site_id=$1 and source='product'", [SITE])).rows).toEqual([{ n: 500 }]);
    await expect(db.query('select messenger_replace_products($1,$2,$3)', [SITE, lease, JSON.stringify([...products, products[0]])])).rejects.toThrow('Catalogue limit');
    await expect(db.query('select messenger_replace_products($1,$2,$3)', [SITE, '2026-01-01', '[]'])).rejects.toThrow('Stale catalogue lease');
    expect((await db.query("select title from messenger_knowledge where source='manual' or widget_site_id=$1", [OTHER])).rows).toEqual(expect.arrayContaining([{ title: 'Policy' }, { title: 'Other' }]));
  });
  it('pages by timestamp and id across ties and NULL last-message times with no duplicates', async () => {
    const seen: string[] = []; let at: string | null = null, cursor: string | null = null;
    for (let n = 0; n < 3; n++) {
      const rows = await page('', 'all', null, at, cursor);
      const items = rows.slice(0, 30); seen.push(...items.map((r) => r.id));
      at = items.at(-1)!.last_message_at; cursor = items.at(-1)!.id;
    }
    expect(seen).toHaveLength(70); expect(new Set(seen).size).toBe(70); expect(seen).not.toContain(id(71));
  });
  it('searches case-insensitive English names/emails/latest preview and normalized Arabic beyond the first 30', async () => {
    expect((await page('linen')).map((r) => r.id)).toEqual([id(1)]);
    expect(await page('amira@EXAMPLE')).toHaveLength(31);
    expect(await page('اميره')).toHaveLength(31);
    await db.query("insert into widget_messages(conversation_id,role,content) values($1,'user','إبـرة زرقاء')", [id(2)]);
    expect((await page('ابره زرقاء')).map((r) => r.id)).toEqual([id(2)]);
    expect(await page('secret note')).toEqual([]);
  });
  it.each(['إِبـرة أزرق على', 'AMIRA', 'عَباءة', 'يَا هلا'])('SQL/JS normalization agree for %s', async (text) => {
    expect((await db.query<{ value: string }>('select messenger_search_normalize($1) as value', [text])).rows[0].value).toBe(normalizeSearch(text));
  });
  it('applies every status tab and assigned-to-me at the database boundary', async () => {
    expect(await page('', 'needs_reply')).toHaveLength(25); expect(await page('', 'needs_you')).toHaveLength(25);
    expect(await page('', 'assistant')).toHaveLength(25); expect(await page('', 'resolved')).toHaveLength(20);
    expect(await page('', 'in_progress')).toHaveLength(25); expect(await page('', 'all', PROFILE)).toHaveLength(10);
    expect(await page('', 'invalid')).toEqual([]);
  });
  it('tracks status, assignment, visitor changes and message inserts; bounds changes at 50', async () => {
    const since = (await db.query<{ at: string }>('select clock_timestamp()::text as at')).rows[0].at;
    await db.query("update widget_conversations set status='handoff_active',assigned_profile_id=$1 where id=$2", [PROFILE, id(1)]);
    await db.query("insert into widget_messages(conversation_id,role,content) values($1,'user','New question')", [id(3)]);
    expect((await page('', 'all', null, since, null, true)).map((r) => r.id)).toEqual([id(1), id(3)]);
    await db.query("update widget_visitors set user_name='Changed' where id=$1", [VISITOR]);
    const changes = await page('', 'all', null, since, null, true);
    expect(changes).toHaveLength(50);
    const last = changes.at(-1)!;
    expect(await page('', 'all', null, last.inbox_updated_at, last.id, true)).toHaveLength(20);
  });
  it('records a handoff transition separately from typing/read or visitor updates', async () => {
    const handoffAt = async () => (await db.query<{ at: string }>('select inbox_handoff_at::text as at from widget_conversations where id=$1', [id(2)])).rows[0].at;
    const before = await handoffAt();
    await db.query("update widget_conversations set metadata=metadata || '{\"staff_typing_at\":\"2026-11-11T00:00:00Z\"}' where id=$1", [id(2)]);
    expect(await handoffAt()).toBe(before);
    await db.query("update widget_conversations set status='open' where id=$1", [id(2)]);
    await db.query("update widget_conversations set status='handoff_requested' where id=$1", [id(2)]);
    expect(await handoffAt()).not.toBe(before);
  });
});
