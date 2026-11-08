-- ============================================================
-- Migration: tryon_show_button
-- Date: 2026-11-08
-- Purpose: One on/off switch for the storefront Try-On button, the same for
--   every platform (Shopify app installs, WooCommerce and pasted code). Until
--   now only the Shopify theme editor could hide it, and pasted-code stores
--   could not hide it at all.
--
-- Target project: prsusuwxbzaekynonifl (the try-on project).
--
-- Additive, nullable, no default: existing rows keep working untouched and
-- NULL means "on", so no backfill is required. The app treats a missing
-- column as "on" too, so it may ship before this runs; turning the button
-- off is refused with a clear error until it does.
--
-- Security posture unchanged: RLS stays enabled with no anon/authenticated
-- policies, service_role only. No storage or auth objects are touched.
-- ============================================================

begin;

alter table public.tryon_settings add column if not exists show_button boolean;

comment on column public.tryon_settings.show_button is
  'Storefront Try-On button switch. false hides it on every platform; NULL or true shows it.';

commit;

-- Rollback (the app reads a missing column as "on"):
-- alter table public.tryon_settings drop column if exists show_button;
