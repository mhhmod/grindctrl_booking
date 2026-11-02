import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(process.cwd(), '../..');
const read = async (file: string) => (await readFile(resolve(root, file), 'utf8')).replace(/^\uFEFF/, '');

/** Load the actual table declarations, including their foreign keys. External
 * Supabase auth/workspace infrastructure is represented by minimal parents.
 * This validates repository SQL, not parity with a hosted database. */
async function table(db: PGlite, file: string, name: string) {
  const sql = await read(file);
  const start = sql.indexOf(`create table if not exists public.${name} (`);
  const end = sql.indexOf('\n);', start);
  if (start < 0 || end < start) throw new Error(`Missing source table: ${name}`);
  await db.exec(sql.slice(start, end + 3));
}

export async function createPrivacyDatabase() {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema extensions;
    create function extensions.uuid_generate_v4() returns uuid language sql as 'select gen_random_uuid()';
    create table public.profiles(id uuid primary key);
    create table public.workspaces(id uuid primary key);
    create table public.widget_sites(id uuid primary key default gen_random_uuid(),
      workspace_id uuid references public.workspaces(id), domain text, name text default 'Test',
      unique(id,workspace_id));
    create table public.widget_intents(id uuid primary key,widget_site_id uuid references public.widget_sites(id) on delete cascade);
    create table public.messenger_question_groups(id uuid primary key);
    create table public.tryon_jobs(id text primary key,session_id text,product_id text,shop text,
      status text not null,message text,provider text,cost_usd numeric,duration_ms integer,
      created_at timestamptz not null default now(),result_storage_path text,
      result_persisted_at timestamptz,result_expires_at timestamptz,result_deleted_at timestamptz);
    create table public.tryon_settings(shop text primary key,updated_at timestamptz default now());
  `);
  await table(db, 'supabase-migration-shops.sql', 'tryon_shops');
  await db.exec(await read('supabase-migration-plans.sql'));
  for (const name of ['widget_visitors', 'widget_conversations', 'widget_messages', 'widget_events']) {
    await table(db, 'supabase/widget_production_foundation.sql', name);
  }
  await table(db, 'supabase/widget_setup_extensions.sql', 'widget_leads');
  await db.exec(`alter table public.widget_leads
    add column visitor_id uuid references public.widget_visitors(id) on delete set null,
    add column conversation_id uuid references public.widget_conversations(id) on delete set null;`);
  for (const name of ['shopify_shop_tokens', 'messenger_attachments']) {
    await table(db, 'supabase/messenger_support_desk.sql', name);
  }
  for (const name of ['messenger_feedback', 'messenger_audit']) {
    await table(db, 'supabase/messenger_foundation.sql', name);
  }
  await table(db, 'supabase/messenger_questions.sql', 'messenger_unanswered');
  await table(db, 'supabase/shopify_tryon_foundation.sql', 'shopify_shops');
  for (const name of [
    '20260909_shopify_privacy_requests.sql',
    '20261024_shopify_installation_isolation.sql',
    '20261024_shopify_review_remediation.sql',
    '20261024_shopify_privacy_casework.sql',
    '20261101_privacy_fulfilment.sql',
    '20261101_privacy_fulfilment.sql',
  ]) await db.exec(await read(`supabase/${name}`));
  return db;
}
