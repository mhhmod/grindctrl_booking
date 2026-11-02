-- Manual additive delta: privacy fulfilment and Store Chat retention.
-- Apply after the 20261024 installation/casework deltas. No billing ledger is modified.
begin;
alter table public.shopify_installation_events add column if not exists reminder_sent_at timestamptz;
alter table public.shopify_installation_events add column if not exists privacy_claim uuid;
alter table public.shopify_installation_events add column if not exists privacy_claim_until timestamptz;
alter table public.shopify_installation_events add column if not exists privacy_next_attempt_at timestamptz;
alter table public.shopify_installation_events add column if not exists completion_evidence jsonb;
alter table public.shopify_installation_events drop constraint if exists shopify_installation_events_status_check;
alter table public.shopify_installation_events add constraint shopify_installation_events_status_check
 check(status in ('received','completed','ignored','manual_required','failed','exported_pending_delivery'));
alter table public.shopify_privacy_requests add column if not exists alert_sent_at timestamptz;
alter table public.shopify_privacy_requests add column if not exists reminder_sent_at timestamptz;
alter table public.shopify_privacy_requests add column if not exists privacy_claim uuid;
alter table public.shopify_privacy_requests add column if not exists privacy_claim_until timestamptz;
alter table public.shopify_privacy_requests add column if not exists privacy_next_attempt_at timestamptz;
alter table public.shopify_privacy_requests add column if not exists completion_evidence jsonb;
alter table public.shopify_privacy_requests enable row level security;
alter table public.shopify_installation_events enable row level security;
revoke all on public.shopify_installation_events,public.shopify_privacy_requests from public,anon,authenticated;

create table if not exists public.shopify_privacy_deletion_scopes (
 request_id uuid primary key references public.shopify_installation_events(id),
 shop_domain text not null, whole_shop boolean not null,
 site_ids uuid[] not null, visitor_ids uuid[] not null, conversation_ids uuid[] not null,
 storage jsonb not null default '[]', created_at timestamptz not null default clock_timestamp(),
 finished_at timestamptz
);
alter table public.shopify_privacy_deletion_scopes enable row level security;
revoke all on public.shopify_privacy_deletion_scopes from public,anon,authenticated;
grant select on public.shopify_privacy_deletion_scopes to service_role;

-- A short transaction lock serializes scope creation against installations and
-- writes. The durable scope remains a fence during Storage API work/retries.
create or replace function public.shopify_privacy_write_guard() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
declare r jsonb; s public.shopify_privacy_deletion_scopes;
begin
 -- Writers share the lock; only scope creation (prepare) takes it exclusively,
 -- so concurrent writes never fail each other. Row triggers can run after
 -- PostgreSQL took a row lock, so never wait for the fence while holding it.
 if not pg_try_advisory_xact_lock_shared(hashtextextended('shopify-privacy-writes',0)) then
  raise exception 'privacy_write_retry';
 end if;
 r:=case when TG_OP='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 for s in select * from public.shopify_privacy_deletion_scopes where finished_at is null loop
  if current_setting('grindctrl.privacy_request',true)=s.request_id::text then continue; end if;
  if (TG_TABLE_NAME='shopify_installations' and r->>'shop_domain'=s.shop_domain)
   or (TG_TABLE_NAME='shopify_shops' and (r->>'widget_site_id'=any(s.site_ids::text[]) or r->>'shop_domain'=s.shop_domain))
   or (s.whole_shop and (r->>'shop'=s.shop_domain or r->>'shop_domain'=s.shop_domain or r->>'domain'=s.shop_domain))
   or (s.whole_shop and r->>'widget_site_id'=any(s.site_ids::text[]))
   or (TG_TABLE_NAME='widget_sites' and r->>'id'=any(s.site_ids::text[]) and s.whole_shop)
   or (TG_TABLE_NAME='widget_visitors' and r->>'id'=any(s.visitor_ids::text[]))
   or (r->>'visitor_id'=any(s.visitor_ids::text[]))
   or (TG_TABLE_NAME='widget_conversations' and r->>'id'=any(s.conversation_ids::text[]))
   or (r->>'conversation_id'=any(s.conversation_ids::text[])) then
    raise exception 'privacy_deletion_in_progress';
  end if;
 end loop;
 if TG_OP='DELETE' then return old; end if; return new;
end $$;
do $$ declare t text; begin
 foreach t in array array['shopify_installations','widget_sites','widget_visitors','widget_conversations','widget_messages',
 'messenger_attachments','widget_events','messenger_feedback','messenger_unanswered','widget_leads',
 'tryon_jobs','tryon_settings','tryon_subscriptions','shopify_shop_tokens','shopify_shops'] loop
  if to_regclass('public.'||t) is not null and not exists(select 1 from pg_trigger where tgrelid=('public.'||t)::regclass and tgname='shopify_privacy_write_fence') then
   execute format('create trigger shopify_privacy_write_fence before insert or update or delete on public.%I for each row execute function public.shopify_privacy_write_guard()',t);
  end if;
 end loop;
end $$;

create or replace function public.shopify_privacy_claim(p_limit integer,p_claim uuid,p_case uuid default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare item record; result jsonb:='[]'; remaining integer:=least(greatest(coalesce(p_limit,10),1),25); t text; source text;
begin
 if p_claim is null then raise exception 'privacy_claim_required'; end if;
 foreach source in array array['installation','legacy'] loop
  t:=case when source='installation' then 'shopify_installation_events' else 'shopify_privacy_requests' end;
  for item in execute format('select * from public.%I where topic in (''customers/data_request'',''customers/redact'',''shop/redact'')
    and status<>''completed'' and (privacy_claim_until is null or privacy_claim_until<clock_timestamp())
    and ($1 is null or id=$1) and (privacy_next_attempt_at is null or privacy_next_attempt_at<=clock_timestamp() or $1 is not null
      or (reminder_sent_at is null and received_at<=clock_timestamp()-interval ''21 days''))
    order by received_at,id limit $2 for update skip locked',t) using p_case,remaining loop
   execute format('update public.%I set privacy_claim=$1,privacy_claim_until=clock_timestamp()+interval ''15 minutes'' where id=$2',t) using p_claim,item.id;
   result:=result||jsonb_build_array(to_jsonb(item)||jsonb_build_object('case_source',source));
   remaining:=remaining-1;
  end loop;
  exit when remaining=0;
 end loop;
 return result;
end $$;

create or replace function public.shopify_privacy_alert_ack(p_source text,p_case uuid,p_claim uuid,p_kind text)
returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
declare t text; col text; changed integer;
begin
 if p_source not in ('installation','legacy') or p_kind not in ('receipt','reminder') then raise exception 'invalid_privacy_alert'; end if;
 t:=case when p_source='installation' then 'shopify_installation_events' else 'shopify_privacy_requests' end;
 col:=case when p_kind='receipt' then 'alert_sent_at' else 'reminder_sent_at' end;
 execute format('update public.%I set %I=coalesce(%I,clock_timestamp()) where id=$1 and privacy_claim=$2
  and privacy_claim_until>clock_timestamp() and ($3<>''reminder'' or (received_at<=clock_timestamp()-interval ''21 days'' and status<>''completed''))',t,col,col)
 using p_case,p_claim,p_kind;
 get diagnostics changed=row_count; if changed<>1 then raise exception 'privacy_claim_lost'; end if; return true;
end $$;

create or replace function public.shopify_privacy_prepare(p_source text,p_case uuid,p_claim uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare e public.shopify_installation_events; s public.shopify_privacy_deletion_scopes;
 sites uuid[]; visitors uuid[]; convs uuid[]; customer_id text; customer_email text;
 exported jsonb; storage_objects jsonb; own public.shopify_installations; n integer; shared boolean;
begin
 if p_source='legacy' then return jsonb_build_object('kind','manual','reason','legacy_provenance_required'); end if;
 if p_source<>'installation' then raise exception 'invalid_privacy_source'; end if;
 select * into e from public.shopify_installation_events where id=p_case;
 if not found then raise exception 'unknown_privacy_case'; end if;
 perform pg_advisory_xact_lock(hashtextextended('shopify:'||e.shop_domain,0));
 perform pg_advisory_xact_lock(hashtextextended('shopify-privacy-writes',0));
 select * into e from public.shopify_installation_events where id=p_case for update;
 if e.privacy_claim is distinct from p_claim or e.privacy_claim_until<=clock_timestamp() or e.alert_sent_at is null then raise exception 'privacy_claim_lost'; end if;
 if e.status='exported_pending_delivery' then return jsonb_build_object('kind','exported_pending_delivery'); end if;
 if e.status='completed' then raise exception 'privacy_already_completed'; end if;
 if (select action from public.shopify_privacy_case_actions where case_source='installation' and case_id=p_case
   and action in ('scoped','retention_hold') order by occurred_at desc,id desc limit 1)='retention_hold' then
  return jsonb_build_object('kind','manual','reason','operator_retention_hold');
 end if;
 -- The HMAC covers the body, not the topic header. Topic-specific body shapes
 -- prevent a data-request body being replayed as a destructive redaction.
 if e.payload->>'shop_domain' is distinct from e.shop_domain or coalesce(e.payload->>'shop_id','') !~ '^[0-9]+$'
 or (e.topic='customers/data_request' and (jsonb_typeof(e.payload->'orders_requested') is distinct from 'array'
    or coalesce(e.payload#>>'{data_request,id}','') !~ '^[0-9]+$' or e.payload ? 'orders_to_redact'))
 or (e.topic='customers/redact' and (jsonb_typeof(e.payload->'orders_to_redact') is distinct from 'array'
    or e.payload ? 'data_request' or e.payload ? 'orders_requested'))
 or (e.topic='shop/redact' and (e.payload ?| array['customer','data_request','orders_requested','orders_to_redact'])) then
  return jsonb_build_object('kind','manual','reason','unproven_privacy_payload');
 end if;
 select * into own from public.shopify_installations where shop_domain=e.shop_domain and app_client_id=e.app_client_id;
 select count(*) into n from public.shopify_installations where shop_domain=e.shop_domain;
 if own.id is null or own.status not in ('active','uninstalled') or own.lease_id is not null
   or (e.topic<>'customers/data_request' and n<>1) then
  return jsonb_build_object('kind','manual','reason','ambiguous_installation_ownership');
 end if;
 if e.topic='shop/redact' and own.status<>'uninstalled' then
  return jsonb_build_object('kind','manual','reason','shop_still_installed');
 end if;
 select coalesce(array_agg(distinct ws.id),'{}') into sites from public.widget_sites ws where ws.domain=e.shop_domain;
 -- shopify_shops ships with the unapplied try-on foundation; check it only
 -- where it exists so this function stays valid on either schema.
 if to_regclass('public.shopify_shops') is not null then
  execute 'select coalesce(array_agg(distinct x),''{}'') from unnest($1 || array(
     select widget_site_id from public.shopify_shops where shop_domain=$2)) x' into sites using sites,e.shop_domain;
  execute 'select exists(select 1 from public.shopify_shops where widget_site_id=any($1) and shop_domain<>$2)'
   into shared using sites,e.shop_domain;
  if shared then return jsonb_build_object('kind','manual','reason','shared_site_ownership'); end if;
 end if;
 if e.topic='shop/redact' then
  select coalesce(array_agg(id),'{}') into visitors from public.widget_visitors where widget_site_id=any(sites);
  select coalesce(array_agg(id),'{}') into convs from public.widget_conversations where widget_site_id=any(sites);
 else
  customer_id:=e.payload#>>'{customer,id}'; customer_email:=lower(nullif(btrim(e.payload#>>'{customer,email}'),''));
  if coalesce(customer_id,'') !~ '^[0-9]+$' then customer_id:=null; end if;
  if customer_id is null and customer_email is null then return jsonb_build_object('kind','manual','reason','customer_identity_missing'); end if;
  select coalesce(array_agg(v.id),'{}') into visitors from public.widget_visitors v where v.widget_site_id=any(sites)
   and ((customer_email is not null and lower(v.user_email)=customer_email) or exists(
    select 1 from public.widget_conversations c where c.visitor_id=v.id and c.widget_site_id=v.widget_site_id
    and c.metadata#>>'{identity,customer_id}'=customer_id
    and (e.topic='customers/data_request' or c.metadata#>>'{identity,app_client_id}'=e.app_client_id)));
  if exists(select 1 from public.widget_conversations c where c.visitor_id=any(visitors)
   and (c.widget_site_id<>all(sites) or (c.metadata#>>'{identity,customer_id}' is not null
     and ((customer_id is not null and c.metadata#>>'{identity,customer_id}'<>customer_id)
       or (customer_id is null and lower(c.metadata#>>'{identity,email}') is distinct from customer_email)
       or (e.topic<>'customers/data_request' and c.metadata#>>'{identity,app_client_id}' is distinct from e.app_client_id))))) then
   return jsonb_build_object('kind','manual','reason','mixed_visitor_identity');
  end if;
  select coalesce(array_agg(id),'{}') into convs from public.widget_conversations where visitor_id=any(visitors) and widget_site_id=any(sites);
 end if;
 if exists(select 1 from public.widget_conversations c where
   (c.visitor_id=any(visitors) and not(c.widget_site_id=any(sites)))
   or (c.id=any(convs) and not(c.visitor_id=any(visitors)))) then
  return jsonb_build_object('kind','manual','reason','inconsistent_child_ownership');
 end if;
 if e.topic='customers/data_request' then
  select coalesce(jsonb_agg(jsonb_build_object(
   'visitor',to_jsonb(v),
   'conversations',(select coalesce(jsonb_agg(jsonb_build_object(
    'conversation',to_jsonb(c)-'retention_started_at'-'retention_activity_at',
    'messages',(select coalesce(jsonb_agg(to_jsonb(m) order by m.created_at,m.id),'[]') from public.widget_messages m where m.conversation_id=c.id),
    'feedback',(select coalesce(jsonb_agg(jsonb_build_object('rating',f.rating,'comment',f.comment)),'[]') from public.messenger_feedback f where f.conversation_id=c.id and f.widget_site_id=any(sites))
   ) order by c.started_at,c.id),'[]') from public.widget_conversations c where c.id=any(convs) and c.visitor_id=v.id)
  ) order by v.id),'[]') into exported from public.widget_visitors v where v.id=any(visitors);
  update public.shopify_installation_events set completion_evidence=jsonb_build_object('export_prepared_at',clock_timestamp()) where id=p_case;
  return jsonb_build_object('kind','export','visitors',exported,'customerId',customer_id,'customerEmail',customer_email);
 end if;
 select * into s from public.shopify_privacy_deletion_scopes where request_id=p_case;
 if found then return jsonb_build_object('kind','redact','storage',s.storage); end if;
 -- Only a verified, single-owner scope may ever cross into Storage deletion.
 -- Preserve immutable accounting relations. Any restrictive FK blocks the
 -- transaction rather than deleting or nulling a ledger reference.
 if e.topic='shop/redact' and exists(select 1 from public.tryon_jobs where shop=e.shop_domain and status in ('queued','processing')) then
  return jsonb_build_object('kind','manual','reason','tryon_jobs_still_processing');
 end if;
 if exists(select 1 from public.messenger_attachments a join public.widget_conversations c on c.id=a.conversation_id
   where c.id=any(convs) and (a.widget_site_id<>c.widget_site_id
   or a.storage_path !~ ('^'||a.widget_site_id::text||'/'||a.conversation_id::text||'/[A-Za-z0-9_-]+[.](jpg|jpeg|png|webp)$')))
   or (e.topic='shop/redact' and exists(select 1 from public.tryon_jobs j where j.shop=e.shop_domain
   and j.result_storage_path is not null and j.result_storage_path !~ ('^jobs/'||j.id||'/result[.](jpg|png|webp)$'))) then
  return jsonb_build_object('kind','manual','reason','inconsistent_storage_ownership');
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('bucket','messenger-attachments','path',storage_path)),'[]') into storage_objects
 from public.messenger_attachments where conversation_id=any(convs) and widget_site_id=any(sites);
 if e.topic='shop/redact' then
  select storage_objects||coalesce(jsonb_agg(jsonb_build_object('bucket','tryon-results','path',result_storage_path)),'[]') into storage_objects
  from public.tryon_jobs where shop=e.shop_domain and result_storage_path is not null;
 end if;
 insert into public.shopify_privacy_deletion_scopes(request_id,shop_domain,whole_shop,site_ids,visitor_ids,conversation_ids,storage)
 values(p_case,e.shop_domain,e.topic='shop/redact',sites,visitors,convs,storage_objects);
 return jsonb_build_object('kind','redact','storage',storage_objects);
end $$;

-- Storage removal is acknowledged by the trusted worker. All database erasure
-- and completion evidence then commit atomically, using the frozen scope.
create or replace function public.shopify_privacy_finish(
 p_source text,p_case uuid,p_claim uuid,p_outcome text,p_evidence jsonb default '{}'
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare e public.shopify_installation_events; s public.shopify_privacy_deletion_scopes;
 t text; r record; counts jsonb:='{}'; retained jsonb:='{}'; n bigint; finished timestamptz:=clock_timestamp();
begin
 if coalesce(p_source,'') not in ('installation','legacy') or coalesce(p_outcome,'') not in ('retry','manual','exported','completed')
   or p_claim is null or jsonb_typeof(p_evidence) is distinct from 'object' then raise exception 'invalid_privacy_finish'; end if;
 t:=case when p_source='installation' then 'shopify_installation_events' else 'shopify_privacy_requests' end;
 if p_source='installation' then
  select * into e from public.shopify_installation_events where id=p_case;
  if not found then raise exception 'unknown_privacy_case'; end if;
  perform pg_advisory_xact_lock(hashtextextended('shopify:'||e.shop_domain,0));
  perform pg_advisory_xact_lock(hashtextextended('shopify-privacy-writes',0));
 end if;
 execute format('select * from public.%I where id=$1 for update',t) into r using p_case;
 if r.id is null or r.privacy_claim is distinct from p_claim or r.privacy_claim_until is null
   or r.privacy_claim_until<=clock_timestamp() or r.status='completed' then raise exception 'privacy_claim_lost'; end if;
 if p_outcome in ('retry','manual') then
  execute format('update public.%I set privacy_claim=null,privacy_claim_until=null,
    privacy_next_attempt_at=clock_timestamp()+$2::interval where id=$1',t)
    using p_case,case when p_outcome='manual' then interval '1 day' else interval '10 minutes' end;
  if p_source='installation' and p_outcome='manual' and r.status<>'exported_pending_delivery' then
   update public.shopify_installation_events set status='manual_required',reason=left(p_evidence->>'reason',128) where id=p_case;
  end if;
  return jsonb_build_object('status',case when p_outcome='manual' then 'manual_required' else r.status end);
 end if;
 if p_source<>'installation' or r.alert_sent_at is null then raise exception 'automatic_privacy_not_authorized'; end if;
 if p_outcome='exported' then
  if e.topic<>'customers/data_request' or e.completion_evidence->>'export_prepared_at' is null
   or coalesce(p_evidence->>'exportSha256','') !~ '^[a-f0-9]{64}$'
   or p_evidence->>'recipient' is distinct from 'grindctrlnow@gmail.com'
   or jsonb_typeof(p_evidence->'counts') is distinct from 'object' then raise exception 'privacy_export_evidence_required'; end if;
  update public.shopify_installation_events set status='exported_pending_delivery',reason='operator_delivery_required',
   completion_evidence=p_evidence||jsonb_build_object('exported_at',finished),privacy_claim=null,privacy_claim_until=null,
   privacy_next_attempt_at=finished+interval '1 day' where id=p_case;
  return jsonb_build_object('status','exported_pending_delivery');
 end if;
 select * into s from public.shopify_privacy_deletion_scopes where request_id=p_case for update;
 if not found or s.finished_at is not null or e.topic not in ('customers/redact','shop/redact')
   or (p_evidence->>'storageObjectsRemoved')::integer is distinct from jsonb_array_length(s.storage) then
  raise exception 'privacy_deletion_evidence_required';
 end if;
 if (select action from public.shopify_privacy_case_actions where case_source='installation' and case_id=p_case
   and action in ('scoped','retention_hold') order by occurred_at desc,id desc limit 1)='retention_hold' then
  raise exception 'privacy_retention_hold';
 end if;
 perform set_config('grindctrl.privacy_request',p_case::text,true);
 -- Count every site child before cascading shop deletion. For customer cases,
 -- count and delete child records explicitly, including SET NULL lead links.
 if s.whole_shop then
  for r in select c.table_name from information_schema.columns c where c.table_schema='public' and c.column_name='widget_site_id' loop
   execute format('select count(*) from public.%I where widget_site_id=any($1)',r.table_name) into n using s.site_ids;
   counts:=counts||jsonb_build_object(r.table_name,n);
  end loop;
 end if;
 foreach t in array array['messenger_attachments','messenger_unanswered','messenger_feedback','widget_events','widget_messages'] loop
  execute format('delete from public.%I where conversation_id=any($1)',t) using s.conversation_ids;
  get diagnostics n=row_count;
  if not s.whole_shop or not(counts ? t) then counts:=counts||jsonb_build_object(t,n); end if;
 end loop;
 delete from public.widget_leads where visitor_id=any(s.visitor_ids) or conversation_id=any(s.conversation_ids);
 get diagnostics n=row_count; if not s.whole_shop then counts:=counts||jsonb_build_object('widget_leads',n); end if;
 delete from public.messenger_audit where detail->>'conversation_id'=any(s.conversation_ids::text[])
   or detail->>'visitor_id'=any(s.visitor_ids::text[]);
 get diagnostics n=row_count; if not s.whole_shop then counts:=counts||jsonb_build_object('messenger_audit',n); end if;
 delete from public.widget_conversations where id=any(s.conversation_ids);
 get diagnostics n=row_count; counts:=counts||jsonb_build_object('widget_conversations',n);
 delete from public.widget_visitors where id=any(s.visitor_ids);
 get diagnostics n=row_count; counts:=counts||jsonb_build_object('widget_visitors',n);
 if s.whole_shop then
  delete from public.widget_sites where id=any(s.site_ids);
  get diagnostics n=row_count; counts:=counts||jsonb_build_object('widget_sites',n);
  delete from public.tryon_jobs j where j.shop=s.shop_domain and not exists(select 1 from public.tryon_credit_ledger l where l.job_id=j.id);
  get diagnostics n=row_count; counts:=counts||jsonb_build_object('tryon_jobs',n);
  -- Preserve referenced jobs and subscriptions byte-for-byte; the separately
  -- acknowledged result objects are gone, and these rows remain accounting evidence.
  select count(*) into n from public.tryon_jobs where shop=s.shop_domain;
  retained:=retained||jsonb_build_object('tryon_jobs',n);
  delete from public.tryon_subscriptions sub where sub.shop_domain=s.shop_domain
   and not exists(select 1 from public.tryon_credit_ledger l where l.subscription_id=sub.id)
   and not exists(select 1 from public.tryon_jobs j where j.subscription_id=sub.id);
  get diagnostics n=row_count; counts:=counts||jsonb_build_object('tryon_subscriptions',n);
  select count(*) into n from public.tryon_subscriptions where shop_domain=s.shop_domain;
  retained:=retained||jsonb_build_object('tryon_subscriptions',n);
  select count(*) into n from public.tryon_credit_ledger where shop_domain=s.shop_domain;
  retained:=retained||jsonb_build_object('tryon_credit_ledger',n);
  delete from public.tryon_settings where shop=s.shop_domain;
  get diagnostics n=row_count; counts:=counts||jsonb_build_object('tryon_settings',n);
  delete from public.shopify_shop_tokens where shop_domain=s.shop_domain;
  get diagnostics n=row_count; counts:=counts||jsonb_build_object('shopify_shop_tokens',n);
  update public.shopify_installations set access_token_ciphertext=null,token_iv=null,token_tag=null,
   refresh_token_ciphertext=null,refresh_token_iv=null,refresh_token_tag=null,access_expires_at=null,refresh_expires_at=null,
   credential_version=credential_version+1,updated_at=finished where shop_domain=s.shop_domain and app_client_id=e.app_client_id;
  get diagnostics n=row_count; counts:=counts||jsonb_build_object('installation_credentials_cleared',n);
 end if;
 p_evidence:=jsonb_build_object('counts',counts,'retained_accounting',retained,'completed_at',finished,
  'storageObjectsRemoved',jsonb_array_length(s.storage),'method','single_installation_redaction');
 update public.shopify_installation_events set status='completed',processed_at=finished,
  reason='automatic_single_owner_fulfilment',completion_evidence=p_evidence,
  payload=jsonb_build_object('shop_domain',e.shop_domain,'shop_id',e.payload->'shop_id'),
  privacy_claim=null,privacy_claim_until=null,privacy_next_attempt_at=null where id=p_case;
 update public.shopify_privacy_deletion_scopes set finished_at=finished,storage='[]' where request_id=p_case;
 insert into public.shopify_privacy_case_actions(case_source,case_id,actor,action,evidence)
  values('installation',p_case,'Grind CTRL automation','fulfilled',p_evidence);
 perform set_config('grindctrl.privacy_request','',true);
 return jsonb_build_object('status','completed');
end $$;

revoke all on function public.shopify_privacy_write_guard() from public,anon,authenticated;
revoke all on function public.shopify_privacy_claim(integer,uuid,uuid) from public,anon,authenticated;
revoke all on function public.shopify_privacy_alert_ack(text,uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.shopify_privacy_prepare(text,uuid,uuid) from public,anon,authenticated;
revoke all on function public.shopify_privacy_finish(text,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.shopify_privacy_claim(integer,uuid,uuid),
 public.shopify_privacy_alert_ack(text,uuid,uuid,text),public.shopify_privacy_prepare(text,uuid,uuid),
 public.shopify_privacy_finish(text,uuid,uuid,text,jsonb) to service_role;

-- BEGIN STORE CHAT RETENTION
-- Twelve calendar months since conversation activity. Claims freeze a thread
-- before Storage removal, survive failures, and expire only for worker retries.
alter table public.widget_conversations
  add column if not exists retention_started_at timestamptz,
  add column if not exists retention_activity_at timestamptz;

create table if not exists public.shopify_chat_retention_tasks (
  conversation_id uuid primary key references public.widget_conversations(id) on delete cascade,
  claim uuid not null,
  claim_until timestamptz not null,
  attachment_paths text[] not null default '{}'::text[]
);
alter table public.shopify_chat_retention_tasks enable row level security;
revoke all on public.shopify_chat_retention_tasks from public, anon, authenticated;
grant select, insert, update, delete on public.shopify_chat_retention_tasks to service_role;

create or replace function public.shopify_chat_retention_conversation_guard()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  if old.retention_started_at is not null then
    raise exception 'chat_retention_in_progress';
  end if;
  if (to_jsonb(new) - 'retention_started_at' - 'retention_activity_at')
      is distinct from (to_jsonb(old) - 'retention_started_at' - 'retention_activity_at') then
    new.retention_activity_at := clock_timestamp();
  end if;
  return new;
end $$;
drop trigger if exists shopify_chat_retention_conversation_guard on public.widget_conversations;
create trigger shopify_chat_retention_conversation_guard before update on public.widget_conversations
  for each row execute function public.shopify_chat_retention_conversation_guard();

-- All child writes take the same parent lock as the claim. A new message or
-- attachment that wins the lock renews activity; a claim that wins blocks the
-- write before it can reference Storage that is already being removed.
create or replace function public.shopify_chat_retention_activity_guard()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare v_ids uuid[]; v_conversation record;
begin
  v_ids := array[new.conversation_id];
  if tg_op = 'UPDATE' then v_ids := v_ids || old.conversation_id; end if;
  for v_conversation in
    select c.id, c.retention_started_at from public.widget_conversations c
    where c.id = any(v_ids) order by c.id for update
  loop
    if v_conversation.retention_started_at is not null then
      raise exception 'chat_retention_in_progress';
    end if;
    update public.widget_conversations set retention_activity_at = clock_timestamp()
      where id = v_conversation.id;
  end loop;
  return new;
end $$;
do $$
declare v_table text;
begin
  foreach v_table in array array['widget_messages','messenger_attachments','widget_events','messenger_feedback','messenger_unanswered'] loop
    if not exists (select 1 from pg_trigger where tgname = 'shopify_chat_retention_activity_guard'
      and tgrelid = ('public.' || v_table)::regclass) then
      execute format('create trigger shopify_chat_retention_activity_guard before insert or update on public.%I for each row execute function public.shopify_chat_retention_activity_guard()', v_table);
    end if;
  end loop;
end $$;

create or replace function public.shopify_chat_retention_batch(p_limit integer, p_claim uuid)
returns table(conversation_id uuid, attachment_paths text[])
language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare v_conversation record; v_paths text[]; v_activity timestamptz;
  v_limit integer := greatest(1, least(coalesce(p_limit,25),25));
  v_cutoff timestamptz := clock_timestamp() - interval '12 months';
begin
  if p_claim is null then raise exception 'chat_retention_claim_required'; end if;
  for v_conversation in
    select c.* from public.widget_conversations c
    left join public.shopify_chat_retention_tasks t on t.conversation_id = c.id
    where (t.conversation_id is not null and t.claim_until <= clock_timestamp())
      or (t.conversation_id is null and c.retention_started_at is null
        and greatest(c.started_at,c.closed_at,c.last_message_at,c.retention_activity_at) < v_cutoff)
    order by c.started_at,c.id limit v_limit for update of c skip locked
  loop
    -- Recheck child timestamps under the parent lock. This also handles old
    -- records created before the activity trigger was installed.
    if v_conversation.retention_started_at is null then
      select greatest(
        (select max(m.created_at) from public.widget_messages m where m.conversation_id = v_conversation.id),
        (select max(a.created_at) from public.messenger_attachments a where a.conversation_id = v_conversation.id),
        (select max(e.created_at) from public.widget_events e where e.conversation_id = v_conversation.id),
        (select max(f.created_at) from public.messenger_feedback f where f.conversation_id = v_conversation.id),
        (select max(u.created_at) from public.messenger_unanswered u where u.conversation_id = v_conversation.id)
      ) into v_activity;
      if v_activity >= v_cutoff then
        update public.widget_conversations set retention_activity_at = v_activity where id = v_conversation.id;
        continue;
      end if;
      update public.widget_conversations set retention_started_at = clock_timestamp() where id = v_conversation.id;
    end if;
    select coalesce(array_agg(p.storage_path order by p.storage_path),'{}'::text[]) into v_paths
      from (select distinct a.storage_path from public.messenger_attachments a
        where a.conversation_id = v_conversation.id order by a.storage_path limit 100) p;
    insert into public.shopify_chat_retention_tasks(conversation_id,claim,claim_until,attachment_paths)
      values (v_conversation.id,p_claim,clock_timestamp() + interval '15 minutes',v_paths)
      on conflict on constraint shopify_chat_retention_tasks_pkey do update
      set claim = excluded.claim, claim_until = excluded.claim_until, attachment_paths = excluded.attachment_paths;
    conversation_id := v_conversation.id;
    attachment_paths := v_paths;
    return next;
  end loop;
end $$;

create or replace function public.shopify_chat_retention_finish(p_conversation uuid, p_claim uuid, p_paths text[])
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare v_task public.shopify_chat_retention_tasks%rowtype;
  v_messages integer := 0; v_attachments integer := 0; v_events integer := 0;
  v_feedback integer := 0; v_unanswered integer := 0;
begin
  perform 1 from public.widget_conversations where id = p_conversation for update;
  select * into v_task from public.shopify_chat_retention_tasks where conversation_id = p_conversation for update;
  if not found or v_task.claim is distinct from p_claim or v_task.attachment_paths is distinct from p_paths
    or v_task.claim_until <= clock_timestamp() then raise exception 'chat_retention_claim_lost'; end if;
  delete from public.messenger_attachments where conversation_id = p_conversation and storage_path = any(p_paths);
  get diagnostics v_attachments = row_count;
  if exists (select 1 from public.messenger_attachments where conversation_id = p_conversation) then
    update public.shopify_chat_retention_tasks set claim_until = '-infinity', attachment_paths = '{}'::text[]
      where conversation_id = p_conversation;
    return jsonb_build_object('conversations',0,'messages',0,'attachments',v_attachments,'events',0,'feedback',0,'unanswered',0,'pending',1);
  end if;
  delete from public.messenger_unanswered where conversation_id = p_conversation;
  get diagnostics v_unanswered = row_count;
  delete from public.messenger_feedback where conversation_id = p_conversation;
  get diagnostics v_feedback = row_count;
  delete from public.widget_events where conversation_id = p_conversation;
  get diagnostics v_events = row_count;
  delete from public.widget_messages where conversation_id = p_conversation;
  get diagnostics v_messages = row_count;
  delete from public.widget_conversations where id = p_conversation;
  return jsonb_build_object('conversations',1,'messages',v_messages,'attachments',v_attachments,
    'events',v_events,'feedback',v_feedback,'unanswered',v_unanswered,'pending',0);
end $$;

create or replace function public.shopify_chat_retention_visitors(p_limit integer)
returns integer language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare v_count integer := 0; v_visitor record;
begin
  for v_visitor in
    select v.id from public.widget_visitors v
    where greatest(v.first_seen_at,v.last_seen_at) < clock_timestamp() - interval '12 months'
      and not exists (select 1 from public.widget_conversations c where c.visitor_id = v.id)
    order by v.last_seen_at,v.id limit greatest(1,least(coalesce(p_limit,25),25))
    for update of v skip locked
  loop
    -- Recheck after the row lock: a concurrent conversation insertion may
    -- have committed while the selector waited for its foreign-key lock.
    if not exists (select 1 from public.widget_conversations c where c.visitor_id = v_visitor.id) then
      delete from public.widget_visitors where id = v_visitor.id;
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end $$;

revoke all on function public.shopify_chat_retention_conversation_guard() from public, anon, authenticated;
revoke all on function public.shopify_chat_retention_activity_guard() from public, anon, authenticated;
revoke all on function public.shopify_chat_retention_batch(integer,uuid) from public, anon, authenticated;
revoke all on function public.shopify_chat_retention_finish(uuid,uuid,text[]) from public, anon, authenticated;
revoke all on function public.shopify_chat_retention_visitors(integer) from public, anon, authenticated;
grant execute on function public.shopify_chat_retention_batch(integer,uuid) to service_role;
grant execute on function public.shopify_chat_retention_finish(uuid,uuid,text[]) to service_role;
grant execute on function public.shopify_chat_retention_visitors(integer) to service_role;
-- END STORE CHAT RETENTION

commit;
