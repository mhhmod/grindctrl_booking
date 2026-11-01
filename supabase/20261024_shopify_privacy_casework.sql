-- Manual additive delta AFTER installation isolation + review remediation.
-- Append-only evidence for BOTH new and legacy cases; this does not execute
-- deletion, select a legal retention basis, or authorize production SQL.
begin;
create table if not exists public.shopify_privacy_case_actions (
 id uuid primary key default gen_random_uuid(),
 case_source text not null check (case_source in ('installation','legacy')),
 case_id uuid not null,
 actor text not null check (length(actor) between 1 and 128),
 action text not null check (action in ('assigned','scoped','escalated','retention_hold','fulfilled')),
 evidence jsonb not null check (jsonb_typeof(evidence)='object'),
 occurred_at timestamptz not null default clock_timestamp()
);
create index if not exists shopify_privacy_case_actions_case_idx
 on public.shopify_privacy_case_actions(case_source,case_id,occurred_at desc);
alter table public.shopify_privacy_case_actions enable row level security;
revoke all on public.shopify_privacy_case_actions from public,anon,authenticated;
grant select,insert on public.shopify_privacy_case_actions to service_role;

create or replace view public.shopify_privacy_work_queue with (security_invoker=true) as
with cases as (
 select 'installation'::text as case_source,id,app_client_id,shop_domain,topic,status,received_at
 from public.shopify_installation_events where topic in ('customers/data_request','customers/redact','shop/redact')
 union all
 select 'legacy',id,null::text,shop_domain,topic,status,received_at from public.shopify_privacy_requests
)
select c.*,c.received_at+interval '30 days' as due_at,
 clock_timestamp()>c.received_at+interval '30 days' as overdue,
 case when c.status='completed' and not exists (
   select 1 from public.shopify_privacy_case_actions a
   where a.case_source=c.case_source and a.case_id=c.id and a.action='fulfilled'
 ) then 'completion_unverified' else c.status end as reviewed_status,
 (select a.actor from public.shopify_privacy_case_actions a where a.case_source=c.case_source
   and a.case_id=c.id and a.action='assigned' order by occurred_at desc,id desc limit 1) as assigned_owner
from cases c;
revoke all on public.shopify_privacy_work_queue from public,anon,authenticated;
grant select on public.shopify_privacy_work_queue to service_role;

-- Restricted operator tooling supplies authenticated actor identity; there is
-- no browser/public completion endpoint. Evidence contains restricted artifact
-- references/hashes, never exports, customer identifiers or credentials.
create or replace function public.record_shopify_privacy_case_action(
 p_source text,p_case uuid,p_actor text,p_action text,p_evidence jsonb
) returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare topic_name text; existing_scope jsonb; last_action text; result_id uuid;
begin
 if p_source not in ('installation','legacy') or p_actor is null or length(btrim(p_actor)) not between 1 and 128
   or p_action not in ('assigned','scoped','escalated','retention_hold','fulfilled')
   or p_evidence is null or jsonb_typeof(p_evidence)<>'object' or octet_length(p_evidence::text)>65536 then
   raise exception 'invalid_privacy_case_action';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('privacy:'||p_source||':'||p_case::text,0));
 if p_source='installation' then
   select topic into topic_name from public.shopify_installation_events where id=p_case for update;
 else
   select topic into topic_name from public.shopify_privacy_requests where id=p_case for update;
 end if;
 if topic_name is null or topic_name not in ('customers/data_request','customers/redact','shop/redact') then
   raise exception 'unknown_privacy_case';
 end if;
 if exists(select 1 from public.shopify_privacy_case_actions where case_source=p_source and case_id=p_case and action='fulfilled') then
   raise exception 'privacy_case_already_closed';
 end if;
 if coalesce(p_evidence->>'ticket_ref','')='' then raise exception 'privacy_ticket_required'; end if;
 if p_action in ('scoped','fulfilled') then
   if coalesce(p_evidence->>'scope_sha256','') !~ '^[a-f0-9]{64}$'
     or coalesce(p_evidence->>'reviewer','')='' or p_evidence->>'reviewer'=p_actor
     or coalesce(p_evidence->>'approval_ref','')='' then raise exception 'privacy_review_required'; end if;
   if p_source='legacy' and coalesce(p_evidence->>'provenance_ref','')='' then
     raise exception 'legacy_privacy_provenance_required';
   end if;
 end if;
 if p_action='scoped' and coalesce(p_evidence->>'scope_ref','')='' then raise exception 'privacy_scope_required'; end if;
 if p_action='retention_hold' and (coalesce(p_evidence->>'legal_basis_ref','')=''
   or coalesce(p_evidence->>'review_at','')='') then raise exception 'specific_retention_basis_required'; end if;
 if p_action='fulfilled' then
   select evidence into existing_scope from public.shopify_privacy_case_actions
    where case_source=p_source and case_id=p_case and action='scoped' order by occurred_at desc,id desc limit 1;
   select action into last_action from public.shopify_privacy_case_actions
    where case_source=p_source and case_id=p_case and action in ('scoped','retention_hold')
    order by occurred_at desc,id desc limit 1;
   if existing_scope is null or existing_scope->>'scope_sha256'<>p_evidence->>'scope_sha256'
     or last_action='retention_hold' then raise exception 'approved_privacy_scope_required'; end if;
   if coalesce(p_evidence->>'execution_ref','')='' or coalesce(p_evidence->>'verification_ref','')=''
     or (p_evidence->'verification_passed') is distinct from 'true'::jsonb then raise exception 'privacy_execution_evidence_required'; end if;
   if topic_name='customers/data_request' then
     if coalesce(p_evidence->>'delivery_ref','')='' then raise exception 'privacy_delivery_evidence_required'; end if;
   elsif coalesce(p_evidence->>'deletion_ref','')='' or coalesce(p_evidence->>'retained_records_ref','')='' then
     raise exception 'privacy_deletion_evidence_required';
   end if;
   if p_source='installation' then
     update public.shopify_installation_events set status='completed',processed_at=clock_timestamp(),reason='operator_verified_fulfillment' where id=p_case;
   else
     update public.shopify_privacy_requests set status='completed',processed_at=clock_timestamp(),last_error=null where id=p_case;
   end if;
 end if;
 insert into public.shopify_privacy_case_actions(case_source,case_id,actor,action,evidence)
 values(p_source,p_case,p_actor,p_action,p_evidence) returning id into result_id;
 return result_id;
end $$;
revoke all on function public.record_shopify_privacy_case_action(text,uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.record_shopify_privacy_case_action(text,uuid,text,text,jsonb) to service_role;
commit;
