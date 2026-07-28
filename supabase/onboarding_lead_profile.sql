-- ============================================================
-- Migration: onboarding_lead_profile
-- Date: 2026-07-29
-- Purpose: Capture the lead details a signed-in user submits at
--   /onboarding (phone, website, store, volume) so the dashboard can
--   gate on completion and the team can work the lead.
--
-- Target project: prsusuwxbzaekynonifl (the try-on project).
--   NOT xrycghxaxqzvkmzqzzkx, which is a different product and whose
--   public.profiles table is unrelated to this app.
--
-- Security posture (matches shopify_tryon_foundation):
--   - Server-side state, not browser data.
--   - RLS enabled with no anon/authenticated policies.
--   - Browser roles revoked; service_role granted row operations only.
--   - Identity lives in Clerk. This table stores no password or token.
-- ============================================================

begin;

create table if not exists public.tryon_onboarding_profiles (
  clerk_user_id text primary key,
  email text not null,
  full_name text,
  phone text,
  website text,
  company_name text,
  store_platform text,
  monthly_orders text,
  primary_goal text,
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Lets the team list completed leads newest first without a full scan.
create index if not exists tryon_onboarding_profiles_onboarded_at_idx
  on public.tryon_onboarding_profiles (onboarded_at desc)
  where onboarded_at is not null;

alter table public.tryon_onboarding_profiles enable row level security;

revoke all on table public.tryon_onboarding_profiles from public, anon, authenticated;
grant select, insert, update, delete on table public.tryon_onboarding_profiles to service_role;

commit;

-- Rollback:
-- drop table if exists public.tryon_onboarding_profiles;
