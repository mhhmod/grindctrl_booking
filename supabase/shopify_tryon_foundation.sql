-- ============================================================
-- Migration: shopify_tryon_foundation
-- Date: 2026-07-14
-- Purpose: Service-only Shopify shop and product configuration
--   foundation for the GrindCTRL virtual try-on integration.
--
-- Prerequisites:
--   - public.workspaces
--   - public.widget_sites (including workspace_id)
--   - public.set_updated_at()
--
-- Security posture:
--   - These tables are server-side integration state, not browser data.
--   - RLS is enabled and no anon/authenticated policies are created.
--   - Browser roles are explicitly revoked; service_role is granted only
--     the row operations required by trusted server routes/webhooks.
--   - Shopify access tokens remain in the Shopify app's session storage;
--     this schema deliberately contains no token or secret column.
--
-- This file is a manual delta migration. Review it against the confirmed
-- production project before applying; this repository does not apply it.
-- ============================================================

begin;

-- CREATE TABLE IF NOT EXISTS does not repair a partial table. Tables created
-- by this migration receive a versioned schema-fingerprint marker only after
-- the declared column type/nullability/identity/generated/default state,
-- constraints, indexes, triggers, RLS flags, policies, owner, and table ACL
-- are in place. A same-named unmarked table or a marked table whose captured
-- catalog definition has drifted fails before this transaction changes it.
do $$
declare
  v_table_name text;
  v_relid regclass;
  v_marker text;
  v_actual_hash text;
begin
  foreach v_table_name in array array['shopify_shops', 'shopify_product_config'] loop
    v_relid := to_regclass(format('public.%I', v_table_name));
    if v_relid is null then
      continue;
    end if;

    v_marker := obj_description(v_relid, 'pg_class');
    if v_marker is null or v_marker !~ '^grindctrl:shopify_tryon_foundation:v1:[0-9a-f]{32}$' then
      raise exception
        'shopify_tryon_foundation preflight failed: public.% exists without the migration-owned v1 marker',
        v_table_name;
    end if;

    select md5(concat_ws(E'\n',
      coalesce((
        select string_agg(format('column:%s:%s:%s:%s:%s:%s:%s',
          a.attnum, a.attname, format_type(a.atttypid, a.atttypmod),
          a.attnotnull, a.attidentity, a.attgenerated,
          coalesce(pg_get_expr(d.adbin, d.adrelid), '')), E'\n' order by a.attnum)
        from pg_attribute a
        left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
        where a.attrelid = v_relid and a.attnum > 0 and not a.attisdropped
      ), ''),
      coalesce((
        select string_agg(format('constraint:%s:%s:%s:%s:%s:%s',
          c.conname, c.contype, c.condeferrable, c.condeferred,
          c.convalidated, pg_get_constraintdef(c.oid, true)), E'\n' order by c.conname)
        from pg_constraint c where c.conrelid = v_relid
      ), ''),
      coalesce((
        select string_agg(format('index:%s:%s:%s:%s:%s:%s',
          ic.relname, i.indisunique, i.indisprimary, i.indisvalid,
          i.indisready, pg_get_indexdef(i.indexrelid)), E'\n' order by ic.relname)
        from pg_index i
        join pg_class ic on ic.oid = i.indexrelid
        where i.indrelid = v_relid
      ), ''),
      coalesce((
        select string_agg(format('trigger:%s:%s:%s:%s:%s:%s',
          t.tgname, t.tgenabled, t.tgtype, t.tgattr::text,
          encode(t.tgargs, 'hex'), pg_get_triggerdef(t.oid, true)), E'\n' order by t.tgname)
        from pg_trigger t where t.tgrelid = v_relid and not t.tgisinternal
      ), ''),
      coalesce((
        select string_agg(format('policy:%s:%s:%s:%s:%s:%s',
          p.polname, p.polcmd, p.polpermissive, p.polroles::text,
          coalesce(pg_get_expr(p.polqual, p.polrelid), ''),
          coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '')), E'\n' order by p.polname)
        from pg_policy p where p.polrelid = v_relid
      ), ''),
      (
        select format('relation:%s:%s:%s:%s', c.relowner::regrole,
          c.relrowsecurity, c.relforcerowsecurity,
          coalesce(array_to_string(c.relacl, ','), ''))
        from pg_class c where c.oid = v_relid
      )
    )) into v_actual_hash;

    if split_part(v_marker, ':', 4) <> v_actual_hash then
      raise exception
        'shopify_tryon_foundation preflight failed: public.% schema fingerprint drifted',
        v_table_name;
    end if;
  end loop;
end $$;

-- A composite key lets child tables prove that widget_site_id belongs to
-- workspace_id, rather than relying on two unrelated foreign keys.
do $$
begin
  if to_regclass('public.idx_widget_sites_id_workspace') is not null
    and not exists (
      select 1
      from pg_index i
      join pg_class ic on ic.oid = i.indexrelid
      join pg_class tc on tc.oid = i.indrelid
      join pg_am am on am.oid = ic.relam
      where i.indexrelid = 'public.idx_widget_sites_id_workspace'::regclass
        and tc.oid = 'public.widget_sites'::regclass
        and am.amname = 'btree'
        and i.indisunique
        and i.indisvalid
        and i.indisready
        and i.indnkeyatts = 2
        and i.indnatts = 2
        and i.indpred is null
        and i.indexprs is null
        and pg_get_indexdef(i.indexrelid, 1, true) = 'id'
        and pg_get_indexdef(i.indexrelid, 2, true) = 'workspace_id'
    ) then
    raise exception
      'shopify_tryon_foundation found an incompatible public.idx_widget_sites_id_workspace index';
  end if;
end $$;

create unique index if not exists idx_widget_sites_id_workspace
  on public.widget_sites (id, workspace_id);

create table if not exists public.shopify_shops (
  id uuid primary key default extensions.uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  widget_site_id uuid not null,
  shop_domain text not null,
  access_scopes text[] not null default '{}'::text[],
  enabled boolean not null default true,
  installed_at timestamptz not null default now(),
  uninstalled_at timestamptz,
  uninstall_reason text,
  last_webhook_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shopify_shops_site_workspace_fkey
    foreign key (widget_site_id, workspace_id)
    references public.widget_sites(id, workspace_id)
    on delete cascade,
  constraint shopify_shops_shop_domain_key unique (shop_domain),
  constraint shopify_shops_shop_domain_normalized_check check (
    shop_domain = lower(btrim(shop_domain))
    and char_length(shop_domain) between 15 and 255
    and shop_domain ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.myshopify\.com$'
  ),
  constraint shopify_shops_uninstall_reason_length_check check (
    uninstall_reason is null or char_length(uninstall_reason) <= 500
  )
);

-- Supports the dashboard/workspace lookup and enforces the exact shop,
-- workspace, and site binding from product configuration rows.
create unique index if not exists idx_shopify_shops_id_workspace_site
  on public.shopify_shops (id, workspace_id, widget_site_id);

create index if not exists idx_shopify_shops_workspace_site
  on public.shopify_shops (workspace_id, widget_site_id);

create index if not exists idx_shopify_shops_active_domain
  on public.shopify_shops (shop_domain)
  where enabled and uninstalled_at is null;

create table if not exists public.shopify_product_config (
  id uuid primary key default extensions.uuid_generate_v4(),
  shop_id uuid not null,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  widget_site_id uuid not null,
  shopify_product_gid text not null,
  product_handle text not null,
  product_title text,
  enabled boolean not null default false,
  garment_image_url text,
  garment_image_alt text,
  settings_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shopify_product_config_shop_binding_fkey
    foreign key (shop_id, workspace_id, widget_site_id)
    references public.shopify_shops(id, workspace_id, widget_site_id)
    on delete cascade,
  constraint shopify_product_config_product_gid_check check (
    shopify_product_gid ~ '^gid://shopify/Product/[0-9]+$'
  ),
  constraint shopify_product_config_handle_normalized_check check (
    product_handle = lower(btrim(product_handle))
    and char_length(product_handle) between 1 and 255
  ),
  constraint shopify_product_config_garment_url_check check (
    garment_image_url is null
    or (
      char_length(garment_image_url) <= 2048
      and garment_image_url ~ '^https://'
    )
  ),
  constraint shopify_product_config_settings_object_check check (
    jsonb_typeof(settings_json) = 'object'
  ),
  constraint shopify_product_config_shop_product_key
    unique (shop_id, shopify_product_gid)
);

create index if not exists idx_shopify_product_config_workspace_site
  on public.shopify_product_config (workspace_id, widget_site_id);

create index if not exists idx_shopify_product_config_shop_handle
  on public.shopify_product_config (shop_id, product_handle);

create index if not exists idx_shopify_product_config_enabled
  on public.shopify_product_config (shop_id, product_handle)
  where enabled;

-- Index names are schema-global. CREATE INDEX IF NOT EXISTS may skip when a
-- same-named index belongs to another table, so prove every migration-owned
-- index has the intended table, method, uniqueness, key order, and predicate
-- before triggers, grants, or the schema fingerprint marker are finalized.
do $$
declare
  v_index record;
  v_index_oid regclass;
begin
  for v_index in
    select * from (values
      ('idx_shopify_shops_id_workspace_site', 'shopify_shops', true, 'id', 'workspace_id', 'widget_site_id', null::text),
      ('idx_shopify_shops_workspace_site', 'shopify_shops', false, 'workspace_id', 'widget_site_id', null::text, null::text),
      ('idx_shopify_shops_active_domain', 'shopify_shops', false, 'shop_domain', null::text, null::text, 'enabled AND uninstalled_at IS NULL'),
      ('idx_shopify_product_config_workspace_site', 'shopify_product_config', false, 'workspace_id', 'widget_site_id', null::text, null::text),
      ('idx_shopify_product_config_shop_handle', 'shopify_product_config', false, 'shop_id', 'product_handle', null::text, null::text),
      ('idx_shopify_product_config_enabled', 'shopify_product_config', false, 'shop_id', 'product_handle', null::text, 'enabled')
    ) as expected(index_name, table_name, is_unique, key_1, key_2, key_3, predicate_sql)
  loop
    v_index_oid := to_regclass(format('public.%I', v_index.index_name));

    if v_index_oid is null or not exists (
      select 1
      from pg_index i
      join pg_class ic on ic.oid = i.indexrelid
      join pg_am am on am.oid = ic.relam
      where i.indexrelid = v_index_oid
        and i.indrelid = to_regclass(format('public.%I', v_index.table_name))
        and am.amname = 'btree'
        and i.indisunique = v_index.is_unique
        and not i.indisprimary
        and not i.indisexclusion
        and i.indisvalid
        and i.indisready
        and i.indnkeyatts = 1
          + case when v_index.key_2 is null then 0 else 1 end
          + case when v_index.key_3 is null then 0 else 1 end
        and i.indnatts = i.indnkeyatts
        and i.indexprs is null
        and not exists (
          select 1 from pg_constraint c where c.conindid = i.indexrelid
        )
        and pg_get_indexdef(i.indexrelid, 1, true) = v_index.key_1
        and (v_index.key_2 is null or pg_get_indexdef(i.indexrelid, 2, true) = v_index.key_2)
        and (v_index.key_3 is null or pg_get_indexdef(i.indexrelid, 3, true) = v_index.key_3)
        and regexp_replace(
          lower(coalesce(pg_get_expr(i.indpred, i.indrelid, true), '')),
          '[[:space:]()]', '', 'g'
        ) = regexp_replace(
          lower(coalesce(v_index.predicate_sql, '')),
          '[[:space:]()]', '', 'g'
        )
    ) then
      raise exception
        'shopify_tryon_foundation found a missing or incompatible public.% index',
        v_index.index_name;
    end if;
  end loop;
end $$;

-- Reuse the repository's existing, non-privileged updated_at trigger helper,
-- but fail clearly if the prerequisite is absent or incompatible.
do $$
begin
  if to_regprocedure('public.set_updated_at()') is null
    or not exists (
      select 1
      from pg_proc p
      where p.oid = to_regprocedure('public.set_updated_at()')
        and p.prorettype = 'pg_catalog.trigger'::regtype
    ) then
    raise exception
      'shopify_tryon_foundation requires public.set_updated_at() returning trigger';
  end if;
end $$;

-- Never replace a same-named trigger silently. On rerun, verify that an
-- existing trigger is the exact owned BEFORE UPDATE FOR EACH ROW trigger.
do $$
begin
  if exists (
    select 1 from pg_trigger t
    where t.tgrelid = 'public.shopify_shops'::regclass
      and t.tgname = 'shopify_shops_set_updated_at'
      and not t.tgisinternal
  ) then
    if not exists (
      select 1 from pg_trigger t
      where t.tgrelid = 'public.shopify_shops'::regclass
        and t.tgname = 'shopify_shops_set_updated_at'
        and not t.tgisinternal
        and t.tgfoid = to_regprocedure('public.set_updated_at()')
        and t.tgtype = 19
        and t.tgenabled = 'O'
    ) then
      raise exception
        'shopify_tryon_foundation found an incompatible shopify_shops_set_updated_at trigger';
    end if;
  else
    create trigger shopify_shops_set_updated_at
      before update on public.shopify_shops
      for each row execute function public.set_updated_at();
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from pg_trigger t
    where t.tgrelid = 'public.shopify_product_config'::regclass
      and t.tgname = 'shopify_product_config_set_updated_at'
      and not t.tgisinternal
  ) then
    if not exists (
      select 1 from pg_trigger t
      where t.tgrelid = 'public.shopify_product_config'::regclass
        and t.tgname = 'shopify_product_config_set_updated_at'
        and not t.tgisinternal
        and t.tgfoid = to_regprocedure('public.set_updated_at()')
        and t.tgtype = 19
        and t.tgenabled = 'O'
    ) then
      raise exception
        'shopify_tryon_foundation found an incompatible shopify_product_config_set_updated_at trigger';
    end if;
  else
    create trigger shopify_product_config_set_updated_at
      before update on public.shopify_product_config
      for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.shopify_shops enable row level security;
alter table public.shopify_product_config enable row level security;

-- No policies are intentional: only trusted server clients using the
-- service_role key may access this integration state.
revoke all on table public.shopify_shops from public, anon, authenticated;
revoke all on table public.shopify_product_config from public, anon, authenticated;

grant select, insert, update, delete on table public.shopify_shops to service_role;
grant select, insert, update, delete on table public.shopify_product_config to service_role;

-- Set the marker last, using the same deterministic catalog fingerprint as
-- the preflight. A failed transaction cannot leave a valid marker behind.
do $$
declare
  v_table_name text;
  v_relid regclass;
  v_actual_hash text;
begin
  foreach v_table_name in array array['shopify_shops', 'shopify_product_config'] loop
    v_relid := to_regclass(format('public.%I', v_table_name));

    select md5(concat_ws(E'\n',
      coalesce((
        select string_agg(format('column:%s:%s:%s:%s:%s:%s:%s',
          a.attnum, a.attname, format_type(a.atttypid, a.atttypmod),
          a.attnotnull, a.attidentity, a.attgenerated,
          coalesce(pg_get_expr(d.adbin, d.adrelid), '')), E'\n' order by a.attnum)
        from pg_attribute a
        left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
        where a.attrelid = v_relid and a.attnum > 0 and not a.attisdropped
      ), ''),
      coalesce((
        select string_agg(format('constraint:%s:%s:%s:%s:%s:%s',
          c.conname, c.contype, c.condeferrable, c.condeferred,
          c.convalidated, pg_get_constraintdef(c.oid, true)), E'\n' order by c.conname)
        from pg_constraint c where c.conrelid = v_relid
      ), ''),
      coalesce((
        select string_agg(format('index:%s:%s:%s:%s:%s:%s',
          ic.relname, i.indisunique, i.indisprimary, i.indisvalid,
          i.indisready, pg_get_indexdef(i.indexrelid)), E'\n' order by ic.relname)
        from pg_index i
        join pg_class ic on ic.oid = i.indexrelid
        where i.indrelid = v_relid
      ), ''),
      coalesce((
        select string_agg(format('trigger:%s:%s:%s:%s:%s:%s',
          t.tgname, t.tgenabled, t.tgtype, t.tgattr::text,
          encode(t.tgargs, 'hex'), pg_get_triggerdef(t.oid, true)), E'\n' order by t.tgname)
        from pg_trigger t where t.tgrelid = v_relid and not t.tgisinternal
      ), ''),
      coalesce((
        select string_agg(format('policy:%s:%s:%s:%s:%s:%s',
          p.polname, p.polcmd, p.polpermissive, p.polroles::text,
          coalesce(pg_get_expr(p.polqual, p.polrelid), ''),
          coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '')), E'\n' order by p.polname)
        from pg_policy p where p.polrelid = v_relid
      ), ''),
      (
        select format('relation:%s:%s:%s:%s', c.relowner::regrole,
          c.relrowsecurity, c.relforcerowsecurity,
          coalesce(array_to_string(c.relacl, ','), ''))
        from pg_class c where c.oid = v_relid
      )
    )) into v_actual_hash;

    execute format(
      'comment on table %s is %L',
      v_relid,
      'grindctrl:shopify_tryon_foundation:v1:' || v_actual_hash
    );
  end loop;
end $$;

commit;

-- Rollback (manual, destructive to Shopify configuration; export rows first):
-- begin;
-- drop table if exists public.shopify_product_config;
-- drop table if exists public.shopify_shops;
-- drop index if exists public.idx_widget_sites_id_workspace;
-- commit;
