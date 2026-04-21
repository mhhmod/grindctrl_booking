-- ============================================================
-- Migration: fix_workspace_members_rls_recursion
-- Date: 2026-04-21
-- Purpose: Replace recursive workspace_members RLS policies with
--   non-recursive versions that reference workspaces/profiles
--   directly. Prevents infinite recursion when widget_sites or
--   workspaces policies query workspace_members.
-- ============================================================

begin;

-- Drop recursive policies on workspace_members
-- (These self-reference workspace_members in their USING clause)
drop policy if exists "workspace_members: read own workspace" on public.workspace_members;
drop policy if exists "workspace_members: insert admin_or_owner" on public.workspace_members;
drop policy if exists "workspace_members: update admin_or_owner" on public.workspace_members;
drop policy if exists "workspace_members: delete admin_or_owner" on public.workspace_members;

-- Simplified read: user can see their own membership rows.
-- This is sufficient for widget_sites / workspaces policies that
-- subquery workspace_members for the current user's profile_id.
create policy "workspace_members: read own"
  on public.workspace_members for select
  using (
    profile_id in (
      select id from public.profiles
      where clerk_user_id = current_setting('app.clerk_user_id', true)
    )
  );

-- Owner-only management (insert/update/delete) via workspaces table.
-- Avoids recursion by querying workspaces.owner_profile_id instead of
-- workspace_members.role.
create policy "workspace_members: manage by owner"
  on public.workspace_members for all
  using (
    workspace_id in (
      select id from public.workspaces
      where owner_profile_id in (
        select id from public.profiles
        where clerk_user_id = current_setting('app.clerk_user_id', true)
      )
    )
  )
  with check (
    workspace_id in (
      select id from public.workspaces
      where owner_profile_id in (
        select id from public.profiles
        where clerk_user_id = current_setting('app.clerk_user_id', true)
      )
    )
  );

commit;
