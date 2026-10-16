-- Test for supabase/20261016_store_flags.sql. Run it against a THROWAWAY
-- PostgreSQL 16 database, never a real project:
--
--   createdb flags_test
--   psql -d flags_test -v ON_ERROR_STOP=1 -f supabase/tests/store_flags.sql
--
-- It builds the few things Supabase provides (the extensions schema, the
-- three roles, a minimal widget_sites), applies the file twice, then checks
-- each constraint and the grants. The \ir path is relative to this file.

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
-- Applying it twice must be harmless.
\ir ../20261016_store_flags.sql

insert into public.widget_sites (id, name) values ('11111111-1111-4111-8111-111111111111', 'Elsewhere');

-- A shop flag and a site flag are both fine.
insert into public.store_flags (shop_domain, flag, enabled) values ('maison.myshopify.com', 'n23_after_hours', true);
insert into public.store_flags (widget_site_id, flag, enabled)
  values ('11111111-1111-4111-8111-111111111111', 'n23_after_hours', true);

do $$
declare
  rejected int := 0;
begin
  -- Neither key.
  begin
    insert into public.store_flags (flag) values ('n23_after_hours');
  exception when check_violation then rejected := rejected + 1;
  end;
  -- Both keys.
  begin
    insert into public.store_flags (shop_domain, widget_site_id, flag)
      values ('maison.myshopify.com', '11111111-1111-4111-8111-111111111111', 'n24_assistant_down');
  exception when check_violation then rejected := rejected + 1;
  end;
  -- A domain that is not a myshopify shop.
  begin
    insert into public.store_flags (shop_domain, flag) values ('maison.com', 'n23_after_hours');
  exception when check_violation then rejected := rejected + 1;
  end;
  -- A name that is not a feature code.
  begin
    insert into public.store_flags (shop_domain, flag) values ('maison.myshopify.com', 'after hours');
  exception when check_violation then rejected := rejected + 1;
  end;
  -- The same flag twice for one shop, and for one site.
  begin
    insert into public.store_flags (shop_domain, flag) values ('maison.myshopify.com', 'n23_after_hours');
  exception when unique_violation then rejected := rejected + 1;
  end;
  begin
    insert into public.store_flags (widget_site_id, flag)
      values ('11111111-1111-4111-8111-111111111111', 'n23_after_hours');
  exception when unique_violation then rejected := rejected + 1;
  end;
  if rejected <> 6 then
    raise exception 'expected 6 rejected rows, got %', rejected;
  end if;

  -- The app writes with an upsert on (shop_domain, flag) or
  -- (widget_site_id, flag), the way PostgREST sends it.
  insert into public.store_flags (shop_domain, flag, enabled, updated_by)
    values ('maison.myshopify.com', 'n23_after_hours', false, 'user_operator')
    on conflict (shop_domain, flag) do update
      set enabled = excluded.enabled, updated_by = excluded.updated_by;
  insert into public.store_flags (widget_site_id, flag, enabled, updated_by)
    values ('11111111-1111-4111-8111-111111111111', 'n23_after_hours', false, 'user_operator')
    on conflict (widget_site_id, flag) do update
      set enabled = excluded.enabled, updated_by = excluded.updated_by;
  if (select count(*) from public.store_flags) <> 2
     or exists (select 1 from public.store_flags where enabled or updated_by is distinct from 'user_operator') then
    raise exception 'upsert did not update the existing rows in place';
  end if;

  -- Deleting the site takes its flags with it.
  delete from public.widget_sites where id = '11111111-1111-4111-8111-111111111111';
  if exists (select 1 from public.store_flags where widget_site_id is not null) then
    raise exception 'site flags outlived their site';
  end if;

  if has_table_privilege('anon', 'public.store_flags', 'select')
     or has_table_privilege('authenticated', 'public.store_flags', 'select') then
    raise exception 'anon or authenticated can read store_flags';
  end if;
  if not has_table_privilege('service_role', 'public.store_flags', 'insert') then
    raise exception 'service_role cannot write store_flags';
  end if;
  raise notice 'store_flags: all checks passed';
end $$;
