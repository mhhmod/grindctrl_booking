-- ============================================================
-- Migration: tryon_settings_arabic_labels
-- Date: 2026-07-30
-- Purpose: Let a merchant write their own widget strings in Arabic as well
--   as English. The widget UI was already bilingual, but the three strings
--   the merchant authors were single values, so an Arabic shopper saw an
--   Arabic widget wrapped around an English button label.
--
-- Target project: prsusuwxbzaekynonifl (the try-on project).
--
-- Additive and nullable: existing rows keep working untouched, and NULL or
-- blank means "not translated", which the app falls back from rather than
-- rendering an empty control. No backfill required.
--
-- Security posture unchanged: RLS stays enabled with no anon/authenticated
-- policies, service_role only.
-- ============================================================

begin;

alter table public.tryon_settings add column if not exists button_label_ar text;
alter table public.tryon_settings add column if not exists catalog_label_ar text;
alter table public.tryon_settings add column if not exists disclaimer_text_ar text;

commit;

-- Rollback:
-- alter table public.tryon_settings
--   drop column if exists button_label_ar,
--   drop column if exists catalog_label_ar,
--   drop column if exists disclaimer_text_ar;
