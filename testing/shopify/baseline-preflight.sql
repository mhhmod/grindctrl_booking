-- PREPARED ONLY. NOT EXECUTED. No target connection has been established.
-- Use only after independently attesting the intended project/connection identity.
-- A database named "postgres" does not establish the Supabase project ref.
-- Do not call application functions/views that may write, refresh or reconcile.
-- Catalog metadata only: no credential columns, raw payloads or customer rows.
begin read only;
set local statement_timeout = '5s';
set local lock_timeout = '2s';

select current_database() as database_name, current_user as executing_role,
       current_setting('transaction_read_only') as transaction_read_only,
       current_setting('server_version') as server_version;

with expected(name) as (values
 ('profiles'),('workspaces'),('workspace_members'),('widget_sites'),
 ('tryon_shops'),('tryon_jobs'),('tryon_plans'),('tryon_credit_packs'),
 ('tryon_subscriptions'),('tryon_credit_ledger'),('messenger_conversations'),
 ('shopify_shop_tokens'),('shopify_installations'),('shopify_installation_events'),
 ('shopify_credential_audit'),('shopify_privacy_requests'),
 ('shopify_privacy_case_actions'),('shopify_privacy_work_queue'))
select e.name, c.oid is not null as present, c.relkind,
       c.relrowsecurity, c.relforcerowsecurity, c.relowner::regrole as owner
from expected e left join pg_namespace n on n.nspname='public'
left join pg_class c on c.relnamespace=n.oid and c.relname=e.name
order by e.name;

select table_name,column_name,data_type,is_nullable
from information_schema.columns
where table_schema='public' and table_name in
 ('shopify_installations','shopify_installation_events','shopify_credential_audit',
  'shopify_privacy_requests','shopify_privacy_case_actions','tryon_shops','tryon_jobs',
  'tryon_plans','tryon_subscriptions','tryon_credit_ledger')
order by table_name,ordinal_position;

select c.relname as relation_name, k.conname, k.contype,
       pg_get_constraintdef(k.oid,true) as constraint_definition
from pg_constraint k join pg_class c on c.oid=k.conrelid
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in
 ('shopify_installations','shopify_installation_events','shopify_privacy_case_actions',
  'tryon_shops','tryon_jobs','tryon_credit_ledger','widget_sites')
order by c.relname,k.conname;

select schemaname,tablename,indexname,indexdef from pg_indexes
where schemaname='public' and tablename in
 ('shopify_installations','shopify_installation_events','shopify_privacy_case_actions',
  'tryon_jobs','tryon_credit_ledger','widget_sites')
order by tablename,indexname;

select p.proname,pg_get_function_identity_arguments(p.oid) as arguments,
       p.prosecdef as security_definer,p.provolatile,p.proacl,
       md5(pg_get_functiondef(p.oid)) as definition_fingerprint
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in
 ('shopify_credential_operation','record_shopify_installation_event',
  'record_shopify_installation_event_v2','resolve_shopify_uninstall',
  'retire_shopify_credential','record_shopify_privacy_case_action',
  'reserve_tryon_credit','reserve_tryon_test_look','finalize_tryon_job',
  'refund_tryon_credit','tryon_credit_balance','reconcile_tryon_subscription',
  'reconcile_tryon_entitlements','activate_tryon_plan','apply_tryon_top_up')
order by p.proname,arguments;

select table_name,grantee,privilege_type from information_schema.table_privileges
where table_schema='public' and table_name in
 ('shopify_installations','shopify_installation_events','shopify_credential_audit',
  'shopify_privacy_requests','shopify_privacy_case_actions','shopify_privacy_work_queue',
  'tryon_shops','tryon_jobs','tryon_credit_ledger')
order by table_name,grantee,privilege_type;

select schemaname,tablename,policyname,roles,cmd from pg_policies
where schemaname='public' and tablename in
 ('shopify_installations','shopify_installation_events','shopify_credential_audit',
  'shopify_privacy_requests','shopify_privacy_case_actions','tryon_shops',
  'tryon_jobs','tryon_credit_ledger','workspace_members','widget_sites')
order by tablename,policyname;

select rolname,rolbypassrls from pg_roles
where rolname in ('anon','authenticated','service_role');
select extname,extversion from pg_extension where extname in ('pg_cron','pgcrypto');
select to_regclass('storage.buckets') as storage_catalog,
       to_regclass('cron.job') as schedule_catalog,
       to_regclass('supabase_migrations.schema_migrations') as optional_cli_history;
-- Existing CLI history is neither required nor proof of manual-delta state.
-- Separately inspect only the approved test bucket flags and scheduler identity,
-- after confirming those catalogs exist. Do not dump connection strings/cron SQL.
-- Obtain aggregate table counts/balances only after the schema is established;
-- no dynamic DO/EXECUTE, application RPC, or production row export is included.
rollback;
