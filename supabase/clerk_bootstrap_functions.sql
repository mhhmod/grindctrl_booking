-- ============================================================
-- Migration: clerk_bootstrap_functions
-- Date: 2026-04-21
-- Purpose: Security-definer functions for first-time user bootstrap
--   via Clerk. These functions run with elevated privileges to
--   create profiles, workspaces, and workspace memberships
--   regardless of RLS policies on the calling role.
--
--   The browser anon client calls these via supabase.rpc() after
--   Clerk authentication, which safely bypasses RLS for bootstrap
--   writes while keeping all other RLS policies intact.
--
--   For reads, the browser uses security-definer RPCs
--   (get_user_workspace) instead of direct table selects during
--   bootstrap, which avoids RLS recursion paths.
-- ============================================================

begin;

-- ── Bootstrap: create or update a profile from Clerk user data ──
-- Called via supabase.rpc('bootstrap_profile', { ... })
-- Returns the profile row.
create or replace function public.bootstrap_profile(
  p_clerk_user_id text,
  p_email text,
  p_first_name text default null,
  p_last_name text default null,
  p_image_url text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
begin
  insert into public.profiles (clerk_user_id, email, first_name, last_name, image_url)
  values (p_clerk_user_id, p_email, p_first_name, p_last_name, p_image_url)
  on conflict (clerk_user_id) do update
  set
    email = excluded.email,
    first_name = coalesce(excluded.first_name, public.profiles.first_name),
    last_name = coalesce(excluded.last_name, public.profiles.last_name),
    image_url = coalesce(excluded.image_url, public.profiles.image_url),
    updated_at = now()
  returning *
  into v_profile;

  return v_profile;
end;
$$;

-- ── Bootstrap: create default workspace for a profile ──
-- Called via supabase.rpc('bootstrap_workspace', { ... })
-- Returns the workspace row.
create or replace function public.bootstrap_workspace(
  p_owner_profile_id uuid,
  p_name text default null,
  p_slug text default null
)
returns public.workspaces
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace public.workspaces;
  v_final_name text;
  v_final_slug text;
begin
  select * into v_workspace
  from public.workspaces
  where owner_profile_id = p_owner_profile_id
  order by created_at asc
  limit 1;

  if found then
    return v_workspace;
  end if;

  v_final_name := coalesce(p_name, 'My Workspace');
  v_final_slug := coalesce(
    p_slug,
    lower(regexp_replace(v_final_name, '[^a-z0-9]+', '-', 'gi'))
    || '-' || substr(md5(random()::text), 1, 6)
  );

  insert into public.workspaces (name, slug, owner_profile_id)
  values (v_final_name, v_final_slug, p_owner_profile_id)
  returning *
  into v_workspace;

  return v_workspace;
end;
$$;

-- ── Convenience: full bootstrap in a single call ──
-- Creates profile (or updates), then workspace (with membership via trigger).
-- Returns a JSON object with profile and workspace data.
create or replace function public.bootstrap_user(
  p_clerk_user_id text,
  p_email text,
  p_first_name text default null,
  p_last_name text default null,
  p_image_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
  v_workspace public.workspaces;
begin
  -- Create or update profile
  v_profile := public.bootstrap_profile(
    p_clerk_user_id, p_email, p_first_name, p_last_name, p_image_url
  );

  -- Create workspace if none exists (trigger handles membership)
  select * into v_workspace
  from public.workspaces
  where owner_profile_id = v_profile.id
  order by created_at asc
  limit 1;

  if not found then
    v_workspace := public.bootstrap_workspace(v_profile.id);
  end if;

  return jsonb_build_object(
    'profile', row_to_json(v_profile),
    'workspace', row_to_json(v_workspace)
  );
end;
$$;

-- ── Get workspace data for a Clerk user (with RLS context) ──
-- Called via supabase.rpc('get_user_workspace', { p_clerk_user_id })
-- Returns the user's first workspace with sites.
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

-- ── Grant execute to anon and authenticated roles ──
-- These are the only roles that should call these functions from the browser.
-- The security definer ensures they run with function-owner privileges,
-- not the caller's privileges, so RLS is safely bypassed only for these
-- specific operations. search_path = public prevents injection.
grant execute on function public.bootstrap_profile(text, text, text, text, text) to anon, authenticated;
grant execute on function public.bootstrap_workspace(uuid, text, text) to anon, authenticated;
grant execute on function public.bootstrap_user(text, text, text, text, text) to anon, authenticated;
grant execute on function public.get_user_workspace(text) to anon, authenticated;

commit;
