-- ============================================================
-- Migration: clerk_profiles_workspaces_widget_sites
-- Date: 2026-04-20
-- Purpose: Clerk-bridged application tables for the protected dashboard.
--   Clerk is the identity provider. Supabase stores app data.
--
-- Tables created:
--   profiles           — mirrors Clerk user data, keyed by clerk_user_id
--   workspaces         — one default workspace per user
--   workspace_members  — many-to-many with roles (owner/admin/member)
--   widget_sites       — per-workspace widget configurations with embed_key
--   widget_domains     — per-site domain verification
-- ============================================================

begin;

-- ── updated_at trigger function (reusable) ──
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── profiles: mirrors Clerk user data ──
create table if not exists public.profiles (
  id uuid primary key default extensions.uuid_generate_v4(),
  clerk_user_id text unique not null,
  email text not null,
  first_name text,
  last_name text,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── workspaces: one default workspace per user ──
create table if not exists public.workspaces (
  id uuid primary key default extensions.uuid_generate_v4(),
  name text not null,
  slug text unique not null,
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── workspace_members: many-to-many with roles ──
create table if not exists public.workspace_members (
  id uuid primary key default extensions.uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')) default 'member',
  created_at timestamptz not null default now(),
  unique(workspace_id, profile_id)
);

-- ── widget_sites: per-workspace widget configurations ──
create table if not exists public.widget_sites (
  id uuid primary key default extensions.uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  domain text,
  embed_key text unique not null default (
    'gc_' || substr(md5(random()::text), 1, 8) || '_' ||
    substr(md5(random()::text), 1, 8) || '_' ||
    substr(md5(random()::text), 1, 8)
  ),
  status text not null check (status in ('draft', 'active', 'disabled')) default 'draft',
  created_by_profile_id uuid not null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── widget_domains: per-site domain verification ──
create table if not exists public.widget_domains (
  id uuid primary key default extensions.uuid_generate_v4(),
  widget_site_id uuid not null references public.widget_sites(id) on delete cascade,
  domain text not null,
  verification_status text not null check (verification_status in ('pending', 'verified', 'failed')) default 'pending',
  created_at timestamptz not null default now()
);

-- ── Enable RLS on all tables ──
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.widget_sites enable row level security;
alter table public.widget_domains enable row level security;

-- ── profiles policies ──
create policy "profiles: read own"
  on public.profiles for select
  using (clerk_user_id = current_setting('app.clerk_user_id', true));

create policy "profiles: insert own"
  on public.profiles for insert
  with check (clerk_user_id = current_setting('app.clerk_user_id', true));

create policy "profiles: update own"
  on public.profiles for update
  using (clerk_user_id = current_setting('app.clerk_user_id', true));

-- ── workspaces policies ──
create policy "workspaces: read member"
  on public.workspaces for select
  using (
    id in (
      select workspace_id from public.workspace_members
      where profile_id in (
        select id from public.profiles
        where clerk_user_id = current_setting('app.clerk_user_id', true)
      )
    )
  );

create policy "workspaces: insert own"
  on public.workspaces for insert
  with check (
    owner_profile_id in (
      select id from public.profiles
      where clerk_user_id = current_setting('app.clerk_user_id', true)
    )
  );

create policy "workspaces: update owner"
  on public.workspaces for update
  using (
    id in (
      select workspace_id from public.workspace_members
      where profile_id in (
        select id from public.profiles
        where clerk_user_id = current_setting('app.clerk_user_id', true)
      )
      and role = 'owner'
    )
  );

-- ── workspace_members policies ──
create policy "workspace_members: read own workspace"
  on public.workspace_members for select
  using (
    workspace_id in (
      select workspace_id from public.workspace_members
      where profile_id in (
        select id from public.profiles
        where clerk_user_id = current_setting('app.clerk_user_id', true)
      )
    )
  );

create policy "workspace_members: insert admin_or_owner"
  on public.workspace_members for insert
  with check (
    workspace_id in (
      select workspace_id from public.workspace_members
      where profile_id in (
        select id from public.profiles
        where clerk_user_id = current_setting('app.clerk_user_id', true)
      )
      and role in ('owner', 'admin')
    )
  );

create policy "workspace_members: update admin_or_owner"
  on public.workspace_members for update
  using (
    workspace_id in (
      select workspace_id from public.workspace_members
      where profile_id in (
        select id from public.profiles
        where clerk_user_id = current_setting('app.clerk_user_id', true)
      )
      and role in ('owner', 'admin')
    )
  );

create policy "workspace_members: delete admin_or_owner"
  on public.workspace_members for delete
  using (
    workspace_id in (
      select workspace_id from public.workspace_members
      where profile_id in (
        select id from public.profiles
        where clerk_user_id = current_setting('app.clerk_user_id', true)
      )
      and role in ('owner', 'admin')
    )
  );

-- ── widget_sites policies ──
create policy "widget_sites: read own workspace"
  on public.widget_sites for select
  using (
    workspace_id in (
      select workspace_id from public.workspace_members
      where profile_id in (
        select id from public.profiles
        where clerk_user_id = current_setting('app.clerk_user_id', true)
      )
    )
  );

create policy "widget_sites: insert member"
  on public.widget_sites for insert
  with check (
    workspace_id in (
      select workspace_id from public.workspace_members
      where profile_id in (
        select id from public.profiles
        where clerk_user_id = current_setting('app.clerk_user_id', true)
      )
    )
  );

create policy "widget_sites: update member"
  on public.widget_sites for update
  using (
    workspace_id in (
      select workspace_id from public.workspace_members
      where profile_id in (
        select id from public.profiles
        where clerk_user_id = current_setting('app.clerk_user_id', true)
      )
    )
  );

create policy "widget_sites: delete admin_or_owner"
  on public.widget_sites for delete
  using (
    workspace_id in (
      select workspace_id from public.workspace_members
      where profile_id in (
        select id from public.profiles
        where clerk_user_id = current_setting('app.clerk_user_id', true)
      )
      and role in ('owner', 'admin')
    )
  );

-- ── widget_domains policies ──
create policy "widget_domains: read own workspace"
  on public.widget_domains for select
  using (
    widget_site_id in (
      select ws.id from public.widget_sites ws
      where ws.workspace_id in (
        select workspace_id from public.workspace_members
        where profile_id in (
          select id from public.profiles
          where clerk_user_id = current_setting('app.clerk_user_id', true)
        )
      )
    )
  );

create policy "widget_domains: insert member"
  on public.widget_domains for insert
  with check (
    widget_site_id in (
      select ws.id from public.widget_sites ws
      where ws.workspace_id in (
        select workspace_id from public.workspace_members
        where profile_id in (
          select id from public.profiles
          where clerk_user_id = current_setting('app.clerk_user_id', true)
        )
      )
    )
  );

create policy "widget_domains: update member"
  on public.widget_domains for update
  using (
    widget_site_id in (
      select ws.id from public.widget_sites ws
      where ws.workspace_id in (
        select workspace_id from public.workspace_members
        where profile_id in (
          select id from public.profiles
          where clerk_user_id = current_setting('app.clerk_user_id', true)
        )
      )
    )
  );

create policy "widget_domains: delete admin_or_owner"
  on public.widget_domains for delete
  using (
    widget_site_id in (
      select ws.id from public.widget_sites ws
      where ws.workspace_id in (
        select workspace_id from public.workspace_members
        where profile_id in (
          select id from public.profiles
          where clerk_user_id = current_setting('app.clerk_user_id', true)
        )
      )
    )
  );

-- ── Triggers: updated_at ──
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger workspaces_set_updated_at
  before update on public.workspaces
  for each row execute function public.set_updated_at();

create trigger widget_sites_set_updated_at
  before update on public.widget_sites
  for each row execute function public.set_updated_at();

-- ── Auto-create workspace membership on workspace insert ──
create or replace function public.handle_new_workspace_owner()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.workspace_members (workspace_id, profile_id, role)
  values (new.id, new.owner_profile_id, 'owner')
  on conflict (workspace_id, profile_id) do nothing;
  return new;
end;
$$;

create trigger workspace_owner_membership
  after insert on public.workspaces
  for each row execute function public.handle_new_workspace_owner();

commit;
