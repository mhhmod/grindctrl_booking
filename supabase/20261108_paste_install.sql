-- D1a. MANUAL, NOT APPLIED. Requires 20261104_site_tenants.sql,
-- 20261105_woo_dashboard_plans.sql and the existing credit ledger functions.
-- No secret plaintext, new storage bucket, policy or browser grant.
-- SECURITY INVOKER RPCs are service-role-only; all writes are atomic.
-- Existing rows retain their meaning; trusted/disputed are additive states.
-- Shopify paste connections stay pending until a signed render proves the
-- shop; an active Shopify app install on the shop always takes precedence.
-- Executed against PGlite by apps/web-next/lib/paste/paste-install-sql.test.ts.
begin;

alter table public.widget_domains
  add column if not exists first_seen_at timestamptz,
  add column if not exists last_seen_at timestamptz;
alter table public.widget_domains drop constraint if exists widget_domains_verification_status_check;
alter table public.widget_domains add constraint widget_domains_verification_status_check
  check (verification_status in ('pending', 'verified', 'failed', 'disabled', 'trusted', 'disputed'));

create table if not exists public.paste_site_connections (
  widget_site_id uuid primary key references public.widget_sites(id) on delete cascade,
  platform text not null check (platform in ('website', 'shopify')),
  shop_domain text,
  status text not null default 'active',
  secret_version integer not null default 1 check (secret_version > 0),
  previous_secret_version integer,
  previous_valid_until timestamptz,
  created_at timestamptz not null default now(),
  check ((platform = 'website' and shop_domain is null) or
    (platform = 'shopify' and shop_domain ~ '^[a-z0-9][a-z0-9-]*\.myshopify\.com$'))
);
-- The signed shop host is trusted through this row, never a widget_domains
-- row (paste_domain_operation refuses .myshopify.com), so its install
-- signals live here.
alter table public.paste_site_connections
  add column if not exists first_seen_at timestamptz,
  add column if not exists last_seen_at timestamptz,
  add column if not exists shop_proven_at timestamptz,
  add column if not exists disconnected_at timestamptz,
  add column if not exists disconnected_reason text;
-- Typing a shop name proves nothing. A Shopify connection starts pending
-- (any number of sites may be pending for one shop) and becomes active only
-- through prove_paste_shop, after a signed Liquid render from that shop's
-- theme. One active, proven holder per shop. Websites are active at once:
-- their trust is per domain row.
alter table public.paste_site_connections drop constraint if exists paste_site_connections_status_check;
alter table public.paste_site_connections add constraint paste_site_connections_status_check
  check (status in ('pending', 'active', 'disconnected'));
alter table public.paste_site_connections drop constraint if exists paste_site_connections_proof_check;
alter table public.paste_site_connections add constraint paste_site_connections_proof_check
  check ((platform = 'website' and status <> 'pending')
    or (platform = 'shopify' and (status <> 'active' or shop_proven_at is not null)));
alter table public.paste_site_connections drop constraint if exists paste_site_connections_reason_check;
alter table public.paste_site_connections add constraint paste_site_connections_reason_check
  check (disconnected_reason is null or (status = 'disconnected' and disconnected_reason in ('displaced')));
create unique index if not exists paste_site_connections_active_shop_unique
  on public.paste_site_connections (shop_domain) where status = 'active' and shop_domain is not null;
alter table public.paste_site_connections enable row level security;
revoke all on public.paste_site_connections from public, anon, authenticated;
grant select, insert, update, delete on public.paste_site_connections to service_role;

-- Trigger guards must see claims across RLS tenants, including when an old
-- browser-role RPC writes a legacy table. Definer code stays OUTSIDE the
-- exposed public schema; ordinary service-only RPCs below remain invokers.
create schema if not exists grindctrl_paste_private;
revoke all on schema grindctrl_paste_private from public, anon, authenticated;
grant usage on schema grindctrl_paste_private to service_role;

-- Keep the once-per-apex rule even if a site is later deleted (the old
-- registry FK cascades). This non-cascading history never grants credits.
create table if not exists public.tryon_free_apex_history (
  apex text primary key,
  first_widget_site_id uuid not null,
  claimed_at timestamptz not null default now()
);
alter table public.tryon_free_apex_history enable row level security;
revoke all on public.tryon_free_apex_history from public, anon, authenticated;
grant select, insert on public.tryon_free_apex_history to service_role;
insert into public.tryon_free_apex_history(apex, first_widget_site_id, claimed_at)
  select apex, widget_site_id, created_at from public.tryon_free_plan_apexes on conflict(apex) do nothing;

create or replace function grindctrl_paste_private.guard_free_apex() returns trigger
language plpgsql security definer set search_path = pg_catalog, pg_temp as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('tryon-free-apex:' || new.apex, 0));
  insert into public.tryon_free_apex_history(apex, first_widget_site_id)
    values(new.apex, new.widget_site_id) on conflict(apex) do nothing;
  if exists(select 1 from public.tryon_free_apex_history
    where apex = new.apex and first_widget_site_id <> new.widget_site_id) then
    raise exception 'apex already used' using errcode = '23505'; end if;
  return new;
end $$;
drop trigger if exists guard_paste_free_apex on public.tryon_free_plan_apexes;
create trigger guard_paste_free_apex before insert or update on public.tryon_free_plan_apexes
  for each row execute function grindctrl_paste_private.guard_free_apex();

-- The Shopify app always wins a shop. Read at every decision rather than
-- mirrored by an uninstall/install webhook that could be missed.
create or replace function public.paste_shop_app_installed(p_shop text) returns boolean
language sql stable security invoker set search_path = public, pg_temp as $$
  select exists(select 1 from public.shopify_installations where shop_domain = p_shop and status = 'active');
$$;

-- Serializes all paste domain operations, including cross-site disputes.
-- Legacy rows are also checked; a paste install never silently adopts a
-- Shopify app or Woo tenant, nor changes widget_sites.domain.
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
  -- Another site's claim on the same shop does not block this one: each
  -- stays pending until a signed render from the shop's theme proves one.
  if exists (select 1 from public.woo_site_connections where widget_site_id = p_site)
    or connected_domain like '%.myshopify.com'
    or (existing.widget_site_id is null and exists (select 1 from public.tryon_shops where widget_site_id = p_site))
    or (p_platform = 'shopify' and public.paste_shop_app_installed(p_shop_domain))
    or (existing.widget_site_id is not null and
      (existing.platform <> p_platform or existing.shop_domain is distinct from p_shop_domain))
  then return 'connection_conflict'; end if;
  insert into public.paste_site_connections(widget_site_id, platform, shop_domain, status)
    values (p_site, p_platform, p_shop_domain, case when p_platform = 'shopify' then 'pending' else 'active' end)
    on conflict (widget_site_id) do update set
      status = case when paste_site_connections.status = 'active' then 'active'
        when paste_site_connections.platform = 'shopify' then 'pending' else 'active' end,
      disconnected_at = null, disconnected_reason = null;
  -- Reuse the existing non-Shopify site tenant model; install kind is held
  -- in paste_site_connections, never masquerades as Shopify Admin access.
  insert into public.tryon_shops(shop_domain, platform, widget_site_id, status, last_seen_at, updated_at)
    values ('site:' || p_site::text, 'wordpress', p_site, 'installed', now(), now())
    on conflict (shop_domain) do update set status = 'installed', uninstalled_at = null, updated_at = now();
  return 'enabled';
end $$;

-- Canonical ASCII hosts arrive from URL/punycode normalization in the
-- server. www is an alias, not a wildcard for arbitrary subdomains.
create or replace function public.paste_host(p_host text) returns text
language sql immutable security invoker set search_path = public, pg_temp as $$
  select regexp_replace(lower(rtrim(btrim(p_host), '.')), '^www\.', '');
$$;
create or replace function public.paste_host_matches(p_pattern text, p_host text) returns boolean
language sql immutable security invoker set search_path = public, pg_temp as $$
  select public.paste_host(p_pattern) = p_host or
    (left(p_pattern, 2) = '*.' and
      (p_host like '%.' || substr(p_pattern, 3) or ('www.' || p_host) like '%.' || substr(p_pattern, 3)));
$$;

create unique index if not exists paste_domain_trusted_host_unique
  on public.widget_domains (public.paste_host(domain)) where verification_status = 'trusted';

create or replace function public.paste_domain_operation(
  p_site uuid, p_operation text, p_domain text, p_domain_id uuid, p_token text
) returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare d public.widget_domains; host text; taken boolean; other_site uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('paste-domain-lifecycle', 0));
  -- A pending Shopify merchant may add the storefront's own domain while
  -- waiting for the first signed render; a shop the app holds may not.
  if not exists(select 1 from public.paste_site_connections where widget_site_id = p_site
      and status in ('active', 'pending')
      and (platform = 'website' or not public.paste_shop_app_installed(shop_domain)))
    then return jsonb_build_object('code', 'connection_conflict'); end if;
  if p_operation = 'add' then
    host := public.paste_host(p_domain);
    if host is null or host !~ '^([a-z0-9][a-z0-9-]*\.)+[a-z][a-z0-9-]+$'
      or host like '%.myshopify.com' or host = 'grindctrl.cloud' or host like '%.grindctrl.cloud'
      or p_token !~ '^[A-Za-z0-9_-]{24}$' then return jsonb_build_object('code', 'not_found'); end if;
    select * into d from public.widget_domains where widget_site_id = p_site
      and public.paste_host(domain) = host and verification_method like 'paste_%'
      order by created_at limit 1;
    if found and d.verification_status <> 'disabled' then
      return jsonb_build_object('code', 'ok', 'domain', to_jsonb(d)); end if;
    if (select count(distinct public.paste_host(domain)) from public.widget_domains
      where widget_site_id = p_site and verification_status <> 'disabled'
        and public.paste_host(domain) <> host) >= 5 then
      return jsonb_build_object('code', 'limit_reached'); end if;
    taken := exists(select 1 from public.widget_domains where widget_site_id <> p_site
      and verification_status in ('verified', 'trusted') and public.paste_host_matches(pattern, host))
      or exists(select 1 from public.widget_sites where id <> p_site and public.paste_host(domain) = host);
    if d.id is null then
      insert into public.widget_domains(widget_site_id, domain, pattern, environment,
        verification_status, verification_method, verification_token)
      values(p_site, host, host, 'production', case when taken then 'pending' else 'trusted' end,
        case when taken then 'paste_dns_txt' else 'paste_trusted' end, p_token) returning * into d;
    else
      update public.widget_domains set verification_status = case when taken then 'pending' else 'trusted' end,
        verification_method = case when taken then 'paste_dns_txt' else 'paste_trusted' end,
        verification_token = p_token, first_seen_at = null, last_seen_at = null, disabled_at = null
        where id = d.id returning * into d;
    end if;
  else
    select * into d from public.widget_domains where id = p_domain_id and widget_site_id = p_site
      and verification_method in ('paste_trusted', 'paste_dns_txt', 'paste_disputed') for update;
    if not found then return jsonb_build_object('code', 'not_found'); end if;
    host := public.paste_host(d.domain);
    if p_operation = 'remove' then
      -- Keep a tombstone: removing a trusted host must also revoke an old
      -- implicit widget_sites.domain allowance, including www.
      update public.widget_domains set verification_status = 'disabled', verification_method = 'paste_removed',
        disabled_at = now() where widget_site_id = p_site and public.paste_host(domain) = host;
      return jsonb_build_object('code', 'ok');
    elsif p_operation = 'prove' then
      if d.verification_token is distinct from p_token or d.verification_status = 'disabled'
        then return jsonb_build_object('code', 'proof_failed'); end if;
      -- DNS TXT / pinned root meta proof transfers the hostname, never the other site's
      -- settings, billing, history or tenant. Displaced implicit/wildcard
      -- allowances receive an exact-host denial row.
      for other_site in
        select distinct widget_site_id from public.widget_domains where widget_site_id <> p_site
          and verification_status in ('verified', 'trusted') and public.paste_host_matches(pattern, host)
        union select id from public.widget_sites where id <> p_site and public.paste_host(domain) = host
      loop
        update public.widget_domains set verification_status = 'disputed', verification_method = 'paste_disputed'
          where widget_site_id = other_site and public.paste_host(domain) = host;
        if not found then
          insert into public.widget_domains(widget_site_id, domain, pattern, verification_status, verification_method, verification_token)
            values(other_site, host, host, 'disputed', 'paste_disputed', replace(gen_random_uuid()::text, '-', ''));
        end if;
      end loop;
      -- Keep one canonical trusted row; shadows must not keep an old
      -- explicit or implicit grant alive, or count against the domain cap.
      update public.widget_domains set verification_status = 'disabled', verification_method = 'paste_shadow', disabled_at = now()
        where widget_site_id = p_site and public.paste_host(domain) = host and id <> p_domain_id;
      update public.widget_domains set verification_status = 'trusted', verification_method = 'paste_trusted',
        verified_at = now(), last_checked_at = now(), disabled_at = null
        where id = p_domain_id and widget_site_id = p_site;
      select wd.* into d from public.widget_domains wd where wd.id = p_domain_id;
    else return jsonb_build_object('code', 'not_found'); end if;
  end if;
  if p_operation = 'add' then
    update public.widget_domains set verification_status = 'disabled', verification_method = 'paste_shadow', disabled_at = now()
      where widget_site_id = p_site and public.paste_host(domain) = host and id <> d.id;
  end if;
  return jsonb_build_object('code', 'ok', 'domain', to_jsonb(d));
end $$;

-- Guard legacy writers as well as these RPCs. A later Shopify sync / old
-- DNS verification cannot silently override a proven dispute or claim a
-- paste host. Browser roles cannot forge/delete paste trust or tombstones.
create or replace function grindctrl_paste_private.guard_domain() returns trigger
language plpgsql security definer set search_path = pg_catalog, pg_temp as $$
begin
  if (tg_op <> 'INSERT' and old.verification_method like 'paste_%') or
    (tg_op <> 'DELETE' and (new.verification_method like 'paste_%' or new.verification_status in ('trusted', 'disputed'))) then
    if coalesce(current_setting('role', true), '') <> 'service_role' and session_user not in ('postgres', 'supabase_admin') then
      raise exception 'paste trust requires service role' using errcode = '42501'; end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  if new.verification_status in ('verified', 'trusted') then
    perform pg_advisory_xact_lock(hashtextextended('paste-domain-lifecycle', 0));
    if exists(select 1 from public.widget_domains where widget_site_id <> new.widget_site_id
      and verification_status = 'trusted' and public.paste_host_matches(new.pattern, public.paste_host(domain))) then
      raise exception 'domain already claimed' using errcode = '23505'; end if;
    if tg_op = 'UPDATE' and old.verification_method in ('paste_disputed', 'paste_removed')
      and new.verification_method not like 'paste_%' then
      new.verification_status := old.verification_status;
      new.verification_method := old.verification_method;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists guard_paste_domain on public.widget_domains;
create trigger guard_paste_domain before insert or update or delete on public.widget_domains
  for each row execute function grindctrl_paste_private.guard_domain();

-- widget_sites.domain is an implicit legacy chat grant. Protect it as well
-- so a second workspace cannot bypass a paste claim through that old path.
create or replace function grindctrl_paste_private.guard_site_domain() returns trigger
language plpgsql security definer set search_path = pg_catalog, pg_temp as $$
begin
  if new.domain is null then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended('paste-domain-lifecycle', 0));
  if exists(select 1 from public.widget_domains where widget_site_id <> new.id
    and verification_status = 'trusted' and public.paste_host(domain) = public.paste_host(new.domain)) then
    raise exception 'domain already claimed' using errcode = '23505'; end if;
  return new;
end $$;
drop trigger if exists guard_paste_site_domain on public.widget_sites;
create trigger guard_paste_site_domain before insert or update of domain on public.widget_sites
  for each row execute function grindctrl_paste_private.guard_site_domain();

create or replace function public.rotate_paste_secret(p_site uuid) returns jsonb
language plpgsql security invoker set search_path = public, pg_temp as $$
declare c public.paste_site_connections;
begin
  update public.paste_site_connections set previous_secret_version = secret_version,
    previous_valid_until = now() + interval '15 minutes', secret_version = secret_version + 1
    where widget_site_id = p_site and status in ('active', 'pending') returning * into c;
  if not found then return null; end if;
  return jsonb_build_object('version', c.secret_version, 'overlapUntil', c.previous_valid_until);
end $$;

-- Called only after the server verified a Liquid render's HMAC with THIS
-- site's own derived secret and the render named this exact shop: the
-- shop's theme carries this site's code. The proven site becomes the
-- shop's one active holder; every other pending/active paste connection
-- for the shop is disconnected as displaced (its owner can re-enable, and
-- its own next signed render would prove it again). Never grants a plan.
-- Returns: proven | shopify_app_installed | not_pending
create or replace function public.prove_paste_shop(p_site uuid, p_shop text) returns text
language plpgsql security invoker set search_path = public, pg_temp as $$
declare c public.paste_site_connections;
begin
  perform pg_advisory_xact_lock(hashtextextended('paste-domain-lifecycle', 0));
  select * into c from public.paste_site_connections where widget_site_id = p_site for update;
  if not found or c.platform <> 'shopify' or c.shop_domain is distinct from p_shop or c.status = 'disconnected'
    then return 'not_pending'; end if;
  if public.paste_shop_app_installed(c.shop_domain) then return 'shopify_app_installed'; end if;
  if c.status = 'active' then return 'proven'; end if;
  update public.paste_site_connections set status = 'disconnected', disconnected_at = now(), disconnected_reason = 'displaced'
    where shop_domain = c.shop_domain and widget_site_id <> p_site and status in ('active', 'pending');
  update public.paste_site_connections set status = 'active', shop_proven_at = now(),
    disconnected_at = null, disconnected_reason = null where widget_site_id = p_site;
  return 'proven';
end $$;

-- An earlier draft of this file had a three-argument signal function.
drop function if exists public.record_paste_install_signal(uuid, text, text);
-- p_signed: the caller verified a Liquid render for this connection. A
-- Shopify paste store earns its free plan only from such a render (apex =
-- the shop itself, plus the storefront domain it ran on); an Origin-only
-- signal records install times and nothing more.
-- Returns: granted | apex_taken | recorded | ignored | claim_site_free_plan's answer
create or replace function public.record_paste_install_signal(p_site uuid, p_domain text, p_apex text, p_signed boolean default false)
returns text language plpgsql security invoker set search_path = public, pg_temp as $$
declare c public.paste_site_connections; apexes text[];
begin
  perform pg_advisory_xact_lock(hashtextextended('paste-domain-lifecycle', 0));
  select * into c from public.paste_site_connections where widget_site_id = p_site and status = 'active';
  if not found or p_domain is null or p_domain <> public.paste_host(p_domain) or p_apex is null
    or p_apex = 'myshopify.com' or not (p_domain = p_apex or p_domain like '%.' || p_apex)
    or (c.platform = 'shopify' and (c.shop_proven_at is null or public.paste_shop_app_installed(c.shop_domain)))
    then return 'ignored'; end if;
  if c.platform = 'shopify' and p_domain = c.shop_domain then
    -- The signed shop host, trusted through this connection. A shop is its
    -- own registrable domain: myshopify.com itself never counts as an apex,
    -- or a single paste store would exhaust the free plan for every shop.
    if p_apex <> c.shop_domain then return 'ignored'; end if;
    update public.paste_site_connections set first_seen_at = coalesce(first_seen_at, now()), last_seen_at = now()
      where widget_site_id = p_site;
  else
    update public.widget_domains set first_seen_at = coalesce(first_seen_at, now()), last_seen_at = now()
      where widget_site_id = p_site and public.paste_host(domain) = p_domain
        and verification_status = 'trusted' and verification_method = 'paste_trusted';
    if not found then return 'ignored'; end if;
  end if;
  update public.tryon_shops set last_seen_at = now() where shop_domain = 'site:' || p_site::text;
  -- This is the existing atomic apex registry AND ledger grant. No second
  -- credit writer is introduced; paid activation keeps its operator gate.
  if exists(select 1 from public.tryon_subscriptions where shop_domain = 'site:' || p_site::text)
    then return 'granted'; end if;
  if c.platform = 'shopify' then
    if not p_signed then return 'recorded'; end if;
    -- A shop is its own registrable domain; a custom storefront domain it
    -- ran on is claimed too, so neither can earn a second free plan.
    apexes := array[c.shop_domain] || case when p_domain = c.shop_domain then '{}'::text[] else array[p_apex] end;
  else
    apexes := array[p_apex];
  end if;
  if exists(select 1 from public.tryon_free_apex_history where apex = any(apexes) and first_widget_site_id <> p_site)
    then return 'apex_taken'; end if;
  return public.claim_site_free_plan(p_site, apexes);
end $$;

revoke all on function public.enable_paste_install(uuid,text,text) from public, anon, authenticated;
revoke all on function public.paste_shop_app_installed(text) from public, anon, authenticated;
revoke all on function public.paste_host(text) from public, anon, authenticated;
revoke all on function public.paste_host_matches(text,text) from public, anon, authenticated;
revoke all on function public.paste_domain_operation(uuid,text,text,uuid,text) from public, anon, authenticated;
revoke all on function public.rotate_paste_secret(uuid) from public, anon, authenticated;
revoke all on function public.prove_paste_shop(uuid,text) from public, anon, authenticated;
revoke all on function public.record_paste_install_signal(uuid,text,text,boolean) from public, anon, authenticated;
revoke all on function grindctrl_paste_private.guard_domain() from public, anon, authenticated;
revoke all on function grindctrl_paste_private.guard_site_domain() from public, anon, authenticated;
revoke all on function grindctrl_paste_private.guard_free_apex() from public, anon, authenticated;
grant execute on function public.enable_paste_install(uuid,text,text), public.paste_shop_app_installed(text),
  public.paste_host(text), public.paste_host_matches(text,text), public.paste_domain_operation(uuid,text,text,uuid,text),
  public.rotate_paste_secret(uuid), public.prove_paste_shop(uuid,text),
  public.record_paste_install_signal(uuid,text,text,boolean) to service_role;
commit;

-- Rollback: first disconnect paste connections and remove the new code.
-- Do NOT drop the columns/check or delete apex/ledger records while trusted
-- or disputed rows exist. Preserve dispute tombstones and granted credits.
-- No automatic rollback or data deletion is provided.
