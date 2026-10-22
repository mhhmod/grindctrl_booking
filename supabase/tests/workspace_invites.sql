-- Test for supabase/workspace_invites.sql. Run it against a THROWAWAY
-- PostgreSQL 16 database, never a real project:
--
--   createdb invites_test
--   psql -d invites_test -v ON_ERROR_STOP=1 -f supabase/tests/workspace_invites.sql
--
-- It builds the few things Supabase provides (the extensions schema, the
-- three roles, minimal profiles and workspaces), applies the file twice, then
-- checks each constraint, the one-pending rule and the grants. The \ir path
-- is relative to this file.

\set ON_ERROR_STOP on

create schema if not exists extensions;
create extension if not exists "uuid-ossp" with schema extensions;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
end $$;
create table public.profiles (id uuid primary key default extensions.uuid_generate_v4(), email text);
create table public.workspaces (
  id uuid primary key default extensions.uuid_generate_v4(),
  owner_profile_id uuid not null references public.profiles(id)
);

\ir ../workspace_invites.sql
-- Applying it twice must be harmless.
\ir ../workspace_invites.sql

insert into public.profiles (id, email) values ('11111111-1111-4111-8111-111111111111', 'hana@maisonnoor.com');
insert into public.workspaces (id, owner_profile_id)
  values ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111');

-- A pending invite, with the defaults filled in.
insert into public.workspace_invites (workspace_id, email, role, invited_by_profile_id)
  values ('22222222-2222-4222-8222-222222222222', 'nour@maisonnoor.com', 'member', '11111111-1111-4111-8111-111111111111');

do $$
declare
  rejected int := 0;
  row_count int;
begin
  -- The owner role is never invited.
  begin
    insert into public.workspace_invites (workspace_id, email, role)
      values ('22222222-2222-4222-8222-222222222222', 'a@maisonnoor.com', 'owner');
  exception when check_violation then rejected := rejected + 1;
  end;
  -- An unknown status.
  begin
    insert into public.workspace_invites (workspace_id, email, status)
      values ('22222222-2222-4222-8222-222222222222', 'b@maisonnoor.com', 'sent');
  exception when check_violation then rejected := rejected + 1;
  end;
  -- An address not stored as compared: upper case, spaces, or not an address.
  begin
    insert into public.workspace_invites (workspace_id, email) values ('22222222-2222-4222-8222-222222222222', 'Youssef@maisonnoor.com');
  exception when check_violation then rejected := rejected + 1;
  end;
  begin
    insert into public.workspace_invites (workspace_id, email) values ('22222222-2222-4222-8222-222222222222', ' c@maisonnoor.com');
  exception when check_violation then rejected := rejected + 1;
  end;
  begin
    insert into public.workspace_invites (workspace_id, email) values ('22222222-2222-4222-8222-222222222222', 'not-an-address');
  exception when check_violation then rejected := rejected + 1;
  end;
  -- A second pending invite for the same address and workspace.
  begin
    insert into public.workspace_invites (workspace_id, email) values ('22222222-2222-4222-8222-222222222222', 'nour@maisonnoor.com');
  exception when unique_violation then rejected := rejected + 1;
  end;
  if rejected <> 6 then
    raise exception 'expected 6 rejected rows, got %', rejected;
  end if;

  -- Once accepted, the address may be invited again later.
  update public.workspace_invites set status = 'accepted', accepted_at = now() where email = 'nour@maisonnoor.com';
  insert into public.workspace_invites (workspace_id, email) values ('22222222-2222-4222-8222-222222222222', 'nour@maisonnoor.com');
  select count(*) into row_count from public.workspace_invites where email = 'nour@maisonnoor.com';
  if row_count <> 2 then
    raise exception 'expected 2 invites for the address, got %', row_count;
  end if;

  -- Seven days to accept, by default.
  if not exists (
    select 1 from public.workspace_invites
    where email = 'nour@maisonnoor.com' and status = 'pending'
      and expires_at between invited_at + interval '7 days' - interval '1 minute' and invited_at + interval '7 days' + interval '1 minute'
  ) then
    raise exception 'expected a seven-day expiry';
  end if;

  -- Deleting the workspace takes its invites with it.
  delete from public.workspaces where id = '22222222-2222-4222-8222-222222222222';
  select count(*) into row_count from public.workspace_invites;
  if row_count <> 0 then
    raise exception 'expected invites to go with their workspace, % left', row_count;
  end if;
end $$;

-- Only the service role may touch the table.
do $$
begin
  if has_table_privilege('anon', 'public.workspace_invites', 'select')
     or has_table_privilege('authenticated', 'public.workspace_invites', 'select')
     or not has_table_privilege('service_role', 'public.workspace_invites', 'insert') then
    raise exception 'unexpected grants on workspace_invites';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.workspace_invites'::regclass) then
    raise exception 'expected row level security on workspace_invites';
  end if;
end $$;

\echo 'workspace_invites: all checks passed'
