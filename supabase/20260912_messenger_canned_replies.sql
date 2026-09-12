begin;

-- ─────────────────────────────────────────────────────────────
-- Canned/saved replies (plan B8): a flat, site-scoped list of
-- reusable reply text a moderator can insert with one click.
-- Modeled directly on messenger_knowledge (same shape: title,
-- content, status, sort_order, site-scoped, workspace-read RLS,
-- service-role-only writes) — deliberately no folders/categories,
-- per the plan's own "ship the minimum version" instruction.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.messenger_canned_replies (
  id uuid primary key default extensions.uuid_generate_v4(),
  widget_site_id uuid not null references public.widget_sites(id) on delete cascade,
  title text not null,
  content text not null,
  status text not null default 'active',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint messenger_canned_replies_status_check
    check (status in ('active', 'disabled')),
  constraint messenger_canned_replies_title_len_check
    check (char_length(title) between 1 and 100),
  constraint messenger_canned_replies_content_len_check
    check (char_length(content) between 1 and 2000)
);

create index if not exists idx_messenger_canned_replies_site_active_order
  on public.messenger_canned_replies(widget_site_id, status, sort_order);

create trigger messenger_canned_replies_set_updated_at
  before update on public.messenger_canned_replies
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Audit vocabulary. Recreated rather than altered: check
-- constraints have no "add value" form, and the list is the
-- documentation (same convention messenger_support_desk.sql used).
-- ─────────────────────────────────────────────────────────────

alter table public.messenger_audit
  drop constraint if exists messenger_audit_action_check;

alter table public.messenger_audit
  add constraint messenger_audit_action_check check (
    action in (
      'messenger_enabled', 'messenger_disabled',
      'config_published', 'draft_discarded',
      'ai_capability_changed',
      'knowledge_added', 'knowledge_updated', 'knowledge_removed',
      'conversation_taken_over', 'conversation_returned_to_ai',
      'conversation_closed',
      'order_lookup_performed', 'order_lookup_denied',
      'ai_action_rejected', 'ai_action_failed',
      'contact_captured', 'attachment_uploaded',
      'shopify_token_stored', 'shopify_token_removed',
      -- canned replies (plan B8)
      'canned_reply_added', 'canned_reply_updated', 'canned_reply_removed',
      -- internal staff notes (plan B9) -- recordAudit's action string for
      -- addInternalNote, added here too since it landed in the same
      -- session and this constraint has no "add value" form
      'internal_note_added'
    )
  );

-- ─────────────────────────────────────────────────────────────
-- RLS + grants: workspace members read; all writes go through the
-- trusted server client (service_role), matching messenger_knowledge.
-- ─────────────────────────────────────────────────────────────

alter table public.messenger_canned_replies enable row level security;

drop policy if exists "messenger_canned_replies: read own workspace" on public.messenger_canned_replies;
create policy "messenger_canned_replies: read own workspace"
  on public.messenger_canned_replies for select
  using (
    widget_site_id in (
      select ws.id from public.widget_sites ws
      where ws.workspace_id in (
        select wm.workspace_id from public.workspace_members wm
        where wm.profile_id = public.current_profile_id()
      )
    )
  );

revoke all on table public.messenger_canned_replies from public, anon, authenticated;
grant select, insert, update, delete on table public.messenger_canned_replies to service_role;

commit;

-- Rollback (manual; destructive to canned-reply data):
-- begin;
-- drop table if exists public.messenger_canned_replies;
-- alter table public.messenger_audit drop constraint if exists messenger_audit_action_check;
-- alter table public.messenger_audit add constraint messenger_audit_action_check check (
--   action in (
--     'messenger_enabled', 'messenger_disabled', 'config_published', 'draft_discarded',
--     'ai_capability_changed', 'knowledge_added', 'knowledge_updated', 'knowledge_removed',
--     'conversation_taken_over', 'conversation_returned_to_ai', 'conversation_closed',
--     'order_lookup_performed', 'order_lookup_denied', 'ai_action_rejected', 'ai_action_failed',
--     'contact_captured', 'attachment_uploaded', 'shopify_token_stored', 'shopify_token_removed'
--   )
-- );
-- commit;
