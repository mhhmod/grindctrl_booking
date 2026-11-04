-- WooCommerce Try-On: one free plan per verified apex domain (parity phase 3).
--
-- Additive and idempotent. Adds one server-only table. It touches no
-- existing table, policy, function or storage bucket, so auth, RLS on other
-- tables and storage are unaffected. Review and apply manually in the
-- Supabase SQL editor; nothing here runs automatically.
--
-- /api/woo/tryon-context claims every apex domain of a site's verified
-- domains here before granting the free Try-On plan. A site whose apex is
-- already claimed by another site is refused, so a second site cannot get a
-- second free plan by verifying the same domain. The row is released with
-- the site (on delete cascade).

begin;

create table if not exists public.woo_free_plan_claims (
  apex_domain text primary key
    check (apex_domain = lower(btrim(apex_domain)) and apex_domain like '%.%'),
  widget_site_id uuid not null
    references public.widget_sites(id) on delete cascade,
  claimed_at timestamptz not null default now()
);

create index if not exists woo_free_plan_claims_widget_site_id
  on public.woo_free_plan_claims (widget_site_id);

alter table public.woo_free_plan_claims enable row level security;

-- Server-only: no browser-role policies, service_role is the only grantee.
revoke all on table public.woo_free_plan_claims from public, anon, authenticated;
grant select, insert, update, delete on table public.woo_free_plan_claims to service_role;

comment on table public.woo_free_plan_claims is
  'Server-only. One row per apex domain that has been granted a free Try-On plan, and the widget site that holds it.';

commit;

-- Rollback notes (loses the one-free-plan-per-apex guard, not any plan):
-- begin;
-- drop table if exists public.woo_free_plan_claims;
-- commit;
