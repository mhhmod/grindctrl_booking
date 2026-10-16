-- Test for supabase/20261016_tryon_credit_balance.sql (phase zero item 4).
-- Run it against a THROWAWAY PostgreSQL 16 database, never a real project:
--
--   createdb credit_test
--   psql -d credit_test -v ON_ERROR_STOP=1 -f supabase/tests/tryon_credit_balance.sql
--
-- It builds the few things Supabase provides (the extensions schema, the
-- three roles, minimal tryon_shops and tryon_jobs), loads the real plans
-- migration and the function, then writes 2,592 real ledger rows through
-- the real constraints and checks the balance. The \ir paths are relative
-- to this file.

\set ON_ERROR_STOP on

-- What Supabase provides before the plans migration.
create schema if not exists extensions;
create extension if not exists "uuid-ossp" with schema extensions;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
end $$;
create table public.tryon_shops (shop_domain text primary key, status text not null default 'installed');
create table public.tryon_jobs (
  id text primary key, session_id text, product_id text, shop text, status text not null,
  message text, provider text, cost_usd numeric, duration_ms integer, created_at timestamptz not null default now()
);

\ir ../../supabase-migration-plans.sql
\ir ../20261016_tryon_credit_balance.sql
-- Applying it twice must be harmless.
\ir ../20261016_tryon_credit_balance.sql

insert into public.tryon_shops values ('maison.myshopify.com', 'installed');
select public.ensure_free_tryon_subscription('maison.myshopify.com') as sub_id \gset
select id as plan_id from public.tryon_plans order by sort_order desc limit 1 \gset
insert into public.tryon_credit_packs (pack_key, name, price_minor, currency, renders, model_key, validity_days)
  select 'pack-test', 'Test pack', 500, 'USD', 80, 'lite', 365
  where not exists (select 1 from public.tryon_credit_packs);
select id as pack_id from public.tryon_credit_packs order by created_at limit 1 \gset

-- Drop whatever the free grant left so the test controls every grant.
create temp table baseline as select * from public.tryon_credit_balance(:'sub_id');

-- Grants: a live plan grant of 2300, an expired plan grant of 300,
-- a live top-up of 80, and a small grant over-drawn to test the clamp.
insert into public.tryon_credit_ledger (id, shop_domain, subscription_id, plan_id, entry_type, amount, reason, idempotency_key, expires_at)
values
  ('00000000-0000-4000-8000-000000000001', 'maison.myshopify.com', :'sub_id', :'plan_id', 'grant', 2300, 'test-grant', 'g1', now() + interval '20 days'),
  ('00000000-0000-4000-8000-000000000002', 'maison.myshopify.com', :'sub_id', :'plan_id', 'grant', 300, 'test-grant', 'g2', now() - interval '1 day'),
  ('00000000-0000-4000-8000-000000000004', 'maison.myshopify.com', :'sub_id', :'plan_id', 'grant', 5, 'test-grant', 'g4', now() + interval '20 days');
insert into public.tryon_credit_ledger (id, shop_domain, subscription_id, credit_pack_id, entry_type, amount, reason, idempotency_key, expires_at)
values ('00000000-0000-4000-8000-000000000003', 'maison.myshopify.com', :'sub_id', :'pack_id', 'grant', 80, 'test-grant', 'g3', now() + interval '300 days');

-- Jobs and debits: 2100 on the live plan grant, 300 on the expired one,
-- 30 on the top-up, 7 on the 5-look grant (over-drawn).
insert into public.tryon_jobs (id, shop, status)
  select 'job-' || i, 'maison.myshopify.com', 'completed' from generate_series(1, 2437) i;
insert into public.tryon_credit_ledger (shop_domain, subscription_id, job_id, entry_type, amount, reason, source_grant_id, idempotency_key)
  select 'maison.myshopify.com', :'sub_id', 'job-' || i, 'debit', -1, 'test-debit',
    case when i <= 2100 then '00000000-0000-4000-8000-000000000001'::uuid
         when i <= 2400 then '00000000-0000-4000-8000-000000000002'::uuid
         when i <= 2430 then '00000000-0000-4000-8000-000000000003'::uuid
         else '00000000-0000-4000-8000-000000000004'::uuid end,
    'd' || i
  from generate_series(1, 2437) i;
-- 150 failed looks credited back on the live plan grant.
insert into public.tryon_credit_ledger (shop_domain, subscription_id, job_id, entry_type, amount, reason, source_grant_id, reverses_entry_id, idempotency_key)
  select d.shop_domain, d.subscription_id, d.job_id, 'refund', 1, 'test-refund', d.source_grant_id, d.id, 'r' || d.job_id
  from public.tryon_credit_ledger d
  where d.entry_type = 'debit' and d.job_id in (select 'job-' || i from generate_series(1, 150) i);

select count(*) as ledger_rows from public.tryon_credit_ledger where subscription_id = :'sub_id' \gset
\echo ledger rows for the subscription: :ledger_rows

-- Expected: plan 2300 - 2100 + 150 = 350 (expired grant ignored, the 5-look
-- grant clamped at 0, plus whatever the free grant had); top-up 80 - 30 = 50.
select b.plan_remaining - baseline.plan_remaining as plan_delta, b.top_up_remaining - baseline.top_up_remaining as top_up_delta,
  b.plan_remaining, b.top_up_remaining, baseline.plan_remaining as free_grant
from public.tryon_credit_balance(:'sub_id') b, baseline;

do $$
declare r record; base record; sub uuid;
begin
  select id into sub from public.tryon_subscriptions where shop_domain = 'maison.myshopify.com';
  select * into r from public.tryon_credit_balance(sub);
  select * into base from baseline;
  if r.plan_remaining - base.plan_remaining <> 350 then raise exception 'plan balance wrong: %', r.plan_remaining; end if;
  if r.top_up_remaining - base.top_up_remaining <> 50 then raise exception 'top-up balance wrong: %', r.top_up_remaining; end if;
  raise notice 'PASS: plan +350, top-up +50 over % ledger rows', (select count(*) from public.tryon_credit_ledger where subscription_id = sub);
end $$;

-- Only the service role may call it.
select has_function_privilege('anon', 'public.tryon_credit_balance(uuid)', 'execute') as anon_can,
       has_function_privilege('authenticated', 'public.tryon_credit_balance(uuid)', 'execute') as authenticated_can,
       has_function_privilege('service_role', 'public.tryon_credit_balance(uuid)', 'execute') as service_role_can;
-- An unknown subscription answers zeros, not nothing.
select * from public.tryon_credit_balance('00000000-0000-4000-8000-0000000000ff');
