-- G16. Manual additive delta after the messenger audit migration.
-- No data is removed and no function changes. Audit rows for team, key, domain and
-- manual plan/credit actions are written by the server (lib/messenger/conversations.ts
-- recordAudit) with the signed-in Clerk user as the actor.
begin;
alter table public.messenger_audit alter column widget_site_id drop not null;
-- A shop can have a team/plan before it has a Store Chat site. Its shop/workspace
-- is retained in detail when widget_site_id is null; existing RLS stays enabled.
alter table public.messenger_audit drop constraint if exists messenger_audit_action_check;
alter table public.messenger_audit add constraint messenger_audit_action_check check (
  action in ('messenger_enabled','messenger_disabled','config_published','draft_discarded',
  'ai_capability_changed','knowledge_added','knowledge_updated','knowledge_removed',
  'conversation_taken_over','conversation_returned_to_ai','conversation_closed',
  'order_lookup_performed','order_lookup_denied','ai_action_rejected','ai_action_failed',
  'contact_captured','attachment_uploaded','shopify_token_stored','shopify_token_removed',
  'canned_reply_added','canned_reply_updated','canned_reply_removed','internal_note_added',
  'conversation_assigned','config_reverted','store_disconnected','member_role_changed',
  'member_removed','embed_key_regenerated','site_key_regenerated','trusted_domain_added',
  'trusted_domain_removed','manual_credit_grant','manual_plan_changed')
);
commit;
