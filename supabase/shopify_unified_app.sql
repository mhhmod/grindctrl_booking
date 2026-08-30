-- ============================================================
-- Migration: shopify_unified_app
-- Purpose: one Store Chat configuration per Shopify store.
--
-- widget_sites had unique indexes on id and embed_key only, and
-- ensureMessengerSite matched a domain only inside the caller's own
-- workspace. A second account touching the same store therefore
-- created a SECOND config with a second embed key — one live on the
-- storefront, one being edited, with nothing to tell them apart.
-- No amount of account-linking fixes that; linking only postpones it
-- until a second person links.
--
-- This index is what makes "the same settings in Shopify and on
-- grindctrl.cloud" a property of the data rather than an agreement
-- between two code paths to be careful.
--
-- Partial on purpose: domain IS NULL is the real "no store connected
-- yet" state, and several rows may legitimately share it.
--
-- Pre-flight (must return zero rows before applying):
--   select lower(domain), count(*) from public.widget_sites
--   where domain is not null group by 1 having count(*) > 1;
--
-- This file is a manual delta migration, matching house style.
-- ============================================================

begin;

create unique index if not exists uq_widget_sites_domain
  on public.widget_sites (lower(domain))
  where domain is not null;

-- The index keys on lower(domain), but every lookup compares the column
-- directly (.eq('domain', …) through PostgREST — expressions are not
-- addressable there). A non-canonical row would therefore be invisible to
-- the lookup AND rejected by the index, surfacing as a raw duplicate-key
-- error instead of an adoption.
--
-- btrim as well as lower, deliberately: lower() does not trim, so a plain
-- lower-case check would still admit ' demo.myshopify.com', which hashes to
-- a DIFFERENT index key than the trimmed form — so it does not collide, and
-- every reader (which normalises with .trim().toLowerCase()) can never find
-- it again. That row is a second configuration for one storefront, which is
-- the exact failure this migration exists to make impossible.
alter table public.widget_sites
  add constraint widget_sites_domain_canonical_check
  check (domain is null or domain = btrim(lower(domain)));

commit;

-- Rollback:
-- alter table public.widget_sites
--   drop constraint if exists widget_sites_domain_canonical_check;
-- drop index if exists public.uq_widget_sites_domain;
