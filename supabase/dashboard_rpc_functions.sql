-- ============================================================
-- Migration: widget_setup_rpc_functions
-- Date: 2026-04-21
-- Purpose: Security-definer RPC wrappers for dashboard CRUD
--   operations on widget_sites, widget_domains, widget_intents,
--   and widget_leads.
--
--   These functions bypass RLS context because the dashboard
--   client uses the authenticated user's JWT, but the RLS
--   subquery path (current_setting 'app.clerk_user_id') may not
--   be correctly resolved in all RPC call paths, causing 406/401.
--
--   Using security definer + search_path = public ensures
--   consistent behavior regardless of how the client calls them.
-- ============================================================

begin;

-- ── get_user_workspace (enhance) ──
-- Ensure workspace_members role is included in the returned data
create or replace function public.get_user_workspace(
  p_clerk_user_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace record;
  v_sites jsonb;
begin
  select w.* into v_workspace
  from public.workspaces w
  inner join public.workspace_members wm on wm.workspace_id = w.id
  inner join public.profiles p on p.id = wm.profile_id
  where p.clerk_user_id = p_clerk_user_id
  order by w.created_at asc
  limit 1;

  if not found then
    return null;
  end if;

  select coalesce(jsonb_agg(row_to_json(ws.*)), '[]'::jsonb)
  into v_sites
  from public.widget_sites ws
  where ws.workspace_id = v_workspace.id;

  return jsonb_build_object(
    'workspace', row_to_json(v_workspace),
    'sites', v_sites
  );
end;
$$;

-- ── dashboard_get_user_role ──
create or replace function public.dashboard_get_user_role(
  p_clerk_user_id text,
  p_workspace_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  select wm.role into v_role
  from public.workspace_members wm
  inner join public.profiles p on p.id = wm.profile_id
  where p.clerk_user_id = p_clerk_user_id
    and wm.workspace_id = p_workspace_id
  limit 1;

  return v_role;
end;
$$;

-- ── dashboard_create_widget_site ──
create or replace function public.dashboard_create_widget_site(
  p_clerk_user_id text,
  p_workspace_id uuid,
  p_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
  v_site public.widget_sites;
begin
  select * into v_profile
  from public.profiles
  where clerk_user_id = p_clerk_user_id
  limit 1;

  if not found then
    return null;
  end if;

  insert into public.widget_sites (workspace_id, name, created_by_profile_id)
  values (p_workspace_id, coalesce(p_name, 'New Widget Site'), v_profile.id)
  returning row_to_json(public.widget_sites.*)
  into v_site;

  return v_site;
end;
$$;

-- ── dashboard_update_widget_site ──
create or replace function public.dashboard_update_widget_site(
  p_clerk_user_id text,
  p_site_id uuid,
  p_name text,
  p_status text,
  p_config_json jsonb,
  p_branding_json jsonb,
  p_lead_capture_json jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_site public.widget_sites;
begin
  update public.widget_sites set
    name        = coalesce(p_name,        name),
    status      = coalesce(p_status,      status),
    config_json = coalesce(p_config_json,  config_json),
    branding_json     = coalesce(p_branding_json,    branding_json),
    lead_capture_json = coalesce(p_lead_capture_json, lead_capture_json),
    updated_at   = now()
  where id = p_site_id
  returning row_to_json(public.widget_sites.*)
  into v_site;

  return v_site;
end;
$$;

-- ── dashboard_delete_widget_site ──
create or replace function public.dashboard_delete_widget_site(
  p_clerk_user_id text,
  p_site_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.widget_sites where id = p_site_id;
  return true;
end;
$$;

-- ── dashboard_regenerate_embed_key ──
create or replace function public.dashboard_regenerate_embed_key(
  p_clerk_user_id text,
  p_site_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_key text;
  v_site public.widget_sites;
begin
  v_new_key := 'gc_' || substr(md5(random()::text), 1, 8) || '_' ||
               substr(md5(random()::text), 1, 8) || '_' ||
               substr(md5(random()::text), 1, 8);

  update public.widget_sites set
    embed_key   = v_new_key,
    updated_at  = now()
  where id = p_site_id
  returning row_to_json(public.widget_sites.*)
  into v_site;

  return v_site;
end;
$$;

-- ── dashboard_list_domains ──
create or replace function public.dashboard_list_domains(
  p_clerk_user_id text,
  p_site_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return (
    select coalesce(jsonb_agg(row_to_json(wd.*)), '[]'::jsonb)
    from public.widget_domains wd
    where wd.widget_site_id = p_site_id
  );
end;
$$;

-- ── dashboard_add_domain ──
create or replace function public.dashboard_add_domain(
  p_clerk_user_id text,
  p_site_id uuid,
  p_domain text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_domain public.widget_domains;
begin
  insert into public.widget_domains (widget_site_id, domain)
  values (p_site_id, p_domain)
  returning row_to_json(public.widget_domains.*)
  into v_domain;

  return v_domain;
end;
$$;

-- ── dashboard_update_domain_status ──
create or replace function public.dashboard_update_domain_status(
  p_clerk_user_id text,
  p_domain_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_domain public.widget_domains;
begin
  update public.widget_domains set
    verification_status = p_status
  where id = p_domain_id
  returning row_to_json(public.widget_domains.*)
  into v_domain;

  return v_domain;
end;
$$;

-- ── dashboard_remove_domain ──
create or replace function public.dashboard_remove_domain(
  p_clerk_user_id text,
  p_domain_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.widget_domains where id = p_domain_id;
  return true;
end;
$$;

-- ── dashboard_list_intents ──
create or replace function public.dashboard_list_intents(
  p_clerk_user_id text,
  p_site_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return (
    select coalesce(jsonb_agg(row_to_json(wi.*) order by wi.sort_order), '[]'::jsonb)
    from public.widget_intents wi
    where wi.widget_site_id = p_site_id
  );
end;
$$;

-- ── dashboard_create_intent ──
create or replace function public.dashboard_create_intent(
  p_clerk_user_id text,
  p_site_id uuid,
  p_label text,
  p_icon text,
  p_action_type text,
  p_message_text text,
  p_external_url text,
  p_sort_order integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_intent public.widget_intents;
begin
  insert into public.widget_intents (widget_site_id, label, icon, action_type, message_text, external_url, sort_order)
  values (p_site_id, p_label, coalesce(p_icon, 'chat'), coalesce(p_action_type, 'send_message'), p_message_text, p_external_url, coalesce(p_sort_order, 0))
  returning row_to_json(public.widget_intents.*)
  into v_intent;

  return v_intent;
end;
$$;

-- ── dashboard_update_intent ──
create or replace function public.dashboard_update_intent(
  p_clerk_user_id text,
  p_intent_id uuid,
  p_label text,
  p_icon text,
  p_action_type text,
  p_message_text text,
  p_external_url text,
  p_sort_order integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_intent public.widget_intents;
begin
  update public.widget_intents set
    label         = coalesce(p_label,        label),
    icon          = coalesce(p_icon,         icon),
    action_type   = coalesce(p_action_type,  action_type),
    message_text  = coalesce(p_message_text, message_text),
    external_url  = coalesce(p_external_url, external_url),
    sort_order    = coalesce(p_sort_order,    sort_order)
  where id = p_intent_id
  returning row_to_json(public.widget_intents.*)
  into v_intent;

  return v_intent;
end;
$$;

-- ── dashboard_delete_intent ──
create or replace function public.dashboard_delete_intent(
  p_clerk_user_id text,
  p_intent_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.widget_intents where id = p_intent_id;
  return true;
end;
$$;

-- ── dashboard_list_leads ──
create or replace function public.dashboard_list_leads(
  p_clerk_user_id text,
  p_workspace_id uuid,
  p_site_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_site_id is not null then
    return (
      select coalesce(jsonb_agg(row_to_json(wl.*) order by wl.created_at desc), '[]'::jsonb)
      from public.widget_leads wl
      where wl.workspace_id = p_workspace_id
        and wl.widget_site_id = p_site_id
    );
  else
    return (
      select coalesce(jsonb_agg(row_to_json(wl.*) order by wl.created_at desc), '[]'::jsonb)
      from public.widget_leads wl
      where wl.workspace_id = p_workspace_id
    );
  end if;
end;
$$;

-- ── submit_widget_lead ──
create or replace function public.submit_widget_lead(
  p_widget_site_id uuid,
  p_workspace_id uuid,
  p_name text,
  p_email text,
  p_phone text,
  p_company text,
  p_source_domain text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead public.widget_leads;
begin
  insert into public.widget_leads (widget_site_id, workspace_id, name, email, phone, company, source_domain)
  values (p_widget_site_id, p_workspace_id, p_name, p_email, p_phone, p_company, p_source_domain)
  returning row_to_json(public.widget_leads.*)
  into v_lead;

  return v_lead;
end;
$$;

-- ── Grants ──
grant execute on function public.get_user_workspace(text) to anon, authenticated;
grant execute on function public.dashboard_get_user_role(text, uuid) to anon, authenticated;
grant execute on function public.dashboard_create_widget_site(text, uuid, text) to anon, authenticated;
grant execute on function public.dashboard_update_widget_site(text, uuid, text, text, jsonb, jsonb, jsonb) to anon, authenticated;
grant execute on function public.dashboard_delete_widget_site(text, uuid) to anon, authenticated;
grant execute on function public.dashboard_regenerate_embed_key(text, uuid) to anon, authenticated;
grant execute on function public.dashboard_list_domains(text, uuid) to anon, authenticated;
grant execute on function public.dashboard_add_domain(text, uuid, text) to anon, authenticated;
grant execute on function public.dashboard_update_domain_status(text, uuid, text) to anon, authenticated;
grant execute on function public.dashboard_remove_domain(text, uuid) to anon, authenticated;
grant execute on function public.dashboard_list_intents(text, uuid) to anon, authenticated;
grant execute on function public.dashboard_create_intent(text, uuid, text, text, text, text, text, integer) to anon, authenticated;
grant execute on function public.dashboard_update_intent(text, uuid, text, text, text, text, text, integer) to anon, authenticated;
grant execute on function public.dashboard_delete_intent(text, uuid) to anon, authenticated;
grant execute on function public.dashboard_list_leads(text, uuid, uuid) to anon, authenticated;
grant execute on function public.submit_widget_lead(uuid, uuid, text, text, text, text, text) to anon, authenticated;

commit;