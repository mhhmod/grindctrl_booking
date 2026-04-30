-- ============================================================
-- Migration: widget_setup_extensions
-- Date: 2026-04-21
-- Purpose: Extend widget_sites with JSONB config columns and add
--   widget_intents and widget_leads tables for the Widget Setup Flow.
-- ============================================================

begin;

-- ── Extend widget_sites with JSONB config columns ──
alter table public.widget_sites
  add column if not exists config_json jsonb not null default '{}',
  add column if not exists branding_json jsonb not null default '{}',
  add column if not exists lead_capture_json jsonb not null default '{}';

-- ── widget_intents: quick action buttons per site ──
create table if not exists public.widget_intents (
  id uuid primary key default extensions.uuid_generate_v4(),
  widget_site_id uuid not null references public.widget_sites(id) on delete cascade,
  label text not null,
  icon text not null default 'chat',
  action_type text not null check (action_type in ('send_message', 'escalate', 'external_link')) default 'send_message',
  message_text text,
  external_url text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- ── widget_leads: captured lead data ──
create table if not exists public.widget_leads (
  id uuid primary key default extensions.uuid_generate_v4(),
  widget_site_id uuid not null references public.widget_sites(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text,
  email text,
  phone text,
  company text,
  source_domain text,
  created_at timestamptz not null default now()
);

-- ── Indexes ──
create index if not exists idx_widget_sites_embed_key on public.widget_sites(embed_key);
create index if not exists idx_widget_sites_workspace on public.widget_sites(workspace_id);
create index if not exists idx_widget_domains_site on public.widget_domains(widget_site_id);
create index if not exists idx_widget_intents_site_order on public.widget_intents(widget_site_id, sort_order);
create index if not exists idx_widget_leads_workspace on public.widget_leads(workspace_id, created_at desc);
create index if not exists idx_widget_leads_site on public.widget_leads(widget_site_id, created_at desc);

-- ── Enable RLS on new tables ──
alter table public.widget_intents enable row level security;
alter table public.widget_leads enable row level security;

-- ── widget_intents policies (same pattern as widget_sites) ──
create policy "widget_intents: read own workspace"
  on public.widget_intents for select
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

create policy "widget_intents: insert member"
  on public.widget_intents for insert
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

create policy "widget_intents: update member"
  on public.widget_intents for update
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

create policy "widget_intents: delete admin_or_owner"
  on public.widget_intents for delete
  using (
    widget_site_id in (
      select ws.id from public.widget_sites ws
      where ws.workspace_id in (
        select workspace_id from public.workspace_members
        where profile_id in (
          select id from public.profiles
          where clerk_user_id = current_setting('app.clerk_user_id', true)
        )
        and role in ('owner', 'admin')
      )
    )
  );

-- ── widget_leads policies ──
-- Public insert: anyone can submit a lead (widget is public)
create policy "widget_leads: public insert"
  on public.widget_leads for insert
  to anon, authenticated
  with check (true);

-- Read: workspace members only
create policy "widget_leads: read own workspace"
  on public.widget_leads for select
  using (
    workspace_id in (
      select workspace_id from public.workspace_members
      where profile_id in (
        select id from public.profiles
        where clerk_user_id = current_setting('app.clerk_user_id', true)
      )
    )
  );

-- Update/delete: admin_or_owner only
create policy "widget_leads: update admin_or_owner"
  on public.widget_leads for update
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

create policy "widget_leads: delete admin_or_owner"
  on public.widget_leads for delete
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

commit;
