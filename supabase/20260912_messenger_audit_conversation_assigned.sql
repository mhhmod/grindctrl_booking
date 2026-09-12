begin;

-- Widens messenger_audit_action_check to allow 'conversation_assigned' — the
-- new explicit delegate/reassign action (assigning a conversation to a
-- specific teammate, distinct from the existing self-only takeover).
alter table public.messenger_audit drop constraint if exists messenger_audit_action_check;
alter table public.messenger_audit add constraint messenger_audit_action_check check (
  action in (
    'messenger_enabled', 'messenger_disabled', 'config_published', 'draft_discarded',
    'ai_capability_changed', 'knowledge_added', 'knowledge_updated', 'knowledge_removed',
    'conversation_taken_over', 'conversation_returned_to_ai', 'conversation_closed',
    'order_lookup_performed', 'order_lookup_denied', 'ai_action_rejected', 'ai_action_failed',
    'contact_captured', 'attachment_uploaded', 'shopify_token_stored', 'shopify_token_removed',
    'canned_reply_added', 'canned_reply_updated', 'canned_reply_removed', 'internal_note_added',
    'conversation_assigned'
  )
);

commit;

-- Rollback (manual):
-- begin;
-- alter table public.messenger_audit drop constraint if exists messenger_audit_action_check;
-- alter table public.messenger_audit add constraint messenger_audit_action_check check (
--   action in (
--     'messenger_enabled', 'messenger_disabled', 'config_published', 'draft_discarded',
--     'ai_capability_changed', 'knowledge_added', 'knowledge_updated', 'knowledge_removed',
--     'conversation_taken_over', 'conversation_returned_to_ai', 'conversation_closed',
--     'order_lookup_performed', 'order_lookup_denied', 'ai_action_rejected', 'ai_action_failed',
--     'contact_captured', 'attachment_uploaded', 'shopify_token_stored', 'shopify_token_removed',
--     'canned_reply_added', 'canned_reply_updated', 'canned_reply_removed', 'internal_note_added'
--   )
-- );
-- commit;
