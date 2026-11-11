-- Store health: product page views where the owner's chosen Try-On spot was
-- not on the page, so the button fell back to automatic placement (Pack B,
-- B7.4). Aggregate counts only: no URLs, selectors or visitor data.
-- Additive: store_health_signals' metric check cannot be widened without
-- removing it, so the new metric gets its own table, written through the same
-- increment_store_health_signals entry point. Runs twice without error.
-- Requires 20261110_store_health_signals.sql.
-- Rollback (keeps data): re-run 20261110_store_health_signals.sql, which
-- restores the previous function body; spot_missing entries then fail the
-- original metric check and the route keeps returning 204.
begin;
create schema if not exists private;
create table if not exists public.store_health_spot_signals (
  site_id uuid not null references public.widget_sites(id) on delete cascade,
  day date not null,
  count bigint not null check (count >= 0),
  primary key (site_id, day)
);
alter table public.store_health_spot_signals enable row level security;
revoke all on public.store_health_spot_signals from public, anon, authenticated;
grant select on public.store_health_spot_signals to service_role;

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
    if metric_value = 'spot_missing' then
      if dimension_value <> '' then raise exception 'invalid dimension'; end if;
      insert into public.store_health_spot_signals(site_id, day, count)
        values (p_site_id, (now() at time zone 'UTC')::date, amount)
        on conflict (site_id, day) do update
          set count = public.store_health_spot_signals.count + excluded.count;
      continue;
    end if;
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
commit;
