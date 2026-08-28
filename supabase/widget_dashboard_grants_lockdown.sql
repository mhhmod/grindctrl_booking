-- ============================================================
-- Migration: widget_dashboard_grants_lockdown
-- Date: 2026-08-27
-- Purpose: Close the browser-role exposure left by the widget /
--   dashboard chain when it is applied to a fresh project.
--
--   Two separate holes, both closed here:
--
--   1) The dashboard_* / bootstrap_* / get_user_workspace RPCs take the
--      CALLER'S identity as a plain parameter (p_clerk_user_id) and never
--      verify it, and several write by row id with no ownership check at
--      all (dashboard_delete_widget_site, dashboard_update_widget_site,
--      dashboard_regenerate_embed_key). Granted to anon -- the anon key
--      ships in the browser bundle -- that is cross-tenant read and write
--      for anyone who learns a Clerk user id or a site uuid.
--
--   2) CREATE FUNCTION grants EXECUTE to PUBLIC by default, so revoking
--      anon/authenticated alone leaves the function reachable through
--      /rest/v1/rpc. PUBLIC has to be revoked explicitly.
--
--   Every caller of these RPCs is server-side (lib/adapters/rpc.ts) and
--   every widget/messenger table access goes through a service-role client,
--   so the correct grant is service_role only. The trust boundary is the
--   Next.js server, which has already established the Clerk session whose
--   id it passes down.
--
--   Apply AFTER: clerk_profiles_workspaces_widget_sites, widget_setup_
--   extensions, widget_production_foundation, clerk_bootstrap_functions,
--   dashboard_rpc_functions, dashboard_widget_events_analytics_rpc,
--   dashboard_install_verification_rpc, messenger_foundation.
-- ============================================================

begin;

-- ── 1) Functions: revoke PUBLIC + browser roles, grant service_role ──

do $$
declare
  v_sig text;
begin
  for v_sig in
    select p.oid::regprocedure::text
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'get_user_workspace', 'bootstrap_profile', 'bootstrap_workspace', 'bootstrap_user',
        'dashboard_get_user_role', 'dashboard_create_widget_site', 'dashboard_update_widget_site',
        'dashboard_delete_widget_site', 'dashboard_regenerate_embed_key', 'dashboard_list_domains',
        'dashboard_add_domain', 'dashboard_update_domain_status', 'dashboard_remove_domain',
        'dashboard_list_intents', 'dashboard_create_intent', 'dashboard_update_intent',
        'dashboard_delete_intent', 'dashboard_list_leads', 'submit_widget_lead',
        'dashboard_get_install_verification', 'dashboard_widget_events_timeseries',
        'dashboard_widget_events_breakdown', 'dashboard_widget_funnel_summary',
        'handle_new_workspace_owner', 'widget_domains_normalize', 'widget_intents_normalize',
        'set_updated_at', 'current_profile_id'
      )
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', v_sig);
  end loop;
end $$;

-- Trigger/helper functions run as the table owner during DML and need no
-- direct grant; only the RPCs the server calls get one.
grant execute on function public.get_user_workspace(text) to service_role;
grant execute on function public.bootstrap_profile(text, text, text, text, text) to service_role;
grant execute on function public.bootstrap_workspace(uuid, text, text) to service_role;
grant execute on function public.bootstrap_user(text, text, text, text, text) to service_role;
grant execute on function public.dashboard_get_user_role(text, uuid) to service_role;
grant execute on function public.dashboard_create_widget_site(text, uuid, text) to service_role;
grant execute on function public.dashboard_update_widget_site(text, uuid, text, text, jsonb) to service_role;
grant execute on function public.dashboard_delete_widget_site(text, uuid) to service_role;
grant execute on function public.dashboard_regenerate_embed_key(text, uuid) to service_role;
grant execute on function public.dashboard_list_domains(text, uuid) to service_role;
grant execute on function public.dashboard_add_domain(text, uuid, text) to service_role;
grant execute on function public.dashboard_update_domain_status(text, uuid, text) to service_role;
grant execute on function public.dashboard_remove_domain(text, uuid) to service_role;
grant execute on function public.dashboard_list_intents(text, uuid) to service_role;
grant execute on function public.dashboard_create_intent(text, uuid, text, text, text, text, text, integer) to service_role;
grant execute on function public.dashboard_update_intent(text, uuid, text, text, text, text, text, integer) to service_role;
grant execute on function public.dashboard_delete_intent(text, uuid) to service_role;
grant execute on function public.dashboard_list_leads(text, uuid, uuid) to service_role;
grant execute on function public.dashboard_get_install_verification(text, uuid) to service_role;
grant execute on function public.dashboard_widget_events_timeseries(text, uuid, text) to service_role;
grant execute on function public.dashboard_widget_events_breakdown(text, uuid, text) to service_role;
grant execute on function public.dashboard_widget_funnel_summary(text, uuid, text) to service_role;

-- ── 2) search_path pinning (Supabase linter 0011) ──

alter function public.set_updated_at() set search_path = public;
alter function public.handle_new_workspace_owner() set search_path = public;
alter function public.widget_domains_normalize() set search_path = public;
alter function public.widget_intents_normalize() set search_path = public;

-- ── 3) Tables: browser roles get nothing ──
-- Same posture as tryon_* and messenger_*: isolation does not rest solely
-- on RLS policy evaluation. The RLS policies stay in place as defence in
-- depth for any future browser-side reader.

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'profiles', 'workspaces', 'workspace_members',
    'widget_sites', 'widget_domains', 'widget_domain_audit', 'widget_intents',
    'widget_leads', 'widget_visitors', 'widget_conversations', 'widget_messages',
    'widget_events'
  ]
  loop
    execute format('revoke all on table public.%I from anon, authenticated', v_table);
    execute format('grant select, insert, update, delete on table public.%I to service_role', v_table);
  end loop;
end $$;

commit;

-- Rollback (restores the exposure; only for emergency compatibility with a
-- browser-side caller that has not yet been moved server-side):
-- begin;
-- grant execute on function public.get_user_workspace(text) to anon, authenticated;
-- grant select, insert, update, delete on table public.widget_sites to anon, authenticated;
-- commit;
