-- ============================================================
-- Migration: widget_production_foundation
-- Date: 2026-04-22
-- Purpose: Backend production foundation for embeddable widget.
--   - Unified settings_json/settings_version
--   - Domain + intent model extensions
--   - Visitors / conversations / messages / events tables
--   - Tighten lead security (remove public insert + revoke unsafe RPC)
--   - Indexes + RLS policies for new tables
-- ============================================================

begin;

-- ─────────────────────────────────────────────────────────────
-- 1) Unified widget site settings
-- ─────────────────────────────────────────────────────────────

alter table public.widget_sites
  add column if not exists settings_json jsonb not null default '{}',
  add column if not exists settings_version integer not null default 1;

-- Backfill settings_json only when empty (non-destructive).
-- Note: We keep legacy config_json/branding_json/lead_capture_json for now.
update public.widget_sites ws
set settings_json = jsonb_build_object(
  'branding', jsonb_build_object(
    'brand_name', coalesce(nullif(ws.branding_json->>'brand_name', ''), ''),
    'assistant_name', 'Support',
    'logo_url', coalesce(nullif(ws.branding_json->>'logo_url', ''), ''),
    'avatar_url', '',
    'launcher_label', coalesce(nullif(ws.config_json->>'launcher_label', ''), 'Support'),
    'launcher_icon', coalesce(nullif(ws.config_json->>'launcher_icon', ''), 'chat'),
    'theme_mode', 'auto',
    'radius_style', 'soft',
    'attribution', jsonb_build_object(
      'mode', 'auto',
      'show_powered_by', true
    )
  ),
  'widget', jsonb_build_object(
    'position', coalesce(nullif(ws.config_json->>'launcher_position', ''), 'bottom-right'),
    'default_open', (
      case
        when lower(coalesce(ws.config_json->>'default_open', '')) in ('true', 'false') then (ws.config_json->>'default_open')::boolean
        else false
      end
    ),
    'show_intents', (
      case
        when lower(coalesce(ws.config_json->>'show_intent_buttons', '')) in ('true', 'false') then (ws.config_json->>'show_intent_buttons')::boolean
        else true
      end
    ),
    'rtl_supported', true,
    'locale', 'auto'
  ),
  'leads', jsonb_build_object(
    'enabled', (
      case
        when lower(coalesce(ws.lead_capture_json->>'enabled', '')) in ('true', 'false') then (ws.lead_capture_json->>'enabled')::boolean
        else false
      end
    ),
    'capture_timing', 'off',
    'fields', coalesce(ws.lead_capture_json->'fields_enabled', '[]'::jsonb),
    'required_fields', '[]'::jsonb,
    'prompt_title', '',
    'prompt_subtitle', coalesce(nullif(ws.lead_capture_json->>'prompt_text', ''), ''),
    'skippable', false,
    'dedupe', jsonb_build_object('mode', 'session'),
    'consent', jsonb_build_object('mode', 'none', 'text', '', 'privacy_url', '')
  ),
  'routing', jsonb_build_object(
    'default_intent_behavior', 'chat',
    'handoff', jsonb_build_object('enabled', false, 'channel', 'email', 'target', ''),
    'availability', jsonb_build_object('enabled', false, 'timezone', 'UTC', 'hours', '[]'::jsonb)
  ),
  'security', jsonb_build_object(
    'allow_localhost', true,
    'allowed_iframe_parents', '[]'::jsonb,
    'rate_limits', jsonb_build_object(
      'bootstrap_per_min', 60,
      'messages_per_min', 20,
      'leads_per_hour', 30
    )
  )
)
where ws.settings_json = '{}'::jsonb;

-- ─────────────────────────────────────────────────────────────
-- 2) Domain model extensions
-- ─────────────────────────────────────────────────────────────

alter table public.widget_domains
  add column if not exists pattern text,
  add column if not exists environment text not null default 'production',
  add column if not exists verification_method text not null default 'dns_txt',
  add column if not exists verification_token text,
  add column if not exists verified_at timestamptz,
  add column if not exists last_checked_at timestamptz,
  add column if not exists disabled_at timestamptz;

-- Backfill pattern + verification token for existing rows.
update public.widget_domains
set pattern = coalesce(nullif(pattern, ''), domain)
where pattern is null or pattern = '';

update public.widget_domains
set verification_token = coalesce(nullif(verification_token, ''), substr(md5(random()::text || clock_timestamp()::text), 1, 24))
where verification_token is null or verification_token = '';

-- Expand verification_status to include 'disabled'.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'widget_domains_verification_status_check'
      and conrelid = 'public.widget_domains'::regclass
  ) then
    alter table public.widget_domains drop constraint widget_domains_verification_status_check;
  end if;

  alter table public.widget_domains
    add constraint widget_domains_verification_status_check
    check (verification_status in ('pending', 'verified', 'failed', 'disabled'));
exception when others then
  -- If constraint already matches desired shape, ignore.
  null;
end $$;

-- Ensure pattern is not null going forward (legacy inserts will be normalized by trigger).
alter table public.widget_domains
  alter column pattern set not null;

-- Normalize legacy writes (dashboard RPCs currently write only `domain`).
create or replace function public.widget_domains_normalize()
returns trigger
language plpgsql
as $$
begin
  if new.pattern is null or new.pattern = '' then
    new.pattern := new.domain;
  end if;

  if new.domain is null or new.domain = '' then
    new.domain := new.pattern;
  end if;

  if new.environment is null or new.environment = '' then
    new.environment := 'production';
  end if;

  if new.verification_method is null or new.verification_method = '' then
    new.verification_method := 'dns_txt';
  end if;

  if new.verification_token is null or new.verification_token = '' then
    new.verification_token := substr(md5(random()::text || clock_timestamp()::text), 1, 24);
  end if;

  return new;
end;
$$;

drop trigger if exists widget_domains_normalize_trigger on public.widget_domains;
create trigger widget_domains_normalize_trigger
  before insert or update on public.widget_domains
  for each row execute function public.widget_domains_normalize();

create index if not exists idx_widget_domains_site_status
  on public.widget_domains(widget_site_id, verification_status);

create index if not exists idx_widget_domains_site_pattern
  on public.widget_domains(widget_site_id, pattern);

-- ─────────────────────────────────────────────────────────────
-- 3) Intent model extensions
-- ─────────────────────────────────────────────────────────────

alter table public.widget_intents
  add column if not exists name text,
  add column if not exists description text,
  add column if not exists enabled boolean not null default true,
  add column if not exists behavior text,
  add column if not exists routing_json jsonb not null default '{}'::jsonb;

-- Map legacy action_type to new behavior where missing.
update public.widget_intents
set behavior = case
  when action_type = 'external_link' then 'open_url'
  when action_type = 'escalate' then 'handoff'
  else 'send_message'
end
where behavior is null or behavior = '';

update public.widget_intents
set name = coalesce(nullif(name, ''), label)
where name is null or name = '';

-- Enforce allowed behaviors.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'widget_intents_behavior_check'
      and conrelid = 'public.widget_intents'::regclass
  ) then
    alter table public.widget_intents drop constraint widget_intents_behavior_check;
  end if;

  alter table public.widget_intents
    add constraint widget_intents_behavior_check
    check (behavior in ('send_message', 'open_url', 'handoff'));
exception when others then
  null;
end $$;

alter table public.widget_intents
  alter column behavior set not null;

create or replace function public.widget_intents_normalize()
returns trigger
language plpgsql
as $$
begin
  if new.name is null or new.name = '' then
    new.name := new.label;
  end if;

  if new.behavior is null or new.behavior = '' then
    new.behavior := case
      when new.action_type = 'external_link' then 'open_url'
      when new.action_type = 'escalate' then 'handoff'
      else 'send_message'
    end;
  end if;

  return new;
end;
$$;

drop trigger if exists widget_intents_normalize_trigger on public.widget_intents;
create trigger widget_intents_normalize_trigger
  before insert or update on public.widget_intents
  for each row execute function public.widget_intents_normalize();

create index if not exists idx_widget_intents_site_enabled_order
  on public.widget_intents(widget_site_id, enabled, sort_order);

-- ─────────────────────────────────────────────────────────────
-- 4) Production conversation system tables
-- ─────────────────────────────────────────────────────────────

create table if not exists public.widget_visitors (
  id uuid primary key default extensions.uuid_generate_v4(),
  widget_site_id uuid not null references public.widget_sites(id) on delete cascade,
  anonymous_id text not null,
  user_email text,
  user_name text,
  metadata jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique(widget_site_id, anonymous_id)
);

create index if not exists idx_widget_visitors_site_last_seen
  on public.widget_visitors(widget_site_id, last_seen_at desc);

create table if not exists public.widget_conversations (
  id uuid primary key default extensions.uuid_generate_v4(),
  widget_site_id uuid not null references public.widget_sites(id) on delete cascade,
  visitor_id uuid not null references public.widget_visitors(id) on delete cascade,
  status text not null default 'open',
  started_at timestamptz not null default now(),
  closed_at timestamptz,
  last_message_at timestamptz,
  last_page_url text,
  last_referrer text,
  metadata jsonb not null default '{}'::jsonb
);

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'widget_conversations_status_check'
      and conrelid = 'public.widget_conversations'::regclass
  ) then
    alter table public.widget_conversations drop constraint widget_conversations_status_check;
  end if;

  alter table public.widget_conversations
    add constraint widget_conversations_status_check
    check (status in ('open', 'closed', 'handoff_requested', 'handoff_active'));
exception when others then
  null;
end $$;

create index if not exists idx_widget_conversations_site_last_message
  on public.widget_conversations(widget_site_id, last_message_at desc);

create index if not exists idx_widget_conversations_visitor_started
  on public.widget_conversations(visitor_id, started_at desc);

create table if not exists public.widget_messages (
  id uuid primary key default extensions.uuid_generate_v4(),
  conversation_id uuid not null references public.widget_conversations(id) on delete cascade,
  role text not null,
  content text not null,
  content_type text not null default 'text',
  intent_id uuid references public.widget_intents(id) on delete set null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'widget_messages_role_check'
      and conrelid = 'public.widget_messages'::regclass
  ) then
    alter table public.widget_messages drop constraint widget_messages_role_check;
  end if;

  alter table public.widget_messages
    add constraint widget_messages_role_check
    check (role in ('user', 'assistant', 'system'));
exception when others then
  null;
end $$;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'widget_messages_content_type_check'
      and conrelid = 'public.widget_messages'::regclass
  ) then
    alter table public.widget_messages drop constraint widget_messages_content_type_check;
  end if;

  alter table public.widget_messages
    add constraint widget_messages_content_type_check
    check (content_type in ('text', 'intent', 'event'));
exception when others then
  null;
end $$;

create index if not exists idx_widget_messages_conversation_created
  on public.widget_messages(conversation_id, created_at asc);

create table if not exists public.widget_events (
  id uuid primary key default extensions.uuid_generate_v4(),
  widget_site_id uuid not null references public.widget_sites(id) on delete cascade,
  conversation_id uuid references public.widget_conversations(id) on delete cascade,
  event_name text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_widget_events_site_created
  on public.widget_events(widget_site_id, created_at desc);

create index if not exists idx_widget_events_conversation_created
  on public.widget_events(conversation_id, created_at desc);

create table if not exists public.widget_domain_audit (
  id uuid primary key default extensions.uuid_generate_v4(),
  widget_site_id uuid not null references public.widget_sites(id) on delete cascade,
  domain_id uuid references public.widget_domains(id) on delete set null,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  action text not null,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'widget_domain_audit_action_check'
      and conrelid = 'public.widget_domain_audit'::regclass
  ) then
    alter table public.widget_domain_audit drop constraint widget_domain_audit_action_check;
  end if;

  alter table public.widget_domain_audit
    add constraint widget_domain_audit_action_check
    check (action in ('domain_added', 'domain_removed', 'domain_verified', 'domain_failed', 'domain_disabled', 'domain_enabled'));
exception when others then
  null;
end $$;

create index if not exists idx_widget_domain_audit_site_created
  on public.widget_domain_audit(widget_site_id, created_at desc);

-- ─────────────────────────────────────────────────────────────
-- 4b) Extend widget_leads to production shape (no public insert)
-- ─────────────────────────────────────────────────────────────

alter table public.widget_leads
  add column if not exists conversation_id uuid references public.widget_conversations(id) on delete set null,
  add column if not exists intent_id uuid references public.widget_intents(id) on delete set null,
  add column if not exists visitor_id uuid references public.widget_visitors(id) on delete set null,
  add column if not exists page_url text,
  add column if not exists referrer text,
  add column if not exists status text not null default 'new',
  add column if not exists status_reason text,
  add column if not exists consent jsonb,
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text,
  add column if not exists utm_term text,
  add column if not exists utm_content text;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'widget_leads_status_check'
      and conrelid = 'public.widget_leads'::regclass
  ) then
    alter table public.widget_leads drop constraint widget_leads_status_check;
  end if;

  alter table public.widget_leads
    add constraint widget_leads_status_check
    check (status in ('new', 'qualified', 'disqualified', 'contacted'));
exception when others then
  null;
end $$;

create index if not exists idx_widget_leads_site_created
  on public.widget_leads(widget_site_id, created_at desc);

create index if not exists idx_widget_leads_conversation
  on public.widget_leads(conversation_id);

-- ─────────────────────────────────────────────────────────────
-- 5) Tighten lead security
-- ─────────────────────────────────────────────────────────────

-- Remove spoofable public insert policy.
drop policy if exists "widget_leads: public insert" on public.widget_leads;

-- Remove spoofable RPC path for anonymous callers.
-- (Keep function for now but revoke browser roles.)
revoke execute on function public.submit_widget_lead(uuid, uuid, text, text, text, text, text) from anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 6) RLS for new tables (dashboard reads only)
-- ─────────────────────────────────────────────────────────────

alter table public.widget_visitors enable row level security;
alter table public.widget_conversations enable row level security;
alter table public.widget_messages enable row level security;
alter table public.widget_events enable row level security;
alter table public.widget_domain_audit enable row level security;

-- Helper: current profile id derived from Clerk user id (for policies).
create or replace function public.current_profile_id()
returns uuid
language sql
stable
as $$
  select p.id
  from public.profiles p
  where p.clerk_user_id = current_setting('app.clerk_user_id', true)
  limit 1;
$$;

-- Visitors: workspace members can read.
drop policy if exists "widget_visitors: read own workspace" on public.widget_visitors;
create policy "widget_visitors: read own workspace"
  on public.widget_visitors for select
  using (
    widget_site_id in (
      select ws.id from public.widget_sites ws
      where ws.workspace_id in (
        select wm.workspace_id from public.workspace_members wm
        where wm.profile_id = public.current_profile_id()
      )
    )
  );

-- Conversations: workspace members can read.
drop policy if exists "widget_conversations: read own workspace" on public.widget_conversations;
create policy "widget_conversations: read own workspace"
  on public.widget_conversations for select
  using (
    widget_site_id in (
      select ws.id from public.widget_sites ws
      where ws.workspace_id in (
        select wm.workspace_id from public.workspace_members wm
        where wm.profile_id = public.current_profile_id()
      )
    )
  );

-- Messages: workspace members can read.
drop policy if exists "widget_messages: read own workspace" on public.widget_messages;
create policy "widget_messages: read own workspace"
  on public.widget_messages for select
  using (
    conversation_id in (
      select wc.id from public.widget_conversations wc
      where wc.widget_site_id in (
        select ws.id from public.widget_sites ws
        where ws.workspace_id in (
          select wm.workspace_id from public.workspace_members wm
          where wm.profile_id = public.current_profile_id()
        )
      )
    )
  );

-- Events: workspace members can read.
drop policy if exists "widget_events: read own workspace" on public.widget_events;
create policy "widget_events: read own workspace"
  on public.widget_events for select
  using (
    widget_site_id in (
      select ws.id from public.widget_sites ws
      where ws.workspace_id in (
        select wm.workspace_id from public.workspace_members wm
        where wm.profile_id = public.current_profile_id()
      )
    )
  );

-- Domain audit: workspace members can read.
drop policy if exists "widget_domain_audit: read own workspace" on public.widget_domain_audit;
create policy "widget_domain_audit: read own workspace"
  on public.widget_domain_audit for select
  using (
    widget_site_id in (
      select ws.id from public.widget_sites ws
      where ws.workspace_id in (
        select wm.workspace_id from public.workspace_members wm
        where wm.profile_id = public.current_profile_id()
      )
    )
  );

commit;
