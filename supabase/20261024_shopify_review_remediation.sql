-- Manual additive follow-up to 20261024_shopify_installation_isolation.sql.
-- No hosted execution is authorized. Preserve existing merchants/credits/jobs.
begin;
alter table public.shopify_installations add column if not exists refresh_retry_after timestamptz;
alter table public.shopify_installation_events add column if not exists verification jsonb;

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
      lease_id=p_lease,
      lease_expires_at=clock_timestamp()+interval '120 seconds'
      where shop_domain=p_shop and app_client_id=p_app
        and (lease_id is null or lease_expires_at < clock_timestamp())
        and (coalesce(p_payload->>'refresh','false') <> 'true' or refresh_retry_after is null
          or refresh_retry_after <= clock_timestamp()) returning * into r;
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
      uninstalled_at=null, refresh_retry_after=null,
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
  elsif p_operation = 'defer' then
    update public.shopify_installations set refresh_retry_after=(p_payload->>'retry_after')::timestamptz,
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

create or replace function public.record_shopify_installation_event_v2(
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
   elsif p_topic='app/scopes_update' then
     -- No global reactivation. Reverify actual scopes using a fresh admin session.
     result_status:='manual_required'; result_reason:='scopes_require_authoritative_reverification';
   else
     result_status:='manual_required'; result_reason:='current_credential_verification_required';
   end if;
 else result_status:='ignored'; result_reason:='unsupported_topic';
 end if;
 update public.shopify_installation_events set status=result_status,reason=result_reason,
   processed_at=case when result_status in ('completed','ignored') then clock_timestamp() else null end where id=e.id;
 return jsonb_build_object('id',e.id,'status',result_status,'duplicate',false,'alertSent',false);
end $$;
revoke all on function public.record_shopify_installation_event_v2(text,text,text,text,jsonb,text,timestamptz) from public,anon,authenticated;
grant execute on function public.record_shopify_installation_event_v2(text,text,text,text,jsonb,text,timestamptz) to service_role;

-- Old M1 callers also become non-destructive after this delta. New code
-- calls v2 directly, so a missing follow-up migration fails before mutation.
create or replace function public.record_shopify_installation_event(
 p_app text,p_shop text,p_webhook text,p_topic text,p_payload jsonb,p_digest text,p_triggered_at timestamptz
) returns jsonb language sql security invoker set search_path=public,pg_temp as $$
 select public.record_shopify_installation_event_v2(p_app,p_shop,p_webhook,p_topic,p_payload,p_digest,p_triggered_at);
$$;
revoke all on function public.record_shopify_installation_event(text,text,text,text,jsonb,text,timestamptz) from public,anon,authenticated;
grant execute on function public.record_shopify_installation_event(text,text,text,text,jsonb,text,timestamptz) to service_role;

-- Only the worker holding the current acquisition/refresh fence can resolve
-- an uninstall. Provider 401 is observed for this exact still-unexpired token;
-- neither delivery timestamps nor delivery IDs authorize retirement.
create or replace function public.resolve_shopify_uninstall(
 p_event uuid,p_installation uuid,p_version bigint,p_lease uuid,p_outcome text
) returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare e public.shopify_installation_events; r public.shopify_installations;
begin
 select * into e from public.shopify_installation_events where id=p_event;
 if not found or e.topic <> 'app/uninstalled' then raise exception 'invalid_uninstall_event'; end if;
 perform pg_advisory_xact_lock(hashtextextended('shopify:' || e.shop_domain,0));
 select * into r from public.shopify_installations where id=p_installation for update;
 if not found or p_lease is null or p_version is null
   or r.shop_domain <> e.shop_domain or r.app_client_id <> e.app_client_id
   or r.credential_version is distinct from p_version or r.lease_id is distinct from p_lease
   or r.lease_expires_at is null or r.lease_expires_at <= clock_timestamp() or r.status <> 'active'
   or r.access_token_ciphertext is null
   or (r.access_expires_at is not null and r.access_expires_at <= clock_timestamp()) then
   raise exception 'uninstall_verification_fence_lost';
 end if;
 if p_outcome='active' then
   update public.shopify_installation_events set status='ignored',reason='current_installation_verified_active',
     processed_at=clock_timestamp() where id=p_event;
 elsif p_outcome='revoked' then
   update public.shopify_installations set status='uninstalled',uninstalled_at=clock_timestamp(),
     access_token_ciphertext=null,token_iv=null,token_tag=null,
     refresh_token_ciphertext=null,refresh_token_iv=null,refresh_token_tag=null,
     access_expires_at=null,refresh_expires_at=null,refresh_retry_after=null,
     lease_id=null,lease_expires_at=null,credential_version=credential_version+1,updated_at=clock_timestamp()
     where id=r.id;
   update public.tryon_shops set status='uninstalled',uninstalled_at=clock_timestamp(),updated_at=clock_timestamp()
     where shop_domain=r.shop_domain and not exists (
       select 1 from public.shopify_installations where shop_domain=r.shop_domain and status='active');
   update public.shopify_installation_events set status='completed',reason='current_credential_revocation_verified',
     processed_at=clock_timestamp() where id=p_event;
 else raise exception 'invalid_uninstall_outcome';
 end if;
 update public.shopify_installation_events set verification=jsonb_build_object(
   'installation_id',r.id,'credential_version',p_version,'outcome',p_outcome,'verified_at',clock_timestamp())
   where id=p_event;
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.resolve_shopify_uninstall(uuid,uuid,bigint,uuid,text) from public,anon,authenticated;
grant execute on function public.resolve_shopify_uninstall(uuid,uuid,bigint,uuid,text) to service_role;
commit;
