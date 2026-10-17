-- Test for supabase/20261017_store_flags_screens.sql. Run it against a
-- THROWAWAY PostgreSQL 16 database, never a real project:
--
--   createdb flags_screens_test
--   psql -d flags_screens_test -v ON_ERROR_STOP=1 -f supabase/tests/store_flags_screens.sql
--
-- It builds what Supabase provides, applies the flag store, checks that a
-- screen flag is refused before the widening, applies the widening twice
-- (and the flag store again after it), then checks which names pass.

\set ON_ERROR_STOP on

create schema if not exists extensions;
create extension if not exists "uuid-ossp" with schema extensions;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
end $$;
create table public.widget_sites (id uuid primary key default extensions.uuid_generate_v4(), name text not null);

\ir ../20261016_store_flags.sql

do $$ begin
  insert into public.store_flags (shop_domain, flag) values ('maison.myshopify.com', 'v16_dashboard');
  raise exception 'a screen flag passed before the widening';
exception when check_violation then null;
end $$;

\ir ../20261017_store_flags_screens.sql
\ir ../20261017_store_flags_screens.sql
-- The flag store applied again afterwards must not narrow it back.
\ir ../20261016_store_flags.sql

insert into public.store_flags (shop_domain, flag, enabled) values ('maison.myshopify.com', 'v16_dashboard', true);
insert into public.store_flags (shop_domain, flag, enabled) values ('maison.myshopify.com', 'n23_after_hours', true);
insert into public.store_flags (shop_domain, flag, enabled) values ('maison.myshopify.com', 'n5_preview_mode', true);

do $$
declare
  name text;
  rejected int := 0;
begin
  foreach name in array array['v17_dashboard', 'v16', 'v16_', 'V16_dashboard', 'dashboard', 'v16_dash-board', 'x_v16_dashboard'] loop
    begin
      insert into public.store_flags (shop_domain, flag) values ('maison.myshopify.com', name);
    exception when check_violation then rejected := rejected + 1;
    end;
  end loop;
  if rejected <> 7 then
    raise exception 'expected 7 bad names refused, got %', rejected;
  end if;
end $$;

do $$ begin
  if (select count(*) from pg_constraint where conrelid = 'public.store_flags'::regclass and conname = 'store_flags_flag_name') <> 1 then
    raise exception 'expected exactly one name check';
  end if;
end $$;

select 'store_flags_screens: all checks passed' as result;
