-- ============================================================
-- Migration: fix_workspace_members_rls_commands_split
-- Date: 2026-04-21
-- Purpose: Eliminate recursion by avoiding FOR ALL policies on
-- workspace_members, and splitting owner management by command.
-- ============================================================

begin;

drop policy if exists "workspace_members: read own workspace" on public.workspace_members;
drop policy if exists "workspace_members: insert admin_or_owner" on public.workspace_members;
drop policy if exists "workspace_members: update admin_or_owner" on public.workspace_members;
drop policy if exists "workspace_members: delete admin_or_owner" on public.workspace_members;
drop policy if exists "workspace_members: manage by owner" on public.workspace_members;
drop policy if exists "workspace_members: read own" on public.workspace_members;
drop policy if exists "workspace_members: insert by owner" on public.workspace_members;
drop policy if exists "workspace_members: update by owner" on public.workspace_members;
drop policy if exists "workspace_members: delete by owner" on public.workspace_members;

create policy "workspace_members: read own"
  on public.workspace_members for select
  using (
    profile_id in (
      select id from public.profiles
      where clerk_user_id = current_setting('app.clerk_user_id', true)
    )
  );

create policy "workspace_members: insert by owner"
  on public.workspace_members for insert
  with check (
    workspace_id in (
      select id from public.workspaces
      where owner_profile_id in (
        select id from public.profiles
        where clerk_user_id = current_setting('app.clerk_user_id', true)
      )
    )
  );

create policy "workspace_members: update by owner"
  on public.workspace_members for update
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

create policy "workspace_members: delete by owner"
  on public.workspace_members for delete
  using (
    workspace_id in (
      select id from public.workspaces
      where owner_profile_id in (
        select id from public.profiles
        where clerk_user_id = current_setting('app.clerk_user_id', true)
      )
    )
  );

commit;
