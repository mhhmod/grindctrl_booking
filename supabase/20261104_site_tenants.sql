-- WooCommerce / WordPress site tenants, one-time pairing codes, and plugin
-- connection lifecycle (WooCommerce parity phase 1).
--
-- This migration is additive except for replacing the two tenant-key shape
-- checks. That replacement is safe: every existing tryon_shops row inherits
-- platform = 'shopify', has a null widget_site_id, and already satisfies the
-- existing myshopify-domain check; every existing store_launch row already
-- satisfies its myshopify-domain check. On a re-run, site-keyed rows satisfy
-- the same replacement checks that admitted them originally.
--
-- Idempotent: safe to run more than once. Review and apply manually in the
-- Supabase SQL editor; nothing here runs automatically.

begin;

alter table public.tryon_shops
  add column if not exists platform text not null default 'shopify',
  add column if not exists widget_site_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.tryon_shops'::regclass
      and conname = 'tryon_shops_platform_check'
  ) then
    alter table public.tryon_shops
      add constraint tryon_shops_platform_check
      check (platform in ('shopify', 'woocommerce', 'wordpress'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.tryon_shops'::regclass
      and conname = 'tryon_shops_widget_site_id_fkey'
  ) then
    alter table public.tryon_shops
      add constraint tryon_shops_widget_site_id_fkey
      foreign key (widget_site_id)
      references public.widget_sites(id)
      on delete restrict;
  end if;
end $$;

create unique index if not exists tryon_shops_widget_site_id_unique
  on public.tryon_shops (widget_site_id)
  where widget_site_id is not null;

-- The platform discriminator makes the two reserved tenant namespaces
-- disjoint. Postgres CHECK expressions accept null, so the site branch states
-- its required widget_site_id non-nullability explicitly.
alter table public.tryon_shops
  drop constraint if exists tryon_shops_domain_check;

alter table public.tryon_shops
  add constraint tryon_shops_domain_check
  check (
    (
      platform = 'shopify'
      and shop_domain = lower(btrim(shop_domain))
      and shop_domain ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.myshopify\.com$'
    )
    or
    (
      platform <> 'shopify'
      and widget_site_id is not null
      and shop_domain = 'site:' || widget_site_id::text
    )
  );

alter table public.store_launch
  drop constraint if exists store_launch_shop_domain_shape;

alter table public.store_launch
  add constraint store_launch_shop_domain_shape
  check (
    shop_domain ~ '^[a-z0-9][a-z0-9-]*\.myshopify\.com$'
    or shop_domain ~ '^site:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  );

create table if not exists public.woo_site_connections (
  widget_site_id uuid primary key
    references public.widget_sites(id) on delete cascade,
  platform text not null
    check (platform in ('woocommerce', 'wordpress')),
  status text not null default 'active'
    check (status in ('active', 'disconnected')),
  secret_version integer not null default 1
    check (secret_version > 0),
  home_url text not null,
  last_home_url text,
  plugin_version text not null,
  wp_version text,
  wc_version text,
  timezone text,
  currency text,
  paired_at timestamptz not null default now(),
  last_seen_at timestamptz,
  disconnected_at timestamptz,
  paired_by text
);

-- home_url is the URL the site had when it was paired and never changes on a
-- heartbeat; last_home_url is what the latest heartbeat reported. A copied or
-- staged database reports a different last_home_url, which is how a clone is
-- told apart from the original site until it is paired again.
alter table public.woo_site_connections
  add column if not exists last_home_url text;

create table if not exists public.woo_pairing_codes (
  code_hash text primary key,
  widget_site_id uuid not null
    references public.widget_sites(id) on delete cascade,
  created_by text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz
);

create index if not exists woo_pairing_codes_widget_site_id
  on public.woo_pairing_codes (widget_site_id);

alter table public.woo_site_connections enable row level security;
alter table public.woo_pairing_codes enable row level security;

-- These are server-only tables. No browser-role policies are intentional;
-- service_role bypasses RLS and is the only role granted table access.
revoke all on table public.woo_site_connections
  from public, anon, authenticated;
revoke all on table public.woo_pairing_codes
  from public, anon, authenticated;
grant select, insert, update, delete on table public.woo_site_connections
  to service_role;
grant select, insert, update, delete on table public.woo_pairing_codes
  to service_role;

comment on table public.woo_site_connections is
  'Server-only WooCommerce and WordPress plugin pairing and lifecycle state per widget site.';
comment on table public.woo_pairing_codes is
  'Server-only, single-use hashes of short-lived WooCommerce and WordPress pairing codes.';
comment on table public.store_launch is
  'Launch state per Shopify store or site tenant: setup, preview, live or holdout. No row means live.';

commit;

-- Rollback notes (destructive; remove site-tenant rows first):
-- begin;
-- drop table if exists public.woo_pairing_codes;
-- drop table if exists public.woo_site_connections;
-- delete from public.store_launch where shop_domain like 'site:%';
-- alter table public.store_launch drop constraint if exists store_launch_shop_domain_shape;
-- alter table public.store_launch add constraint store_launch_shop_domain_shape
--   check (shop_domain ~ '^[a-z0-9][a-z0-9-]*\.myshopify\.com$');
-- delete from public.tryon_shops where platform <> 'shopify';
-- alter table public.tryon_shops drop constraint if exists tryon_shops_domain_check;
-- alter table public.tryon_shops add constraint tryon_shops_domain_check check (
--   shop_domain = lower(btrim(shop_domain))
--   and shop_domain ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.myshopify\.com$'
-- );
-- drop index if exists public.tryon_shops_widget_site_id_unique;
-- alter table public.tryon_shops drop constraint if exists tryon_shops_widget_site_id_fkey;
-- alter table public.tryon_shops drop constraint if exists tryon_shops_platform_check;
-- alter table public.tryon_shops drop column if exists widget_site_id;
-- alter table public.tryon_shops drop column if exists platform;
-- commit;
