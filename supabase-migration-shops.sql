-- Try-on Shopify installation lifecycle registry.
-- Review and apply manually in the Supabase SQL editor.

begin;

create table if not exists public.tryon_shops (
  shop_domain text primary key,
  status text not null default 'installed',
  installed_at timestamptz not null default now(),
  uninstalled_at timestamptz,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tryon_shops_domain_check check (
    shop_domain = lower(btrim(shop_domain))
    and shop_domain ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.myshopify\.com$'
  ),
  constraint tryon_shops_status_check check (
    status in ('installed', 'uninstalled')
  ),
  constraint tryon_shops_uninstalled_state_check check (
    (status = 'installed' and uninstalled_at is null)
    or (status = 'uninstalled' and uninstalled_at is not null)
  )
);

create index if not exists idx_tryon_shops_status_last_seen
  on public.tryon_shops (status, last_seen_at desc);

alter table public.tryon_shops enable row level security;

revoke all on table public.tryon_shops from public, anon, authenticated;
grant select, insert, update on table public.tryon_shops to service_role;

with shop_signals as (
  select
    lower(btrim(shop)) as shop_domain,
    coalesce(updated_at, now()) as seen_at
  from public.tryon_settings
  where shop is not null and lower(btrim(shop)) <> 'default'

  union all

  select
    lower(btrim(shop)) as shop_domain,
    coalesce(created_at, now()) as seen_at
  from public.tryon_jobs
  where shop is not null and lower(btrim(shop)) <> 'default'
), valid_shops as (
  select shop_domain, min(seen_at) as installed_at, max(seen_at) as last_seen_at
  from shop_signals
  where shop_domain ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.myshopify\.com$'
  group by shop_domain
)
insert into public.tryon_shops (
  shop_domain,
  status,
  installed_at,
  last_seen_at,
  created_at,
  updated_at
)
select
  shop_domain,
  'installed',
  installed_at,
  last_seen_at,
  installed_at,
  last_seen_at
from valid_shops
on conflict (shop_domain) do nothing;

commit;

-- Rollback removes only the lifecycle registry:
-- begin;
-- drop table if exists public.tryon_shops;
-- commit;
