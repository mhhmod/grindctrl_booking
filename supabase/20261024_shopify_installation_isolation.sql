-- Manual additive delta. Review preflight/rollback in docs/audits/2026-10-24-shopify-m1.md.
-- Legacy shopify_shop_tokens is deliberately untouched: its app provenance is unknown.
begin;

create table if not exists public.shopify_installations (
  id uuid primary key default gen_random_uuid(),
  shop_domain text not null check (shop_domain ~ '^[a-z0-9][a-z0-9-]*[.]myshopify[.]com$'),
  app_client_id text not null check (length(app_client_id) between 1 and 128),
  status text not null default 'reauthorization_required'
    check (status in ('active','uninstalled','reauthorization_required')),
  authorized_at timestamptz,
  uninstalled_at timestamptz,
  scopes text not null default '',
  access_token_ciphertext text,
  token_iv text,
  token_tag text,
  refresh_token_ciphertext text,
  refresh_token_iv text,
  refresh_token_tag text,
  access_expires_at timestamptz,
  refresh_expires_at timestamptz,
  credential_version bigint not null default 0,
  lease_id uuid,
  lease_expires_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (shop_domain, app_client_id),
  check ((access_token_ciphertext is null) = (token_iv is null)
    and (token_iv is null) = (token_tag is null)),
  check ((refresh_token_ciphertext is null) = (refresh_token_iv is null)
    and (refresh_token_iv is null) = (refresh_token_tag is null)),
  check ((lease_id is null) = (lease_expires_at is null))
);

create table if not exists public.shopify_installation_events (
  id uuid primary key default gen_random_uuid(),
  app_client_id text not null,
  shop_domain text not null,
  webhook_id text not null,
  topic text not null,
  payload jsonb not null,
  payload_digest text not null,
  triggered_at timestamptz,
  received_at timestamptz not null default now(),
  status text not null default 'received'
    check (status in ('received','completed','ignored','manual_required','failed')),
  reason text,
  alert_sent_at timestamptz,
  processed_at timestamptz,
  unique (app_client_id, webhook_id)
);

create table if not exists public.shopify_credential_audit (
  id uuid primary key default gen_random_uuid(),
  installation_id uuid not null references public.shopify_installations(id),
  operation text not null check (operation in ('acquisition','refresh','reauthorization_required')),
  credential_version bigint not null,
  occurred_at timestamptz not null default now()
);
alter table public.shopify_credential_audit enable row level security;
revoke all on public.shopify_credential_audit from public,anon,authenticated;
grant select,insert on public.shopify_credential_audit to service_role;

alter table public.shopify_installations enable row level security;
alter table public.shopify_installation_events enable row level security;
revoke all on public.shopify_installations, public.shopify_installation_events from public, anon, authenticated;
grant select, insert, update on public.shopify_installations, public.shopify_installation_events to service_role;

-- One lease serializes BOTH acquisition and refresh across all server processes.
-- The lease fences writes and lifecycle events invalidate it. No secret is stored in SQL logs.
create or replace function public.shopify_credential_operation(
  p_shop text, p_app text, p_operation text, p_lease uuid, p_payload jsonb default '{}'::jsonb
) returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare r public.shopify_installations; changed integer;
begin
  if p_lease is null then raise exception 'credential_lease_required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('shopify:' || p_shop,0));
  if p_operation = 'acquire' then
    insert into public.shopify_installations(shop_domain, app_client_id)
      values(p_shop,p_app) on conflict (shop_domain, app_client_id) do nothing;
    update public.shopify_installations set
      status=case when lease_id is not null then 'reauthorization_required' else status end,
      lease_id=p_lease,
      lease_expires_at=clock_timestamp()+interval '120 seconds'
      where shop_domain=p_shop and app_client_id=p_app
        and (lease_id is null or lease_expires_at < clock_timestamp()) returning * into r;
    if not found then return null; end if;
    return to_jsonb(r);
  end if;
  select * into r from public.shopify_installations
    where shop_domain=p_shop and app_client_id=p_app for update;
  if not found or r.lease_id is distinct from p_lease or r.lease_expires_at <= clock_timestamp() then
    raise exception 'credential_lease_lost';
  end if;
  if p_operation = 'commit' then
    update public.shopify_installations set
      status='active',
      authorized_at=case when p_payload->>'acquisition'='true' then clock_timestamp() else authorized_at end,
      uninstalled_at=null,
      scopes=p_payload->>'scopes',
      access_token_ciphertext=p_payload->>'access_token_ciphertext',
      token_iv=p_payload->>'token_iv', token_tag=p_payload->>'token_tag',
      refresh_token_ciphertext=p_payload->>'refresh_token_ciphertext',
      refresh_token_iv=p_payload->>'refresh_token_iv', refresh_token_tag=p_payload->>'refresh_token_tag',
      access_expires_at=(p_payload->>'access_expires_at')::timestamptz,
      refresh_expires_at=(p_payload->>'refresh_expires_at')::timestamptz,
      credential_version=credential_version+1, lease_id=null, lease_expires_at=null,
      updated_at=clock_timestamp()
      where id=r.id;
    -- Keep the existing merchant/credit identity. Never create another credit account here.
    insert into public.tryon_shops(shop_domain,status,installed_at,last_seen_at,updated_at)
      values(p_shop,'installed',clock_timestamp(),clock_timestamp(),clock_timestamp())
      on conflict (shop_domain) do update set status='installed', uninstalled_at=null,
        last_seen_at=clock_timestamp(), updated_at=clock_timestamp();
  elsif p_operation = 'reauthorize' then
    update public.shopify_installations set status='reauthorization_required',
      lease_id=null,lease_expires_at=null,updated_at=clock_timestamp() where id=r.id;
  elsif p_operation = 'release' then
    update public.shopify_installations set lease_id=null,lease_expires_at=null where id=r.id;
  else raise exception 'unknown_credential_operation';
  end if;
  get diagnostics changed = row_count;
  if p_operation in ('commit','reauthorize') then
    insert into public.shopify_credential_audit(installation_id,operation,credential_version)
    values(r.id,case when p_operation='reauthorize' then 'reauthorization_required'
      when p_payload->>'acquisition'='true' then 'acquisition' else 'refresh' end,
      r.credential_version+case when p_operation='commit' then 1 else 0 end);
  end if;
  return jsonb_build_object('ok',changed>0);
end $$;
revoke all on function public.shopify_credential_operation(text,text,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.shopify_credential_operation(text,text,text,uuid,jsonb) to service_role;

-- Store receipt and lifecycle mutation in ONE transaction. Header timing is an
-- ordering hint, not authority for shared-data deletion. Privacy ALWAYS needs
-- explicit manual scoping until provenance and retention are independently approved.
create or replace function public.record_shopify_installation_event(
 p_app text,p_shop text,p_webhook text,p_topic text,p_payload jsonb,p_digest text,p_triggered_at timestamptz
) returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare e public.shopify_installation_events; r public.shopify_installations;
 result_status text := 'completed'; result_reason text;
begin
 perform pg_advisory_xact_lock(hashtextextended('shopify:' || p_shop,0));
 insert into public.shopify_installation_events(app_client_id,shop_domain,webhook_id,topic,payload,payload_digest,triggered_at)
 values(p_app,p_shop,p_webhook,p_topic,p_payload,p_digest,p_triggered_at)
 on conflict(app_client_id,webhook_id) do nothing returning * into e;
 if not found then
   select * into e from public.shopify_installation_events where app_client_id=p_app and webhook_id=p_webhook;
   if e.payload_digest<>p_digest or e.shop_domain<>p_shop or e.topic<>p_topic then
     raise exception 'webhook_identity_conflict';
   end if;
   return jsonb_build_object('id',e.id,'status',e.status,'duplicate',true,'alertSent',e.alert_sent_at is not null);
 end if;
 select * into r from public.shopify_installations where shop_domain=p_shop and app_client_id=p_app for update;
 if p_topic in ('customers/data_request','customers/redact','shop/redact') then
   result_status:='manual_required'; result_reason:='privacy_scope_and_retention_review_required';
 elsif p_topic in ('app/uninstalled','app/scopes_update') then
   if r.id is null then result_status:='manual_required'; result_reason:='unknown_installation';
   elsif p_triggered_at is null or p_triggered_at>clock_timestamp()+interval '30 seconds' then
     result_status:='manual_required'; result_reason:='unproven_event_order';
   elsif r.authorized_at is not null and p_triggered_at<=r.authorized_at then
     result_status:='ignored'; result_reason:='predates_authorization';
   elsif p_topic='app/scopes_update' then
     -- No global reactivation. Reverify actual scopes using a fresh admin session.
     result_status:='manual_required'; result_reason:='scopes_require_authoritative_reverification';
   else
     update public.shopify_installations set status='uninstalled',uninstalled_at=p_triggered_at,
       access_token_ciphertext=null,token_iv=null,token_tag=null,
       refresh_token_ciphertext=null,refresh_token_iv=null,refresh_token_tag=null,
       access_expires_at=null,refresh_expires_at=null,lease_id=null,lease_expires_at=null,
       credential_version=credential_version+1,updated_at=clock_timestamp() where id=r.id;
     update public.tryon_shops set status='uninstalled',uninstalled_at=clock_timestamp(),updated_at=clock_timestamp()
       where shop_domain=p_shop and not exists (
         select 1 from public.shopify_installations where shop_domain=p_shop and status='active'
       );
   end if;
 else result_status:='ignored'; result_reason:='unsupported_topic';
 end if;
 update public.shopify_installation_events set status=result_status,reason=result_reason,
   processed_at=case when result_status in ('completed','ignored') then clock_timestamp() else null end where id=e.id;
 return jsonb_build_object('id',e.id,'status',result_status,'duplicate',false,'alertSent',false);
end $$;
revoke all on function public.record_shopify_installation_event(text,text,text,text,jsonb,text,timestamptz) from public,anon,authenticated;
grant execute on function public.record_shopify_installation_event(text,text,text,text,jsonb,text,timestamptz) to service_role;

-- Compare-and-set retirement: an old API response must not invalidate a new token.
create or replace function public.retire_shopify_credential(p_installation uuid,p_version bigint)
returns boolean language plpgsql security invoker set search_path=public,pg_temp as $$
declare r public.shopify_installations;
begin
 select * into r from public.shopify_installations where id=p_installation;
 if not found then return false; end if;
 perform pg_advisory_xact_lock(hashtextextended('shopify:' || r.shop_domain,0));
 update public.shopify_installations set status='reauthorization_required',updated_at=clock_timestamp()
   where id=p_installation and credential_version=p_version and lease_id is null and status='active';
 if not found then return false; end if;
 insert into public.shopify_credential_audit(installation_id,operation,credential_version)
   values(p_installation,'reauthorization_required',p_version);
 return true;
end $$;
revoke all on function public.retire_shopify_credential(uuid,bigint) from public,anon,authenticated;
grant execute on function public.retire_shopify_credential(uuid,bigint) to service_role;
commit;
