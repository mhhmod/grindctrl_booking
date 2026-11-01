-- OPERATOR CASEWORK TEMPLATE, NOT A MIGRATION. Never run without separate approval.
-- Replace the one JSON marker with the reviewed case manifest. Use restricted,
-- authenticated operator tooling; actor strings do NOT authenticate an operator.
-- External evidence must establish current absence of THIS app on THIS store.
-- No webhook timestamp, display name alone or another app's token is evidence.
begin;
do $reconciliation$
declare
 c jsonb := $case$__APPROVED_CASE_JSON__$case$::jsonb;
 r public.shopify_installations;
 observed timestamptz;
 receipts integer;
begin
 if jsonb_typeof(c) <> 'object'
   or coalesce(c->>'operator_id','') = '' or coalesce(c->>'reviewer_id','') = ''
   or c->>'operator_id' = c->>'reviewer_id'
   or coalesce(c->>'ticket_ref','') = '' or coalesce(c->>'approval_ref','') = ''
   or coalesce(c->>'evidence_ref','') = ''
   or coalesce(c->>'evidence_sha256','') !~ '^[a-f0-9]{64}$'
   or coalesce(c->>'authority','') not in ('shopify_authenticated_admin_and_registration','shopify_support')
   or coalesce(c->>'store_id','') = ''
   or coalesce(c->>'shop_domain','') !~ '^[a-z0-9][a-z0-9-]*[.]myshopify[.]com$'
   or coalesce(c->>'app_client_id','') = ''
   or coalesce(c->>'observed_at','') = ''
   or coalesce((c->>'credential_version')::bigint,-1) < 1
   or jsonb_typeof(c->'receipt_ids') is distinct from 'array'
 then raise exception 'manual_reconciliation_evidence_required'; end if;
 observed := (c->>'observed_at')::timestamptz;
 if observed > clock_timestamp() or observed < clock_timestamp()-interval '1 hour'
 then raise exception 'manual_reconciliation_observation_stale'; end if;
 if jsonb_array_length(c->'receipt_ids') = 0
 then raise exception 'manual_reconciliation_receipts_required'; end if;

 perform pg_advisory_xact_lock(hashtextextended('shopify:' || (c->>'shop_domain'),0));
 select * into r from public.shopify_installations where id=(c->>'installation_id')::uuid for update;
 if not found or r.shop_domain is distinct from c->>'shop_domain'
   or r.app_client_id is distinct from c->>'app_client_id'
   or r.credential_version is distinct from (c->>'credential_version')::bigint
   or r.status <> 'reauthorization_required' or r.lease_id is not null
   or r.updated_at > observed
 then raise exception 'manual_reconciliation_fence_lost'; end if;
 -- Reject missing, duplicate, foreign, privacy or previously closed receipts.
 select count(*) into receipts from public.shopify_installation_events e
 where e.id in (select value::uuid from jsonb_array_elements_text(c->'receipt_ids'))
   and e.app_client_id=r.app_client_id and e.shop_domain=r.shop_domain
   and e.topic='app/uninstalled' and e.status in ('received','manual_required','failed');
 if receipts <> jsonb_array_length(c->'receipt_ids')
 then raise exception 'manual_reconciliation_receipt_mismatch'; end if;

 -- Only an already-disabled, exact credential generation can be retired.
 update public.shopify_installations set status='uninstalled',uninstalled_at=clock_timestamp(),
   access_token_ciphertext=null,token_iv=null,token_tag=null,
   refresh_token_ciphertext=null,refresh_token_iv=null,refresh_token_tag=null,
   access_expires_at=null,refresh_expires_at=null,refresh_retry_after=null,
   credential_version=credential_version+1,updated_at=clock_timestamp()
 where id=r.id;
 update public.tryon_shops set status='uninstalled',uninstalled_at=clock_timestamp(),updated_at=clock_timestamp()
 where shop_domain=r.shop_domain and not exists (
   select 1 from public.shopify_installations where shop_domain=r.shop_domain and status='active');
 update public.shopify_installation_events set status='completed',processed_at=clock_timestamp(),
   reason='manual_current_installation_absence_verified',
   verification=jsonb_build_object('mode','approved_manual_reconciliation',
     'installation_id',r.id,'credential_version',r.credential_version,
     'authority',c->>'authority','store_id',c->>'store_id','observed_at',observed,
     'operator_id',c->>'operator_id','reviewer_id',c->>'reviewer_id',
     'ticket_ref',c->>'ticket_ref','approval_ref',c->>'approval_ref',
     'evidence_ref',c->>'evidence_ref','evidence_sha256',c->>'evidence_sha256',
     'verified_at',clock_timestamp())
 where id in (select value::uuid from jsonb_array_elements_text(c->'receipt_ids'));
 -- No merchant/account/subscription/job/credit/ledger data is deleted or moved.
end $reconciliation$;
commit;
