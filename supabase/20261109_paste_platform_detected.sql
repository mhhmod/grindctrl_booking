-- ============================================================
-- Migration: paste_platform_detected
-- Date: 2026-11-09
-- Purpose: Remember which hosted store platform (EasyOrders, Wix, Salla...)
--   serves each trusted paste domain, as fingerprinted by OUR server from
--   the domain's own storefront (lib/paste/platform-detect.ts). A website
--   paste site may then use that platform's official image servers for
--   garment photos (lib/paste/platform-image-hosts.ts). The browser never
--   supplies this value.
--
-- Requires 20261108_paste_install.sql (paste rows in widget_domains).
--
-- Additive and nullable: NULL means "not checked yet" and behaves exactly
-- like 'custom' (no platform image hosts). Written only by the service role
-- (the guard_paste_domain trigger already refuses browser roles on paste
-- rows). The app reads a missing column as 'custom', so it may ship first.
--
-- Security posture unchanged: no RLS policy, grant, storage bucket or auth
-- object is touched. No data is deleted or rewritten.
-- ============================================================

begin;

alter table public.widget_domains
  add column if not exists platform_detected text,
  add column if not exists platform_detected_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'widget_domains_platform_detected_check'
      and conrelid = 'public.widget_domains'::regclass) then
    alter table public.widget_domains add constraint widget_domains_platform_detected_check
      check (platform_detected is null or platform_detected in ('shopify', 'woocommerce', 'easyorders', 'salla', 'zid',
        'wix', 'squarespace', 'webflow', 'youcan', 'custom'));
  end if;
end
$$;

comment on column public.widget_domains.platform_detected is
  'Store platform our server fingerprinted on this trusted paste domain; NULL = not checked (treated as custom).';
comment on column public.widget_domains.platform_detected_at is
  'When platform_detected was last written from a successful storefront fetch.';

commit;

-- Rollback (the app reads a missing column as 'custom'):
-- alter table public.widget_domains drop constraint if exists widget_domains_platform_detected_check;
-- alter table public.widget_domains drop column if exists platform_detected_at;
-- alter table public.widget_domains drop column if exists platform_detected;
