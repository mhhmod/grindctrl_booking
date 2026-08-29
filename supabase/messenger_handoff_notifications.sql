-- ============================================================
-- Migration: messenger_handoff_notifications
-- Date: 2026-08-29
-- Purpose: Rollout step 1 of the support-desk spec — bookkeeping so a
--   handoff notification is sent exactly once per conversation even when
--   two requests transition it concurrently.
-- ============================================================

begin;

alter table public.widget_conversations
  add column if not exists handoff_notified_at timestamptz;

-- Partial index: the notifier only ever asks for un-notified conversations.
create index if not exists idx_widget_conversations_awaiting_notify
  on public.widget_conversations(widget_site_id)
  where status = 'handoff_requested' and handoff_notified_at is null;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'messenger_audit_action_check'
      and conrelid = 'public.messenger_audit'::regclass
  ) then
    alter table public.messenger_audit drop constraint messenger_audit_action_check;
  end if;

  alter table public.messenger_audit
    add constraint messenger_audit_action_check check (
      action in (
        'messenger_enabled', 'messenger_disabled',
        'config_published', 'draft_discarded',
        'ai_capability_changed',
        'knowledge_added', 'knowledge_updated', 'knowledge_removed',
        'conversation_taken_over', 'conversation_returned_to_ai',
        'conversation_closed',
        'handoff_notified', 'handoff_notify_failed'
      )
    );
end $$;

commit;

-- Rollback:
-- begin;
-- drop index if exists public.idx_widget_conversations_awaiting_notify;
-- alter table public.widget_conversations drop column if exists handoff_notified_at;
-- commit;
