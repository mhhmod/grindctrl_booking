-- Aggregate facts only: no URLs, visitor IDs or personal data.
-- Retention: a later job may prune days older than 30 days; no deletes here.
-- Rollback after stopping writers:
-- drop function public.increment_store_health_signals(uuid, jsonb);
-- drop function private.increment_store_health_signals(uuid, jsonb);
-- drop table public.store_health_signals;
begin;
create schema if not exists private;
create table if not exists public.store_health_signals (
  site_id uuid not null references public.widget_sites(id) on delete cascade,
  day date not null,
  metric text not null check (metric in ('placement','product_detected','listing_views','pills','photo_ok','photo_failure')),
  dimension text not null default '',
  count bigint not null check (count >= 0),
  primary key (site_id, day, metric, dimension),
  check ((metric = 'placement' and dimension in ('inline','floating'))
    or (metric = 'product_detected' and dimension in ('yes','no'))
    or (metric in ('listing_views','pills','photo_ok') and dimension = '')
    or (metric = 'photo_failure' and length(dimension) <= 253
        and dimension ~ '^[a-z0-9][a-z0-9.-]*[a-z0-9]$'))
);
alter table public.store_health_signals enable row level security;
revoke all on public.store_health_signals from public, anon, authenticated;
grant select on public.store_health_signals to service_role;
-- No anon/authenticated policies. Only the service role reads counters.
create or replace function private.increment_store_health_signals(p_site_id uuid, p_counters jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare entry jsonb; metric_value text; dimension_value text; amount integer;
begin
  if jsonb_typeof(p_counters) <> 'array' or jsonb_array_length(p_counters) not between 1 and 3 then
    raise exception 'invalid counters';
  end if;
  -- Serialise the bounded host set as well as increments for this site/day.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_site_id::text, 0));
  for entry in select value from jsonb_array_elements(p_counters) loop
    metric_value := entry->>'metric'; dimension_value := coalesce(entry->>'dimension', '');
    amount := (entry->>'count')::integer;
    if amount is null or amount < 0 or amount > 200 then raise exception 'invalid increment'; end if;
    if metric_value = 'photo_failure' and not exists (
      select 1 from public.store_health_signals where site_id = p_site_id
        and day = (now() at time zone 'UTC')::date and metric = metric_value and dimension = dimension_value
    ) and (select count(*) from public.store_health_signals where site_id = p_site_id
      and day = (now() at time zone 'UTC')::date and metric = 'photo_failure') >= 20 then
      continue;
    end if;
    insert into public.store_health_signals(site_id, day, metric, dimension, count)
      values (p_site_id, (now() at time zone 'UTC')::date, metric_value, dimension_value, amount)
      on conflict (site_id, day, metric, dimension) do update
        set count = public.store_health_signals.count + excluded.count;
  end loop;
end;
$$;
revoke all on function private.increment_store_health_signals(uuid, jsonb) from public, anon, authenticated;
grant usage on schema private to service_role;
grant execute on function private.increment_store_health_signals(uuid, jsonb) to service_role;
-- PostgREST entry point is invoker-only; the definer stays unexposed.
create or replace function public.increment_store_health_signals(p_site_id uuid, p_counters jsonb)
returns void language sql security invoker set search_path = '' as $$
  select private.increment_store_health_signals(p_site_id, p_counters);
$$;
revoke all on function public.increment_store_health_signals(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.increment_store_health_signals(uuid, jsonb) to service_role;
commit;
