-- Per-store feature flags (v16 handoff, 09-backend-contracts.md).
--
-- Every new v16 feature appears only when its flag is on for that store.
-- A store is either a Shopify shop (shop_domain) or a Store Chat site on
-- another website (widget_site_id), never both. Only the platform operator
-- flips a flag, through the dashboard's setStoreFlag action; the app reads
-- this table with the service role and nothing else may.
--
-- Idempotent: safe to run more than once. Apply by hand in the Supabase SQL
-- editor; nothing here runs automatically.

create table if not exists public.store_flags (
  id uuid primary key default extensions.uuid_generate_v4(),
  shop_domain text,
  widget_site_id uuid references public.widget_sites(id) on delete cascade,
  flag text not null,
  enabled boolean not null default false,
  updated_by text,
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.store_flags'::regclass and conname = 'store_flags_one_store_key'
  ) then
    alter table public.store_flags
      add constraint store_flags_one_store_key
      check ((shop_domain is null) <> (widget_site_id is null));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.store_flags'::regclass and conname = 'store_flags_shop_domain_shape'
  ) then
    alter table public.store_flags
      add constraint store_flags_shop_domain_shape
      check (shop_domain is null or shop_domain ~ '^[a-z0-9][a-z0-9-]*\.myshopify\.com$');
  end if;

  -- Flag names are the feature code and a short name, such as n23_after_hours.
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.store_flags'::regclass and conname = 'store_flags_flag_name'
  ) then
    alter table public.store_flags
      add constraint store_flags_flag_name
      check (flag ~ '^n[0-9]+[a-z]?_[a-z0-9_]{1,60}$');
  end if;
end $$;

-- Plain (not partial) unique indexes, so an upsert can name them as its
-- conflict target. NULLs stay distinct, so a site row never collides with a
-- shop row through its empty shop_domain, and the other way round.
create unique index if not exists store_flags_shop_flag
  on public.store_flags (shop_domain, flag);

create unique index if not exists store_flags_site_flag
  on public.store_flags (widget_site_id, flag);

alter table public.store_flags enable row level security;
revoke all on table public.store_flags from public, anon, authenticated;
grant select, insert, update, delete on table public.store_flags to service_role;

comment on table public.store_flags is
  'Per-store v16 feature flags. One row per store and flag; read by the app through isStoreFlagOn, written only through setStoreFlag.';
