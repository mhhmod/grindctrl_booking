-- ============================================================
-- Migration: 20260909_shopify_privacy_requests
-- Date: 2026-09-09
-- Purpose: Durably record mandatory Shopify privacy webhooks and
--   deduplicate deliveries by X-Shopify-Webhook-Id.
--
-- Runtime contract:
--   * Record before processing; duplicate webhook IDs are no-ops.
--   * SHOPIFY_PRIVACY_PROCESSING_ENABLED defaults off. Disabled
--     requests remain received and require manual handling.
--   * Enabled requests purge/compile immediately; failures are
--     recorded for manual attention, without automatic retries.
--   * Remove messenger-attachments objects through the Storage API
--     before deleting their owning rows and triggering cascades.
--
-- Security: Payloads contain personal data. Access is service-role
-- only. This is a manual additive delta; apply only after review.
-- Rollback: Disable processing first and retain this table until
-- all recorded requests are handled. Reverting application code
-- cannot undo redaction or email delivery. No live SQL is run here.
-- ============================================================

begin;

create table if not exists public.shopify_privacy_requests (
  id uuid primary key default gen_random_uuid(),
  webhook_id text not null unique,
  topic text not null check (topic in ('customers/data_request','customers/redact','shop/redact')),
  shop_domain text not null,
  payload jsonb not null,
  status text not null default 'received' check (status in ('received','completed','failed')),
  attempts integer not null default 0,
  last_error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);
alter table public.shopify_privacy_requests enable row level security;
revoke all on table public.shopify_privacy_requests from public, anon, authenticated;
grant select, insert, update on table public.shopify_privacy_requests to service_role;

commit;
