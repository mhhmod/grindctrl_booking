-- ============================================================
-- Migration: 20260910_tryon_shop_links
-- Date: 2026-09-10
-- Purpose: Add short-lived, one-shot codes that let a signed-in
--   dashboard owner link the verified Shopify shop in the embedded app.
--
-- Security:
--   * Runtime access is service-role only.
--   * RLS is enabled with no browser-role policies.
--   * consumed_shop_domain is audit-only data.
--
-- This is a manual additive delta. Review before applying; no live SQL
-- is run from this repository.
-- ============================================================

begin;

create table if not exists public.tryon_shop_links (
  code text primary key,
  clerk_user_id text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  consumed_shop_domain text
);

alter table public.tryon_shop_links enable row level security;
revoke all on table public.tryon_shop_links from public, anon, authenticated;
grant select, insert, update, delete on table public.tryon_shop_links to service_role;

commit;

-- Rollback (manual):
-- begin;
-- drop table if exists public.tryon_shop_links;
-- commit;
