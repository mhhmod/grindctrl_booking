-- ============================================================
-- Migration: messenger_support_desk
-- Purpose: completes Store Chat as a support desk —
--   - per-shop encrypted Shopify Admin tokens (order lookup)
--   - shopper image attachments + AI triage records
--   - audit vocabulary for the new actions
--   - private storage bucket for attachments
--
-- Design notes:
--   * Tokens are encrypted at rest (AES-256-GCM, app-side) so a
--     database dump alone does not yield live store credentials.
--     The table is service_role only on top of that.
--   * OAuth `state` is NOT stored here: the callback compares a
--     signed HttpOnly cookie, which is single-use by construction
--     and needs no row to expire.
--   * Attachment retention (90 days) is enforced in application
--     code, opportunistically. No scheduled sweep exists.
--
-- New server environment variables this migration goes with:
--
--   SHOPIFY_TOKEN_ENC_KEY   REQUIRED for order lookup. 32 random bytes,
--                           base64. Generate with:
--                             openssl rand -base64 32
--                           Without it the OAuth callback refuses to store
--                           a token rather than writing one in the clear.
--   SHOPIFY_API_KEY         REQUIRED for order lookup. The app's client_id
--                           from shopify.app.toml. SHOPIFY_API_SECRET is
--                           already set and is reused for the exchange.
--   GROQ_VISION_MODEL       Optional. Overrides the attachment-triage model
--                           without a deploy; defaults to
--                           meta-llama/llama-4-scout-17b-16e-instruct.
--
-- Rotating SHOPIFY_TOKEN_ENC_KEY invalidates every stored token: they
-- decrypt to nothing, getShopToken returns null, and each merchant has to
-- authorize again. There is no re-encryption path, deliberately — a key
-- rotation should force re-consent rather than quietly re-wrap old
-- credentials.
--
-- This file is a manual delta migration, matching house style.
-- ============================================================

begin;

-- ─────────────────────────────────────────────────────────────
-- 1) Per-merchant Shopify Admin API tokens (offline access)
--    One row per shop. Ciphertext/iv/tag are base64; the key
--    lives only in SHOPIFY_TOKEN_ENC_KEY on the server.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.shopify_shop_tokens (
  shop_domain text primary key,
  access_token_ciphertext text not null,
  token_iv text not null,
  token_tag text not null,
  scopes text not null default '',
  installed_at timestamptz not null default now(),
  rotated_at timestamptz not null default now(),
  constraint shopify_shop_tokens_domain_check
    check (shop_domain ~ '^[a-z0-9][a-z0-9-]*\.myshopify\.com$')
);

-- ─────────────────────────────────────────────────────────────
-- 2) Shopper attachments (images only) + triage output
--    message_id links the upload to its transcript bubble so the
--    staff view can render them inline; null while the message is
--    being written. sha256 is stored for dedupe/forensics, not
--    used as a key — the same photo may legitimately be sent twice.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.messenger_attachments (
  id uuid primary key default extensions.uuid_generate_v4(),
  widget_site_id uuid not null references public.widget_sites(id) on delete cascade,
  conversation_id uuid not null references public.widget_conversations(id) on delete cascade,
  message_id uuid references public.widget_messages(id) on delete set null,
  storage_path text not null,
  mime text not null,
  bytes integer not null,
  sha256 text not null,
  triage jsonb,
  created_at timestamptz not null default now(),
  constraint messenger_attachments_mime_check
    check (mime in ('image/jpeg', 'image/png', 'image/webp')),
  constraint messenger_attachments_bytes_check
    check (bytes > 0 and bytes <= 5242880),
  constraint messenger_attachments_triage_object_check
    check (triage is null or jsonb_typeof(triage) = 'object')
);

-- Upload rate limiting and the staff list both read by conversation.
create index if not exists idx_messenger_attachments_conversation_created
  on public.messenger_attachments(conversation_id, created_at desc);

-- The per-site daily triage cap counts by site over a time window.
create index if not exists idx_messenger_attachments_site_created
  on public.messenger_attachments(widget_site_id, created_at desc);

-- ─────────────────────────────────────────────────────────────
-- 3) Audit vocabulary for the new capabilities
--    Recreated rather than altered: check constraints have no
--    "add value" form, and the list is the documentation.
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
      -- support desk
      'order_lookup_performed', 'order_lookup_denied',
      'ai_action_rejected', 'ai_action_failed',
      'contact_captured', 'attachment_uploaded',
      'shopify_token_stored', 'shopify_token_removed'
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 4) RLS + grants. Browser roles get nothing; workspace members
--    read their own attachments through the dashboard's server
--    code, which already runs as service_role after an ownership
--    check, so the read policy exists for parity, not for access.
-- ─────────────────────────────────────────────────────────────

alter table public.shopify_shop_tokens enable row level security;
alter table public.messenger_attachments enable row level security;

-- Deliberately no policy on shopify_shop_tokens: RLS enabled with
-- zero policies means no non-service role can read a token, ever.

drop policy if exists "messenger_attachments: read own workspace" on public.messenger_attachments;
create policy "messenger_attachments: read own workspace"
  on public.messenger_attachments for select
  using (
    widget_site_id in (
      select ws.id from public.widget_sites ws
      where ws.workspace_id in (
        select wm.workspace_id from public.workspace_members wm
        where wm.profile_id = public.current_profile_id()
      )
    )
  );

revoke all on table public.shopify_shop_tokens from public, anon, authenticated;
revoke all on table public.messenger_attachments from public, anon, authenticated;

grant select, insert, update, delete on table public.shopify_shop_tokens to service_role;
grant select, insert, update, delete on table public.messenger_attachments to service_role;

-- ─────────────────────────────────────────────────────────────
-- 5) Private storage bucket for attachments
--    Private means no anonymous read: staff see images through
--    short-lived signed URLs minted server-side after the same
--    ownership check every other staff action performs. No
--    storage.objects policies are added, so only service_role
--    (which bypasses RLS) can read or write these objects.
-- ─────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'messenger-attachments',
  'messenger-attachments',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

commit;

-- Rollback (manual; destructive to attachment + token data):
-- begin;
-- delete from storage.objects where bucket_id = 'messenger-attachments';
-- delete from storage.buckets where id = 'messenger-attachments';
-- drop table if exists public.messenger_attachments;
-- drop table if exists public.shopify_shop_tokens;
-- alter table public.messenger_audit drop constraint if exists messenger_audit_action_check;
-- alter table public.messenger_audit add constraint messenger_audit_action_check check (
--   action in (
--     'messenger_enabled', 'messenger_disabled', 'config_published', 'draft_discarded',
--     'ai_capability_changed', 'knowledge_added', 'knowledge_updated', 'knowledge_removed',
--     'conversation_taken_over', 'conversation_returned_to_ai', 'conversation_closed'
--   )
-- );
-- commit;
