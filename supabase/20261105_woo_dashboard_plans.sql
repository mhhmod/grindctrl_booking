-- WooCommerce parity phase 5: one free Try-On plan per verified apex domain
-- for site tenants (`site:<widget_site uuid>`).
--
-- Additive and idempotent: one new server-only table and one new function.
-- No existing table, policy, bucket or grant is changed. Review and apply
-- manually in the Supabase SQL editor; nothing here runs automatically.
--
-- Auth/RLS/storage impact: RLS is on and no browser-role policy exists, so
-- only service_role (the dashboard server) reaches the table. The function
-- is SECURITY DEFINER with execute granted to service_role only, because it
-- grants a free subscription. No storage bucket is touched.
--
-- Requires supabase/20261104_site_tenants.sql (tryon_shops.platform and
-- widget_site_id) and public.ensure_free_tryon_subscription(text).

begin;

create table if not exists public.tryon_free_plan_apexes (
  apex text primary key
    check (apex = lower(btrim(apex)) and apex ~ '^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$'),
  widget_site_id uuid not null
    references public.widget_sites(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists tryon_free_plan_apexes_widget_site_id
  on public.tryon_free_plan_apexes (widget_site_id);

alter table public.tryon_free_plan_apexes enable row level security;
revoke all on table public.tryon_free_plan_apexes from public, anon, authenticated;
grant select, insert, update, delete on table public.tryon_free_plan_apexes to service_role;

comment on table public.tryon_free_plan_apexes is
  'Server-only. The apex domain each site tenant claimed its one free Try-On plan with.';

-- Claims every given apex for the site and grants its free subscription, or
-- refuses when another site already holds one of them. Serialized per apex,
-- so two sites racing on one domain cannot both win. Safe to repeat: the
-- site that holds the apex gets the same answer again.
-- Returns: granted | apex_taken | no_verified_domain | not_connected
create or replace function public.claim_site_free_plan(
  p_widget_site_id uuid,
  p_apexes text[]
) returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  tenant text := 'site:' || p_widget_site_id::text;
  sorted text[];
  one text;
  holder uuid;
begin
  select coalesce(array_agg(distinct lower(btrim(a)) order by lower(btrim(a))), '{}')
    into sorted
    from unnest(coalesce(p_apexes, '{}')) as a
    where btrim(a) <> '';
  if cardinality(sorted) = 0 then
    return 'no_verified_domain';
  end if;

  if not exists (
    select 1 from public.tryon_shops
    where shop_domain = tenant and status = 'installed' and platform <> 'shopify'
  ) then
    return 'not_connected';
  end if;

  -- Sorted, so two calls always take the locks in the same order.
  foreach one in array sorted loop
    perform pg_advisory_xact_lock(hashtextextended('tryon-free-apex:' || one, 0));
  end loop;

  foreach one in array sorted loop
    select widget_site_id into holder from public.tryon_free_plan_apexes where apex = one;
    if found and holder <> p_widget_site_id then
      return 'apex_taken';
    end if;
  end loop;

  insert into public.tryon_free_plan_apexes (apex, widget_site_id)
    select a, p_widget_site_id from unnest(sorted) as a
    on conflict (apex) do nothing;

  perform public.ensure_free_tryon_subscription(tenant);
  return 'granted';
end;
$$;

revoke all on function public.claim_site_free_plan(uuid, text[]) from public, anon, authenticated;
grant execute on function public.claim_site_free_plan(uuid, text[]) to service_role;

commit;

-- Rollback notes (a site that already has its free subscription keeps it):
-- begin;
-- drop function if exists public.claim_site_free_plan(uuid, text[]);
-- drop table if exists public.tryon_free_plan_apexes;
-- commit;
