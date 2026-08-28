-- ============================================================
-- Migration: messenger_foundation
-- Purpose: GRINDCTRL Support Messenger on top of the existing
--   widget_sites foundation (lazy-provisioned per Shopify store).
--   - Draft configuration slot next to published settings_json
--   - Per-site knowledge entries grounding the support AI
--   - Conversation assignment/ownership columns (AI <-> human)
--   - Shopper-visible feedback capture
--   - Indexes, RLS, service-role grants following house style
--
-- Reuses unchanged: profiles/workspaces/workspace_members,
--   widget_sites(.settings_json/.settings_version/.status),
--   widget_visitors/widget_conversations/widget_messages,
--   widget_events (analytics), widget_leads, widget_domains.
-- This file is a manual delta migration. Review it against the
-- confirmed production project before applying; this repository
-- does not apply it.
-- ============================================================

begin;

-- ─────────────────────────────────────────────────────────────
-- 1) Draft configuration slot on widget_sites
--    Published config stays settings_json/settings_version.
--    Merchants edit settings_draft; Publish copies it over
--    atomically and bumps settings_version. Null draft means
--    "no unpublished changes".
-- ─────────────────────────────────────────────────────────────

alter table public.widget_sites
  add column if not exists settings_draft jsonb;

-- ─────────────────────────────────────────────────────────────
-- 2) Conversation ownership / assignment extensions
--    Status values already cover the lifecycle
--    (open -> handoff_requested -> handoff_active -> closed).
--    These columns make ownership explicit instead of inferred
--    from who messaged last, and record why AI handed off.
-- ─────────────────────────────────────────────────────────────

alter table public.widget_conversations
  add column if not exists assigned_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists handoff_reason text,
  add column if not exists handoff_summary text;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'widget_conversations_handoff_reason_check'
      and conrelid = 'public.widget_conversations'::regclass
  ) then
    alter table public.widget_conversations drop constraint widget_conversations_handoff_reason_check;
  end if;

  alter table public.widget_conversations
    add constraint widget_conversations_handoff_reason_check
    check (handoff_reason is null or char_length(handoff_reason) <= 500);
exception when others then
  null;
end $$;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'widget_conversations_handoff_summary_check'
      and conrelid = 'public.widget_conversations'::regclass
  ) then
    alter table public.widget_conversations drop constraint widget_conversations_handoff_summary_check;
  end if;

  alter table public.widget_conversations
    add constraint widget_conversations_handoff_summary_check
    check (handoff_summary is null or char_length(handoff_summary) <= 2000);
exception when others then
  null;
end $$;

create index if not exists idx_widget_conversations_site_status_last
  on public.widget_conversations(widget_site_id, status, last_message_at desc);

create index if not exists idx_widget_conversations_assigned
  on public.widget_conversations(assigned_profile_id)
  where assigned_profile_id is not null;

-- ─────────────────────────────────────────────────────────────
-- 3) Message delivery guarantees
--    client_key: caller-supplied idempotency key (uuid) unique
--    per conversation; retries collapse onto the first insert.
-- ─────────────────────────────────────────────────────────────

alter table public.widget_messages
  add column if not exists client_key uuid;

create unique index if not exists uq_widget_messages_conversation_client_key
  on public.widget_messages(conversation_id, client_key)
  where client_key is not null;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'widget_messages_client_key_check'
      and conrelid = 'public.widget_messages'::regclass
  ) then
    alter table public.widget_messages drop constraint widget_messages_client_key_check;
  end if;

  alter table public.widget_messages
    add constraint widget_messages_client_key_check
    check (client_key is null or client_key::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$');
exception when others then
  null;
end $$;

-- ─────────────────────────────────────────────────────────────
-- 4) Knowledge base for the support AI
--    Merchant-managed store facts. Content is plain text
--    (size-capped in application code before insert); source
--    records where an entry came from so the dashboard can
--    offer re-sync for fetched sources.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.messenger_knowledge (
  id uuid primary key default extensions.uuid_generate_v4(),
  widget_site_id uuid not null references public.widget_sites(id) on delete cascade,
  title text not null,
  content text not null,
  source text not null default 'manual',
  source_url text,
  status text not null default 'active',
  last_synced_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint messenger_knowledge_source_check
    check (source in ('manual', 'url')),
  constraint messenger_knowledge_status_check
    check (status in ('active', 'disabled')),
  constraint messenger_knowledge_title_len_check
    check (char_length(title) between 1 and 200),
  constraint messenger_knowledge_content_len_check
    check (char_length(content) between 1 and 20000),
  constraint messenger_knowledge_url_https_check
    check (source_url is null or source_url ~ '^https://')
);

create index if not exists idx_messenger_knowledge_site_active_order
  on public.messenger_knowledge(widget_site_id, status, sort_order);

create trigger messenger_knowledge_set_updated_at
  before update on public.messenger_knowledge
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 5) Shopper feedback on resolution (lightweight 👍/👎)
--    Stored as widget_events payloads; this table just gives
--    the dashboard a cheap aggregate without scanning events.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.messenger_feedback (
  id uuid primary key default extensions.uuid_generate_v4(),
  widget_site_id uuid not null references public.widget_sites(id) on delete cascade,
  conversation_id uuid not null references public.widget_conversations(id) on delete cascade,
  visitor_id uuid references public.widget_visitors(id) on delete set null,
  rating text not null,
  comment text,
  created_at timestamptz not null default now(),
  constraint messenger_feedback_rating_check check (rating in ('up', 'down')),
  constraint messenger_feedback_comment_len_check
    check (comment is null or char_length(comment) <= 1000),
  constraint messenger_feedback_one_per_conversation
    unique (conversation_id)
);

create index if not exists idx_messenger_feedback_site_created
  on public.messenger_feedback(widget_site_id, created_at desc);

-- ─────────────────────────────────────────────────────────────
-- 6) Audit log for security-relevant messenger administration
--    (enable/disable, publish, AI capability changes, takeover)
-- ─────────────────────────────────────────────────────────────

create table if not exists public.messenger_audit (
  id uuid primary key default extensions.uuid_generate_v4(),
  widget_site_id uuid not null references public.widget_sites(id) on delete cascade,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  actor_clerk_user_id text,
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint messenger_audit_action_check check (
    action in (
      'messenger_enabled', 'messenger_disabled',
      'config_published', 'draft_discarded',
      'ai_capability_changed',
      'knowledge_added', 'knowledge_updated', 'knowledge_removed',
      'conversation_taken_over', 'conversation_returned_to_ai',
      'conversation_closed'
    )
  ),
  constraint messenger_audit_detail_object_check
    check (jsonb_typeof(detail) = 'object')
);

create index if not exists idx_messenger_audit_site_created
  on public.messenger_audit(widget_site_id, created_at desc);

-- ─────────────────────────────────────────────────────────────
-- 7) RLS: workspace members read; browser roles get nothing.
--    All writes go through trusted server clients (service_role),
--    matching the established tryon_* posture.
-- ─────────────────────────────────────────────────────────────

alter table public.messenger_knowledge enable row level security;
alter table public.messenger_feedback enable row level security;
alter table public.messenger_audit enable row level security;

drop policy if exists "messenger_knowledge: read own workspace" on public.messenger_knowledge;
create policy "messenger_knowledge: read own workspace"
  on public.messenger_knowledge for select
  using (
    widget_site_id in (
      select ws.id from public.widget_sites ws
      where ws.workspace_id in (
        select wm.workspace_id from public.workspace_members wm
        where wm.profile_id = public.current_profile_id()
      )
    )
  );

drop policy if exists "messenger_feedback: read own workspace" on public.messenger_feedback;
create policy "messenger_feedback: read own workspace"
  on public.messenger_feedback for select
  using (
    widget_site_id in (
      select ws.id from public.widget_sites ws
      where ws.workspace_id in (
        select wm.workspace_id from public.workspace_members wm
        where wm.profile_id = public.current_profile_id()
      )
    )
  );

drop policy if exists "messenger_audit: read own workspace" on public.messenger_audit;
create policy "messenger_audit: read own workspace"
  on public.messenger_audit for select
  using (
    widget_site_id in (
      select ws.id from public.widget_sites ws
      where ws.workspace_id in (
        select wm.workspace_id from public.workspace_members wm
        where wm.profile_id = public.current_profile_id()
      )
    )
  );

-- Assignment column joins profiles; ensure members can see assignee names.
drop policy if exists "profiles: read workspace members" on public.profiles;
create policy "profiles: read workspace members"
  on public.profiles for select
  using (
    id in (
      select wm.profile_id from public.workspace_members wm
      where wm.workspace_id in (
        select wm2.workspace_id from public.workspace_members wm2
        join public.profiles p2 on p2.id = wm2.profile_id
        where p2.clerk_user_id = current_setting('app.clerk_user_id', true)
      )
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 8) Service-role grants (browser roles explicitly revoked)
-- ─────────────────────────────────────────────────────────────

revoke all on table public.messenger_knowledge from public, anon, authenticated;
revoke all on table public.messenger_feedback from public, anon, authenticated;
revoke all on table public.messenger_audit from public, anon, authenticated;

grant select, insert, update, delete on table public.messenger_knowledge to service_role;
grant select, insert on table public.messenger_feedback to service_role;
grant select, insert on table public.messenger_audit to service_role;

commit;

-- Rollback (manual; destructive to messenger data):
-- begin;
-- drop table if exists public.messenger_audit;
-- drop table if exists public.messenger_feedback;
-- drop table if exists public.messenger_knowledge;
-- alter table public.widget_messages drop column if exists client_key;
-- alter table public.widget_conversations
--   drop column if exists assigned_profile_id,
--   drop column if exists handoff_reason,
--   drop column if exists handoff_summary;
-- alter table public.widget_sites drop column if exists settings_draft;
-- commit;
