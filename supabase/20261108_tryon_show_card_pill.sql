-- ============================================================
-- Migration: tryon_show_card_pill
-- Date: 2026-11-08
-- Purpose: One on/off switch for the "Try on" pill on product cards
--   (collections, search, the home page), the same for every platform:
--   the Shopify app's catalog embed, the WooCommerce plugin's catalog cards
--   and pasted code. The main switch (show_button) off hides the pills too;
--   that rule lives in the app (cardPillsOn in lib/try-on/settings.ts).
--
-- Target project: prsusuwxbzaekynonifl (the try-on project).
--
-- Additive, nullable, no default: existing rows keep working untouched and
-- NULL means "on", so no backfill is required. The app treats a missing
-- column as "on" too, so it may ship before this runs; turning the pills
-- off is refused with a clear error until it does.
--
-- Security posture unchanged: RLS stays enabled with no anon/authenticated
-- policies, service_role only. No storage or auth objects are touched.
-- ============================================================

begin;

alter table public.tryon_settings add column if not exists show_card_pill boolean;

comment on column public.tryon_settings.show_card_pill is
  'Storefront Try on pill on product cards. false hides the pills on every platform; NULL or true shows them while show_button is on.';

commit;

-- Rollback (the app reads a missing column as "on"):
-- alter table public.tryon_settings drop column if exists show_card_pill;
