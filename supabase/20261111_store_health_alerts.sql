-- Apply manually. No existing data is removed. Settings stay in widget_sites.settings_json.
-- Rollback: disable store-health-alerts.yml, revoke function execution from service_role,
-- and keep the state/history and additive columns. To silence all stores without losing
-- their other settings: set store_health_notifications.emailOnFailure to false in settings_json.
-- Do not reset claimed timestamps: SMTP may already have accepted those messages.
begin;

alter table public.profiles add column if not exists dashboard_locale text not null default 'en'
  check (dashboard_locale in ('en', 'ar'));
alter table public.widget_sites add column if not exists store_health_checked_at timestamptz;
alter table public.widget_sites add column if not exists store_health_check_token uuid;
alter table public.widget_sites add column if not exists store_health_check_until timestamptz;
create index if not exists widget_sites_health_check_order on public.widget_sites(store_health_checked_at nulls first, id);

create table if not exists public.store_health_alerts (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.widget_sites(id) on delete cascade,
  problem_key text not null check (problem_key in ('code_gone', 'tryon_out_of_looks', 'store_chat_down', 'product_details_missing', 'product_photos_blocked')),
  opened_at timestamptz not null default now(),
  alerted_at timestamptz,
  resolved_at timestamptz,
  resolved_alerted_at timestamptz,
  alert_attempts integer not null default 0 check (alert_attempts between 0 and 4),
  recovery_attempts integer not null default 0 check (recovery_attempts between 0 and 4),
  alert_delivery text not null default 'pending' check (alert_delivery in ('pending', 'claimed', 'sent', 'unknown', 'abandoned', 'suppressed')),
  recovery_delivery text not null default 'pending' check (recovery_delivery in ('pending', 'claimed', 'sent', 'unknown', 'abandoned', 'suppressed')),
  send_token uuid,
  send_until timestamptz
);
create unique index if not exists store_health_one_open_problem on public.store_health_alerts(site_id, problem_key) where resolved_at is null;
create index if not exists store_health_alerts_pending on public.store_health_alerts(site_id, opened_at)
  where alert_delivery in ('pending', 'claimed') or recovery_delivery in ('pending', 'claimed');
alter table public.store_health_alerts enable row level security;
revoke all on public.store_health_alerts from public, anon, authenticated;
grant select, insert, update on public.store_health_alerts to service_role;

-- Invoker functions: only the server's service role has table access and EXECUTE.
-- Site leases fence delayed workers; a check that crashes is eligible again after five minutes.
create or replace function public.claim_store_health_checks(p_token uuid, p_limit integer default 50)
returns setof public.widget_sites language sql security invoker set search_path = '' as $$
  with due as (
    select id from public.widget_sites
    where (store_health_check_until is null or store_health_check_until < now())
      and (store_health_checked_at is null or store_health_checked_at <= now() - interval '15 minutes')
    order by store_health_checked_at nulls first, id
    limit greatest(0, least(coalesce(p_limit, 50), 50)) for update skip locked
  )
  update public.widget_sites s set store_health_check_token = p_token, store_health_check_until = now() + interval '5 minutes'
  from due where s.id = due.id returning s.*;
$$;

-- Resolve/open from the model's keys only. Failed reads never call this function.
create or replace function public.reconcile_store_health_alerts(p_site uuid, p_token uuid, p_keys text[])
returns boolean language plpgsql security invoker set search_path = '' as $$
declare k text;
begin
  perform 1 from public.widget_sites where id = p_site and store_health_check_token = p_token
    and store_health_check_until > now() for update;
  if not found then return false; end if;
  if p_keys is null or cardinality(p_keys) > 5 then raise exception 'invalid problem keys'; end if;
  update public.store_health_alerts set resolved_at = now(),
    alert_delivery = case when alerted_at is null then 'suppressed' else alert_delivery end,
    recovery_delivery = case when alerted_at is null then 'suppressed' else recovery_delivery end
    where site_id = p_site and resolved_at is null and not (problem_key = any(p_keys));
  foreach k in array p_keys loop
    insert into public.store_health_alerts(site_id, problem_key) values (p_site, k)
      on conflict (site_id, problem_key) where resolved_at is null do nothing;
  end loop;
  -- A delayed recovery is no longer true if this row has broken again.
  update public.store_health_alerts set recovery_delivery = 'suppressed'
    where site_id = p_site and resolved_at is not null and problem_key = any(p_keys)
      and recovery_delivery = 'pending';
  if exists (select 1 from public.widget_sites where id = p_site
    and settings_json #> '{store_health_notifications,emailOnFailure}' = 'false'::jsonb) then
    update public.store_health_alerts set
      alert_delivery = case when alert_delivery = 'pending' then 'suppressed' else alert_delivery end,
      recovery_delivery = case when recovery_delivery = 'pending' then 'suppressed' else recovery_delivery end
      where site_id = p_site and (alert_delivery = 'pending' or recovery_delivery = 'pending');
  end if;
  -- A stale claim's outcome is unknowable. Never resend it through SMTP.
  update public.store_health_alerts set alert_delivery = 'unknown'
    where site_id = p_site and alert_delivery = 'claimed' and send_until < now();
  update public.store_health_alerts set recovery_delivery = 'unknown'
    where site_id = p_site and recovery_delivery = 'claimed' and send_until < now();
  return true;
end;
$$;

-- Mark the timestamp in the SAME statement that claims the send. A crash after
-- SMTP acceptance leaves it claimed/unknown forever, never eligible for retry.
create or replace function public.claim_store_health_email(p_id uuid, p_site uuid, p_check_token uuid, p_send_token uuid, p_recovery boolean)
returns setof public.store_health_alerts language plpgsql security invoker set search_path = '' as $$
begin
  perform 1 from public.widget_sites where id = p_site and store_health_check_token = p_check_token
    and store_health_check_until > now()
    and coalesce(settings_json #> '{store_health_notifications,emailOnFailure}', 'true'::jsonb) <> 'false'::jsonb for update;
  if not found then return; end if;
  if p_recovery then
    return query update public.store_health_alerts set resolved_alerted_at = now(), recovery_attempts = recovery_attempts + 1,
      recovery_delivery = 'claimed', send_token = p_send_token, send_until = now() + interval '2 minutes'
      where id = p_id and site_id = p_site and resolved_at is not null and alerted_at is not null
        and alert_delivery in ('sent', 'unknown') and recovery_delivery = 'pending'
        and resolved_alerted_at is null and recovery_attempts < 4 returning *;
  else
    return query update public.store_health_alerts set alerted_at = now(), alert_attempts = alert_attempts + 1,
      alert_delivery = 'claimed', send_token = p_send_token, send_until = now() + interval '2 minutes'
      where id = p_id and site_id = p_site and resolved_at is null and alerted_at is null
        and alert_delivery = 'pending' and alert_attempts < 4 returning *;
  end if;
end;
$$;

-- Only definite non-delivery may clear a timestamp. An ambiguous SMTP/network
-- failure retains it, preferring a missed email over spamming an owner.
create or replace function public.finish_store_health_email(p_id uuid, p_token uuid, p_recovery boolean, p_outcome text)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  if p_outcome not in ('sent', 'retry', 'unknown') then raise exception 'invalid outcome'; end if;
  if p_recovery then
    update public.store_health_alerts set
      recovery_delivery = case when p_outcome = 'retry' then case when recovery_attempts >= 4 then 'abandoned' else 'pending' end else p_outcome end,
      resolved_alerted_at = case when p_outcome = 'retry' then null else resolved_alerted_at end, send_until = null
      where id = p_id and send_token = p_token and recovery_delivery = 'claimed';
  else
    update public.store_health_alerts set
      alert_delivery = case when p_outcome = 'retry' then case when alert_attempts >= 4 then 'abandoned' else 'pending' end else p_outcome end,
      alerted_at = case when p_outcome = 'retry' then null else alerted_at end, send_until = null
      where id = p_id and send_token = p_token and alert_delivery = 'claimed';
  end if;
  return found;
end;
$$;

create or replace function public.set_store_health_alert_preference(p_site uuid, p_enabled boolean)
returns void language sql security invoker set search_path = '' as $$
  update public.widget_sites set settings_json = jsonb_set(coalesce(settings_json, '{}'::jsonb), '{store_health_notifications}',
    coalesce(settings_json->'store_health_notifications', '{}'::jsonb) || jsonb_build_object('emailOnFailure', p_enabled)),
    settings_version = settings_version + 1
    where id = p_site;
$$;

revoke all on function public.claim_store_health_checks(uuid, integer) from public, anon, authenticated;
revoke all on function public.reconcile_store_health_alerts(uuid, uuid, text[]) from public, anon, authenticated;
revoke all on function public.claim_store_health_email(uuid, uuid, uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.finish_store_health_email(uuid, uuid, boolean, text) from public, anon, authenticated;
revoke all on function public.set_store_health_alert_preference(uuid, boolean) from public, anon, authenticated;
grant execute on function public.claim_store_health_checks(uuid, integer) to service_role;
grant execute on function public.reconcile_store_health_alerts(uuid, uuid, text[]) to service_role;
grant execute on function public.claim_store_health_email(uuid, uuid, uuid, uuid, boolean) to service_role;
grant execute on function public.finish_store_health_email(uuid, uuid, boolean, text) to service_role;
grant execute on function public.set_store_health_alert_preference(uuid, boolean) to service_role;
commit;
