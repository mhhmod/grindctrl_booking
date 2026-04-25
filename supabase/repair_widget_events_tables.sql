-- ============================================================
-- Migration: repair_widget_events_tables
-- Date: 2026-04-25
-- Purpose: Add missing production widget event/conversation tables
--   required by dashboard_widget_events_* analytics RPCs.
-- ============================================================

begin;

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
  if not exists (
    select 1 from pg_constraint
    where conname = 'widget_conversations_status_check'
      and conrelid = 'public.widget_conversations'::regclass
  ) then
    alter table public.widget_conversations
      add constraint widget_conversations_status_check
      check (status in ('open', 'closed', 'handoff_requested', 'handoff_active'));
  end if;
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
  if not exists (
    select 1 from pg_constraint
    where conname = 'widget_messages_role_check'
      and conrelid = 'public.widget_messages'::regclass
  ) then
    alter table public.widget_messages
      add constraint widget_messages_role_check
      check (role in ('user', 'assistant', 'system'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'widget_messages_content_type_check'
      and conrelid = 'public.widget_messages'::regclass
  ) then
    alter table public.widget_messages
      add constraint widget_messages_content_type_check
      check (content_type in ('text', 'intent', 'event'));
  end if;
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

alter table public.widget_visitors enable row level security;
alter table public.widget_conversations enable row level security;
alter table public.widget_messages enable row level security;
alter table public.widget_events enable row level security;

create or replace function public.current_profile_id()
returns uuid
language sql
stable
set search_path = public
as $$
  select p.id
  from public.profiles p
  where p.clerk_user_id = current_setting('app.clerk_user_id', true)
  limit 1;
$$;

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

commit;
