-- ============================================================
-- Migration: paste_code_version
-- Date: 2026-11-08
-- Purpose: Remember which version of the pasted Shopify snippet a store
--   runs, so the dashboard can ask stores on older code to copy the new one
--   (version 2 adds signed product cards for the collection pill).
--
-- Requires 20261108_paste_install.sql. Skips itself, without error, when
-- paste_site_connections does not exist yet.
--
-- Additive and nullable: NULL means "not seen yet". Written only by the
-- service role from /api/try-on/paste-context after a Liquid render's
-- signature verified. The version itself is not covered by the signature:
-- it is a hint for the merchant's own dashboard, never an authority.
-- The app reads a missing column as "not seen", so it may ship first.
--
-- Security posture unchanged: the table keeps RLS enabled with no
-- anon/authenticated policies. No storage or auth objects are touched.
-- ============================================================

begin;

do $$
begin
  if to_regclass('public.paste_site_connections') is not null then
    alter table public.paste_site_connections
      add column if not exists code_version smallint,
      add column if not exists code_version_seen_at timestamptz;
    if not exists (select 1 from pg_constraint where conname = 'paste_site_connections_code_version_check'
        and conrelid = 'public.paste_site_connections'::regclass) then
      alter table public.paste_site_connections add constraint paste_site_connections_code_version_check
        check (code_version is null or code_version between 1 and 99);
    end if;
    comment on column public.paste_site_connections.code_version is
      'Snippet version (data-gc-v, 1 when absent) seen in the latest verified signed render; a dashboard hint, not signed.';
  end if;
end
$$;

commit;

-- Rollback (the app reads a missing column as "not seen"):
-- alter table public.paste_site_connections drop constraint if exists paste_site_connections_code_version_check;
-- alter table public.paste_site_connections drop column if exists code_version_seen_at;
-- alter table public.paste_site_connections drop column if exists code_version;
