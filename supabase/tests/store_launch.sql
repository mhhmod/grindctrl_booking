-- Test for supabase/store_launch.sql. Run it against a THROWAWAY
-- PostgreSQL 16 database, never a real project:
--
--   createdb launch_test
--   psql -d launch_test -v ON_ERROR_STOP=1 -f supabase/tests/store_launch.sql
--
-- It builds the few things Supabase provides (the extensions schema, the
-- three roles, minimal tryon_shops and tryon_jobs), loads the real plans
-- migration for the ledger and the job columns, applies the file twice,
-- then checks the launch constraints, a test look that writes no ledger
-- row, its replay, the daily cap and the grants. \ir paths are relative to
-- this file.

\set ON_ERROR_STOP on

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
\ir ../store_launch.sql
-- Applying it twice must be harmless.
\ir ../store_launch.sql

insert into public.tryon_shops values ('maison.myshopify.com', 'installed'), ('gone.myshopify.com', 'uninstalled');

-- Launch states.
insert into public.store_launch (shop_domain, state) values ('maison.myshopify.com', 'preview');
update public.store_launch
  set state = 'holdout', holdout_share = 0.5, holdout_started_at = now(), holdout_ends_at = now() + interval '14 days'
  where shop_domain = 'maison.myshopify.com';

do $$
declare
  rejected int := 0;
begin
  begin
    insert into public.store_launch (shop_domain, state) values ('other.myshopify.com', 'paused');
  exception when check_violation then rejected := rejected + 1;
  end;
  begin
    insert into public.store_launch (shop_domain, state) values ('Not A Shop', 'live');
  exception when check_violation then rejected := rejected + 1;
  end;
  begin
    -- A holdout needs its share and window.
    insert into public.store_launch (shop_domain, state) values ('other.myshopify.com', 'holdout');
  exception when check_violation then rejected := rejected + 1;
  end;
  begin
    insert into public.store_launch (shop_domain, state, holdout_share, holdout_started_at, holdout_ends_at)
      values ('other.myshopify.com', 'holdout', 1, now(), now() + interval '1 day');
  exception when check_violation then rejected := rejected + 1;
  end;
  begin
    -- Live carries no holdout fields.
    insert into public.store_launch (shop_domain, state, holdout_share) values ('other.myshopify.com', 'live', 0.5);
  exception when check_violation then rejected := rejected + 1;
  end;
  if rejected <> 5 then
    raise exception 'expected 5 rejected launch rows, got %', rejected;
  end if;
  if (select salt from public.store_launch where shop_domain = 'maison.myshopify.com') !~ '^[0-9a-f]{32}$' then
    raise exception 'every store gets a salt';
  end if;
end $$;

-- A test look: a job marked is_test, not billable, no ledger row.
select * from public.reserve_tryon_test_look(
  'maison.myshopify.com', 'tryon_test_1', '11111111-1111-4111-8111-111111111111', 'ts_a', 'layla', 2
);
do $$
begin
  if not exists (
    select 1 from public.tryon_jobs
    where id = 'tryon_test_1' and is_test and not billable and subscription_id is null and status = 'processing'
  ) then
    raise exception 'a test look is a processing, unbilled, test job';
  end if;
  if exists (select 1 from public.tryon_credit_ledger where job_id = 'tryon_test_1') then
    raise exception 'a test look must never touch the ledger';
  end if;
end $$;

-- The same attempt again answers with that job and spends nothing.
do $$
declare
  again record;
begin
  select * into again from public.reserve_tryon_test_look(
    'maison.myshopify.com', 'tryon_test_other', '11111111-1111-4111-8111-111111111111', 'ts_a', 'layla', 2
  );
  if again.job_id <> 'tryon_test_1' or again.created then
    raise exception 'a replay must return the existing job';
  end if;
  if (select used from public.tryon_test_looks_daily where shop_domain = 'maison.myshopify.com') <> 1 then
    raise exception 'a replay must not count again';
  end if;
end $$;

-- A failed test look finalizes without a refund row.
select public.finalize_tryon_job('tryon_test_1', 'failed', 'test', null, 10, 'provider error');

-- The second look fits the cap of 2; the third is refused.
select * from public.reserve_tryon_test_look(
  'maison.myshopify.com', 'tryon_test_2', '22222222-2222-4222-8222-222222222222', 'ts_b', 'layla', 2
);
do $$
declare
  refused boolean := false;
begin
  begin
    perform * from public.reserve_tryon_test_look(
      'maison.myshopify.com', 'tryon_test_3', '33333333-3333-4333-8333-333333333333', 'ts_c', 'layla', 2
    );
  exception when others then
    refused := sqlerrm like 'TRYON_TEST_CAP:%';
  end;
  if not refused then
    raise exception 'the third test look of the day must be refused with TRYON_TEST_CAP';
  end if;
  if exists (select 1 from public.tryon_jobs where id = 'tryon_test_3') then
    raise exception 'a refused test look writes no job';
  end if;
  if exists (select 1 from public.tryon_credit_ledger) then
    raise exception 'no test look may write the ledger';
  end if;
end $$;

-- An uninstalled shop gets no test looks.
do $$
declare
  refused boolean := false;
begin
  begin
    perform * from public.reserve_tryon_test_look(
      'gone.myshopify.com', 'tryon_test_4', '44444444-4444-4444-8444-444444444444', 'ts_d', 'layla', 2
    );
  exception when others then
    refused := sqlerrm like 'TRYON_UNAVAILABLE:%';
  end;
  if not refused then
    raise exception 'an uninstalled shop must be refused';
  end if;
end $$;

-- Only the service role may touch the tables or run the function.
do $$
begin
  if has_table_privilege('anon', 'public.store_launch', 'select')
     or has_table_privilege('authenticated', 'public.store_launch', 'update')
     or has_table_privilege('anon', 'public.tryon_test_looks_daily', 'select')
     or has_function_privilege('anon', 'public.reserve_tryon_test_look(text, text, uuid, text, text, integer)', 'execute')
     or has_function_privilege('authenticated', 'public.reserve_tryon_test_look(text, text, uuid, text, text, integer)', 'execute') then
    raise exception 'browser roles must not reach the launch tables or the test look function';
  end if;
  if not has_table_privilege('service_role', 'public.store_launch', 'update')
     or not has_function_privilege('service_role', 'public.reserve_tryon_test_look(text, text, uuid, text, text, integer)', 'execute') then
    raise exception 'the service role must read and write the launch state and reserve test looks';
  end if;
end $$;

select 'store_launch.sql: all checks passed' as result;
