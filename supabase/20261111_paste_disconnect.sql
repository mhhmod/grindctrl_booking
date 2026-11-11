-- ============================================================
-- Migration: paste_disconnect
-- Date: 2026-11-11
-- Purpose: A pasted install can be undone by its owner. Before this, a
--   wrong Shopify address, a switch of platform or a stale pending claim was
--   a dead end: enable_paste_install refused any other shop or platform for
--   the site, and nothing could disconnect a paste connection.
--
--   disconnect_paste_install: the connection becomes `disconnected`, its
--   proof bookkeeping is cleared, and its secret moves on a version with no
--   overlap, so the pasted code stops verifying at once. The site's own
--   paste domain rows are tombstoned exactly like the `remove` operation, so
--   Store Chat stops loading there and the hosts are free for their owner.
--   Disputed denial rows (another site proved the host) stay as they are.
--   Plan, credits, looks, apex history and conversations are untouched.
--
--   enable_paste_install: unchanged, except that a DISCONNECTED row (owner
--   disconnect, or displaced by another site's proof) may now be enabled for
--   another platform or shop. A live (pending or active) row still refuses.
--
-- Requires 20261108_paste_install.sql and 20261109_paste_domain_verification.sql.
-- Additive: one new service-only RPC and a new body, same signature, for
-- enable_paste_install. No table, column, constraint, policy, grant to a
-- browser role, storage bucket or auth object is added or changed. No rows
-- change when this runs.
--
-- Auth/RLS/storage: none touched. Both RPCs are SECURITY INVOKER and
-- executable by service_role only; the app calls disconnect only from an
-- owner-only server action that writes an audit row (store_disconnected).
--
-- App order: run this before the app ships. Until it runs the disconnect
-- action answers "not available right now" (missing function), and enabling
-- a different store keeps answering connection_conflict.
-- Executed against PGlite by apps/web-next/lib/paste/paste-install-sql.test.ts.
-- ============================================================

begin;

-- Returns: {code: ok, platform, shop_domain} | {code: not_found}
create or replace function public.disconnect_paste_install(p_site uuid) returns jsonb
language plpgsql security invoker set search_path = public, pg_temp as $$
declare c public.paste_site_connections;
begin
  perform pg_advisory_xact_lock(hashtextextended('paste-domain-lifecycle', 0));
  select * into c from public.paste_site_connections where widget_site_id = p_site for update;
  if not found or c.status = 'disconnected' then return jsonb_build_object('code', 'not_found'); end if;
  update public.paste_site_connections set status = 'disconnected', disconnected_at = now(), disconnected_reason = null,
    shop_proven_at = null, shop_render_at = null, shop_check_outcome = null, shop_checked_at = null, shop_check_started_at = null,
    first_seen_at = null, last_seen_at = null,
    secret_version = secret_version + 1, previous_secret_version = null, previous_valid_until = null
    where widget_site_id = p_site;
  update public.widget_domains set verification_status = 'disabled', verification_method = 'paste_removed', disabled_at = now()
    where widget_site_id = p_site and verification_method in ('paste_trusted', 'paste_dns_txt')
      and verification_status <> 'disabled';
  return jsonb_build_object('code', 'ok', 'platform', c.platform, 'shop_domain', c.shop_domain);
end $$;

-- Same contract as 20261108_paste_install.sql, plus: a disconnected row may
-- change platform or shop. Its status follows the NEW platform (a website is
-- active at once, a shop starts pending), and a changed store starts with no
-- proof bookkeeping and no seen times.
create or replace function public.enable_paste_install(p_site uuid, p_platform text, p_shop_domain text)
returns text language plpgsql security invoker set search_path = public, pg_temp as $$
declare existing public.paste_site_connections; connected_domain text;
begin
  perform pg_advisory_xact_lock(hashtextextended('paste-domain-lifecycle', 0));
  select domain into connected_domain from public.widget_sites where id = p_site for update;
  if not found then return 'connection_conflict'; end if;
  if p_platform not in ('website', 'shopify') or p_platform is null
    or (p_platform = 'website' and p_shop_domain is not null)
    or (p_platform = 'shopify' and (p_shop_domain is null or p_shop_domain !~ '^[a-z0-9][a-z0-9-]*\.myshopify\.com$'))
  then return 'invalid_platform'; end if;
  select * into existing from public.paste_site_connections where widget_site_id = p_site;
  if exists (select 1 from public.woo_site_connections where widget_site_id = p_site)
    or connected_domain like '%.myshopify.com'
    or (existing.widget_site_id is null and exists (select 1 from public.tryon_shops where widget_site_id = p_site))
    or (p_platform = 'shopify' and public.paste_shop_app_installed(p_shop_domain))
    or (existing.widget_site_id is not null and existing.status <> 'disconnected' and
      (existing.platform <> p_platform or existing.shop_domain is distinct from p_shop_domain))
  then return 'connection_conflict'; end if;
  insert into public.paste_site_connections(widget_site_id, platform, shop_domain, status)
    values (p_site, p_platform, p_shop_domain, case when p_platform = 'shopify' then 'pending' else 'active' end)
    on conflict (widget_site_id) do update set
      -- Equal to the old values unless the row was disconnected.
      platform = excluded.platform, shop_domain = excluded.shop_domain,
      status = case when paste_site_connections.status = 'active' then 'active'
        when excluded.platform = 'shopify' then 'pending' else 'active' end,
      shop_proven_at = case when paste_site_connections.status = 'disconnected' then null else paste_site_connections.shop_proven_at end,
      shop_render_at = case when paste_site_connections.status = 'disconnected' then null else paste_site_connections.shop_render_at end,
      shop_check_outcome = case when paste_site_connections.status = 'disconnected' then null else paste_site_connections.shop_check_outcome end,
      shop_checked_at = case when paste_site_connections.status = 'disconnected' then null else paste_site_connections.shop_checked_at end,
      shop_check_started_at = case when paste_site_connections.status = 'disconnected' then null else paste_site_connections.shop_check_started_at end,
      first_seen_at = case when paste_site_connections.platform is distinct from excluded.platform
        or paste_site_connections.shop_domain is distinct from excluded.shop_domain then null else paste_site_connections.first_seen_at end,
      last_seen_at = case when paste_site_connections.platform is distinct from excluded.platform
        or paste_site_connections.shop_domain is distinct from excluded.shop_domain then null else paste_site_connections.last_seen_at end,
      disconnected_at = null, disconnected_reason = null;
  insert into public.tryon_shops(shop_domain, platform, widget_site_id, status, last_seen_at, updated_at)
    values ('site:' || p_site::text, 'wordpress', p_site, 'installed', now(), now())
    on conflict (shop_domain) do update set status = 'installed', uninstalled_at = null, updated_at = now();
  return 'enabled';
end $$;

revoke all on function public.disconnect_paste_install(uuid) from public, anon, authenticated;
revoke all on function public.enable_paste_install(uuid,text,text) from public, anon, authenticated;
grant execute on function public.disconnect_paste_install(uuid), public.enable_paste_install(uuid,text,text) to service_role;

commit;

-- Rollback: re-run enable_paste_install from 20261108_paste_install.sql and
-- drop function public.disconnect_paste_install(uuid). Connections already
-- disconnected stay disconnected (the old enable re-enables them for the
-- same store only); tombstoned domain rows stay tombstoned, as with Remove.
