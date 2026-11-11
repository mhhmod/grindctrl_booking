-- Additive, manual delta. Do not apply as part of the code change.
-- Service-only aggregates and email claims. No shopper data or signatures.
-- RLS enabled, browser grants revoked. No auth or storage changes.
-- Rollback: deploy the previous app; leave these additive tables in place.
begin;
create schema if not exists private;
create table if not exists public.store_signature_health (
  site_id uuid not null references public.widget_sites(id) on delete cascade,
  day date not null,
  bad_count bigint not null default 0 check (bad_count >= 0),
  stale_count bigint not null default 0 check (stale_count >= 0),
  failed_at timestamptz,
  verified_at timestamptz,
  primary key (site_id, day)
);
alter table public.store_signature_health enable row level security;
revoke all on public.store_signature_health from public, anon, authenticated;
grant select on public.store_signature_health to service_role;

create table if not exists public.store_journey_emails (
  site_id uuid not null references public.widget_sites(id) on delete cascade,
  event_key text not null check (length(event_key) between 1 and 160),
  claim_token uuid not null,
  claimed_at timestamptz not null default now(),
  primary key (site_id, event_key)
);
alter table public.store_journey_emails enable row level security;
revoke all on public.store_journey_emails from public, anon, authenticated;
grant select, insert, delete on public.store_journey_emails to service_role;

create or replace function private.record_store_signature_health(p_site uuid, p_outcome text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_outcome is null or p_outcome not in ('bad_signature', 'stale_signature', 'verified') then raise exception 'invalid outcome'; end if;
  insert into public.store_signature_health(site_id, day, bad_count, stale_count, failed_at, verified_at)
    values (p_site, (now() at time zone 'UTC')::date,
      case when p_outcome = 'bad_signature' then 1 else 0 end,
      case when p_outcome = 'stale_signature' then 1 else 0 end,
      case when p_outcome <> 'verified' then clock_timestamp() end,
      case when p_outcome = 'verified' then clock_timestamp() end)
    on conflict (site_id, day) do update set
      bad_count = public.store_signature_health.bad_count + excluded.bad_count,
      stale_count = public.store_signature_health.stale_count + excluded.stale_count,
      failed_at = coalesce(excluded.failed_at, public.store_signature_health.failed_at),
      verified_at = coalesce(excluded.verified_at, public.store_signature_health.verified_at);
end;
$$;
revoke all on function private.record_store_signature_health(uuid, text) from public, anon, authenticated;
grant usage on schema private to service_role;
grant execute on function private.record_store_signature_health(uuid, text) to service_role;
create or replace function public.record_store_signature_health(p_site uuid, p_outcome text)
returns void language sql security invoker set search_path = '' as $$
  select private.record_store_signature_health(p_site, p_outcome);
$$;
revoke all on function public.record_store_signature_health(uuid, text) from public, anon, authenticated;
grant execute on function public.record_store_signature_health(uuid, text) to service_role;
commit;
