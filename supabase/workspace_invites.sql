-- Team invites (v16 N21, 09-backend-contracts.md).
--
-- An owner or admin of a workspace (a store's team) invites someone by email
-- with a role, admin or member; the owner role is never invited. Clerk sends
-- the invitation email. When someone signs in with that verified address,
-- the app adds them to workspace_members with the role and marks the invite
-- accepted. Resending keeps one pending invite per address and workspace.
-- Only the app's server reads and writes this table, with the service role.
--
-- Idempotent: safe to run more than once. Apply by hand in the Supabase SQL
-- editor, after clerk_profiles_workspaces_widget_sites.sql; nothing here
-- runs automatically.

create table if not exists public.workspace_invites (
  id uuid primary key default extensions.uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  role text not null default 'member',
  status text not null default 'pending',
  clerk_invitation_id text,
  invited_by_profile_id uuid references public.profiles(id) on delete set null,
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days')
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.workspace_invites'::regclass and conname = 'workspace_invites_role'
  ) then
    alter table public.workspace_invites
      add constraint workspace_invites_role check (role in ('admin', 'member'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.workspace_invites'::regclass and conname = 'workspace_invites_status'
  ) then
    alter table public.workspace_invites
      add constraint workspace_invites_status check (status in ('pending', 'accepted', 'revoked', 'expired'));
  end if;

  -- Addresses are stored as the app compares them: trimmed and lower case.
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.workspace_invites'::regclass and conname = 'workspace_invites_email_shape'
  ) then
    alter table public.workspace_invites
      add constraint workspace_invites_email_shape
      check (email = lower(btrim(email)) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 254);
  end if;
end $$;

-- One pending invite per address and workspace; a resend updates it.
create unique index if not exists workspace_invites_one_pending
  on public.workspace_invites (workspace_id, email)
  where status = 'pending';

-- Accepting looks invites up by address; the daily cap counts by workspace.
create index if not exists workspace_invites_email_pending
  on public.workspace_invites (email)
  where status = 'pending';
create index if not exists workspace_invites_workspace_invited
  on public.workspace_invites (workspace_id, invited_at desc);

alter table public.workspace_invites enable row level security;
revoke all on table public.workspace_invites from public, anon, authenticated;
grant select, insert, update, delete on table public.workspace_invites to service_role;

comment on table public.workspace_invites is
  'Team invites (N21). One pending row per workspace and address; written only by the app server with the service role.';
