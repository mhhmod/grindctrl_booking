-- ============================================================
-- Migration: paste_domain_verification
-- Date: 2026-11-09
-- Purpose: A pasted install's domain is usable for Store Chat as soon as
--   the merchant adds it (no DNS step), but it is VERIFIED only when our
--   server fetched that domain's own home page and found this site's snippet
--   there (messenger.js carrying this site's embed key), or the existing
--   DNS TXT / meta proof passed. Only a verified domain earns the free
--   Try-On plan, writes free-plan apex history, or runs Try-On.
--
--   Before this, an added hostname was trusted at once, and one request with
--   a forged Origin header to the public config endpoint granted the free
--   plan and recorded the apex in tryon_free_apex_history for good, which
--   then blocked the domain's real owner.
--
-- Requires 20261108_paste_install.sql (and 20261105_woo_dashboard_plans.sql).
--
-- Additive: three nullable columns and one CHECK on widget_domains, two new
-- service-only RPCs (record_paste_domain_check, grant_paste_domain_free_plan)
-- and new bodies, same signatures, for paste_domain_operation and
-- record_paste_install_signal. One backfill marks rows that already passed
-- the DNS/meta proof as verified. Nothing is deleted.
--
-- Auth/RLS/storage: no policy, browser-role grant, bucket or auth object is
-- touched. The guard_paste_domain trigger already refuses browser roles on
-- paste rows, so only the service role writes these columns. The new RPCs
-- are SECURITY INVOKER and executable by service_role only.
--
-- App order: the app reads a missing paste_verified_at column as
-- unverified (fail closed), so either may ship first. Until this runs, Try-On
-- on pasted website domains stays off and no domain can be verified.
-- Executed against PGlite by apps/web-next/lib/paste/paste-install-sql.test.ts.
-- ============================================================

begin;

alter table public.widget_domains
  add column if not exists paste_verified_at timestamptz,
  add column if not exists paste_check_outcome text,
  add column if not exists paste_checked_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'widget_domains_paste_check_outcome_check'
      and conrelid = 'public.widget_domains'::regclass) then
    alter table public.widget_domains add constraint widget_domains_paste_check_outcome_check
      check (paste_check_outcome is null or paste_check_outcome in ('verified', 'not_found', 'wrong_site', 'unreachable'));
  end if;
end
$$;

comment on column public.widget_domains.paste_verified_at is
  'When our server confirmed this paste domain: its home page carried this site''s snippet, or the DNS/meta proof passed. NULL = unverified.';
comment on column public.widget_domains.paste_check_outcome is
  'What the last snippet check of this paste domain found (verified, not_found, wrong_site, unreachable).';
comment on column public.widget_domains.paste_checked_at is
  'When the last snippet check of this paste domain ran.';

-- The 'prove' operation (DNS TXT record or root meta tag carrying the row's
-- token) is the only writer of verified_at on a paste row, so these rows
-- were already proven by their owner.
update public.widget_domains
  set paste_verified_at = verified_at, paste_check_outcome = 'verified', paste_checked_at = verified_at
  where verification_method = 'paste_trusted' and verification_status = 'trusted'
    and verified_at is not null and paste_verified_at is null;

-- Same contract as 20261108_paste_install.sql, plus:
--   add:    a new or re-added row starts unverified.
--   verify: called ONLY by our server after it fetched this host's home page
--           and found this site's own snippet there. The page is the proof,
--           so no token; it transfers the host exactly like 'prove'.
--   prove and verify both stamp paste_verified_at.
create or replace function public.paste_domain_operation(
  p_site uuid, p_operation text, p_domain text, p_domain_id uuid, p_token text
) returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare d public.widget_domains; host text; taken boolean; other_site uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('paste-domain-lifecycle', 0));
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
        verification_token = p_token, first_seen_at = null, last_seen_at = null, disabled_at = null,
        paste_verified_at = null, paste_check_outcome = null, paste_checked_at = null
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
    elsif p_operation in ('prove', 'verify') then
      if d.verification_status = 'disabled'
        or (p_operation = 'prove' and d.verification_token is distinct from p_token)
        then return jsonb_build_object('code', 'proof_failed'); end if;
      -- Control of the host's DNS or page transfers the hostname, never the
      -- other site's settings, billing, history or tenant. Displaced
      -- implicit/wildcard allowances receive an exact-host denial row.
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
      update public.widget_domains set verification_status = 'disabled', verification_method = 'paste_shadow', disabled_at = now()
        where widget_site_id = p_site and public.paste_host(domain) = host and id <> p_domain_id;
      update public.widget_domains set verification_status = 'trusted', verification_method = 'paste_trusted',
        verified_at = now(), last_checked_at = now(), disabled_at = null,
        paste_verified_at = now(), paste_check_outcome = 'verified', paste_checked_at = now()
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

-- Stores what a snippet check that did NOT find this site's code saw, for
-- the dashboard. Never changes trust or verification ('verified' is written
-- only by paste_domain_operation).
-- Returns: recorded | not_found | invalid
create or replace function public.record_paste_domain_check(p_site uuid, p_domain_id uuid, p_outcome text)
returns text language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  if p_outcome is null or p_outcome not in ('not_found', 'wrong_site', 'unreachable') then return 'invalid'; end if;
  update public.widget_domains set paste_check_outcome = p_outcome, paste_checked_at = now()
    where id = p_domain_id and widget_site_id = p_site and verification_status <> 'disabled'
      and verification_method in ('paste_trusted', 'paste_dns_txt', 'paste_disputed');
  return case when found then 'recorded' else 'not_found' end;
end $$;

-- The free Try-On plan of a website paste site, claimed with the apex of a
-- domain our server verified. An unverified row (a hostname someone merely
-- typed, or a request carrying a forged Origin header) can neither earn a
-- plan nor write apex history, so it can never block the real owner.
-- Returns: granted | apex_taken | unverified | ignored | claim_site_free_plan's answer
create or replace function public.grant_paste_domain_free_plan(p_site uuid, p_domain text, p_apex text)
returns text language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('paste-domain-lifecycle', 0));
  if p_domain is null or p_domain <> public.paste_host(p_domain) or p_apex is null or p_apex = 'myshopify.com'
    or not (p_domain = p_apex or p_domain like '%.' || p_apex)
    or not exists(select 1 from public.paste_site_connections where widget_site_id = p_site
      and status = 'active' and platform = 'website')
    then return 'ignored'; end if;
  if not exists(select 1 from public.widget_domains where widget_site_id = p_site
      and public.paste_host(domain) = p_domain and verification_status = 'trusted'
      and verification_method = 'paste_trusted' and paste_verified_at is not null)
    then return 'unverified'; end if;
  if exists(select 1 from public.tryon_subscriptions where shop_domain = 'site:' || p_site::text)
    then return 'granted'; end if;
  if exists(select 1 from public.tryon_free_apex_history where apex = p_apex and first_widget_site_id <> p_site)
    then return 'apex_taken'; end if;
  return public.claim_site_free_plan(p_site, array[p_apex]);
end $$;

-- Same contract as 20261108_paste_install.sql, except that a domain row
-- (website, or a Shopify store's own storefront domain) counts only once
-- verified. An unverified host records nothing (no seen time, no plan, no
-- apex) and answers 'unverified', so the caller can ask our server to look
-- for the snippet there. The signed Shopify shop host is proven through its
-- connection (prove_paste_shop) and is unchanged.
-- Returns: granted | apex_taken | recorded | unverified | ignored | claim_site_free_plan's answer
create or replace function public.record_paste_install_signal(p_site uuid, p_domain text, p_apex text, p_signed boolean default false)
returns text language plpgsql security invoker set search_path = public, pg_temp as $$
declare c public.paste_site_connections; apexes text[]; verified boolean;
begin
  perform pg_advisory_xact_lock(hashtextextended('paste-domain-lifecycle', 0));
  select * into c from public.paste_site_connections where widget_site_id = p_site and status = 'active';
  if not found or p_domain is null or p_domain <> public.paste_host(p_domain) or p_apex is null
    or p_apex = 'myshopify.com' or not (p_domain = p_apex or p_domain like '%.' || p_apex)
    or (c.platform = 'shopify' and (c.shop_proven_at is null or public.paste_shop_app_installed(c.shop_domain)))
    then return 'ignored'; end if;
  if c.platform = 'shopify' and p_domain = c.shop_domain then
    if p_apex <> c.shop_domain then return 'ignored'; end if;
    update public.paste_site_connections set first_seen_at = coalesce(first_seen_at, now()), last_seen_at = now()
      where widget_site_id = p_site;
  else
    select paste_verified_at is not null into verified from public.widget_domains
      where widget_site_id = p_site and public.paste_host(domain) = p_domain
        and verification_status = 'trusted' and verification_method = 'paste_trusted'
      order by paste_verified_at nulls last limit 1;
    if not found then return 'ignored'; end if;
    if not verified then return 'unverified'; end if;
    update public.widget_domains set first_seen_at = coalesce(first_seen_at, now()), last_seen_at = now()
      where widget_site_id = p_site and public.paste_host(domain) = p_domain
        and verification_status = 'trusted' and verification_method = 'paste_trusted';
  end if;
  update public.tryon_shops set last_seen_at = now() where shop_domain = 'site:' || p_site::text;
  if c.platform = 'website' then return public.grant_paste_domain_free_plan(p_site, p_domain, p_apex); end if;
  if exists(select 1 from public.tryon_subscriptions where shop_domain = 'site:' || p_site::text)
    then return 'granted'; end if;
  if not p_signed then return 'recorded'; end if;
  -- A shop is its own registrable domain; a verified custom storefront
  -- domain it ran on is claimed too, so neither can earn a second free plan.
  apexes := array[c.shop_domain] || case when p_domain = c.shop_domain then '{}'::text[] else array[p_apex] end;
  if exists(select 1 from public.tryon_free_apex_history where apex = any(apexes) and first_widget_site_id <> p_site)
    then return 'apex_taken'; end if;
  return public.claim_site_free_plan(p_site, apexes);
end $$;

revoke all on function public.paste_domain_operation(uuid,text,text,uuid,text) from public, anon, authenticated;
revoke all on function public.record_paste_domain_check(uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.grant_paste_domain_free_plan(uuid,text,text) from public, anon, authenticated;
revoke all on function public.record_paste_install_signal(uuid,text,text,boolean) from public, anon, authenticated;
grant execute on function public.paste_domain_operation(uuid,text,text,uuid,text),
  public.record_paste_domain_check(uuid,uuid,text), public.grant_paste_domain_free_plan(uuid,text,text),
  public.record_paste_install_signal(uuid,text,text,boolean) to service_role;

commit;

-- Rollback: re-run the function definitions from 20261108_paste_install.sql
-- (paste_domain_operation, record_paste_install_signal) to restore the old
-- behaviour, which brings back the forged-Origin grant. The new columns,
-- CHECK and RPCs may stay; the previous app ignores them. Do not delete apex
-- history or granted credits.
--
-- One-time review, SELECT only, nothing is changed: free-plan apexes in
-- tryon_free_apex_history whose first claimer is a paste site that never had
-- a verified domain (or proven Shopify shop) for that apex. Each row is an
-- apex an unverified claim may have taken; decide case by case. Run after
-- this migration (it reads paste_verified_at).
--
-- select h.apex, h.first_widget_site_id, h.claimed_at, p.platform, p.shop_domain,
--        exists (select 1 from public.widget_sites s where s.id = h.first_widget_site_id) as claimer_site_exists
--   from public.tryon_free_apex_history h
--   left join public.paste_site_connections p on p.widget_site_id = h.first_widget_site_id
--  where (p.widget_site_id is not null
--         or not exists (select 1 from public.widget_sites s where s.id = h.first_widget_site_id))
--    and not exists (
--          select 1 from public.widget_domains d
--           where d.widget_site_id = h.first_widget_site_id
--             and d.paste_verified_at is not null
--             and (public.paste_host(d.domain) = h.apex or public.paste_host(d.domain) like '%.' || h.apex))
--    and not coalesce(p.platform = 'shopify' and p.shop_proven_at is not null and h.apex = p.shop_domain, false)
--  order by h.claimed_at;
--
-- Rows whose claimer site was deleted have no paste_site_connections row
-- left to tell paste from WooCommerce; claimer_site_exists = false marks them
-- for a manual look.
