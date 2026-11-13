-- ============================================================
-- Migration: paste_shop_free_plan
-- Date: 2026-11-13
-- Purpose: A Shopify store connected with pasted code gets its free Try-On
--   plan in the same step that proves the shop, and from any later signal
--   if that step could not grant it.
--
--   Before this, record_paste_install_signal granted the plan only from a
--   SIGNED render that arrived AFTER shop_proven_at was set. The render that
--   completes the proof arrives before it (it is the proof's second factor),
--   and the proof-only request and the owner's "Check my store" never sent a
--   signed signal at all. Every later signal was unsigned and answered
--   'recorded'; with no plan the Try-On button stays hidden, so no signed
--   render ever came again. The store was proven and stuck without a plan.
--
--   Now:
--   * claim_paste_shop_free_plan (new, service only): the one place a proven
--     Shopify paste shop claims its free plan. Same rules as before, checked
--     in one place: the connection must be active and proven, no Shopify app
--     install on the shop, one free plan per apex (the shop itself and every
--     storefront domain our server verified for this site), apex history
--     respected even after the first claimer was deleted.
--   * prove_paste_shop: same contract and answers; after it makes the site
--     the shop's holder it claims the plan in the same transaction. A claim
--     that cannot be made (apex taken, or a ledger error) never undoes the
--     proof.
--   * record_paste_install_signal: same signature and answers; a proven
--     Shopify shop no longer needs p_signed to earn its plan. The shop was
--     proven by our own storefront fetch plus a signed render, which is
--     stronger than the signed render this used to wait for. An Origin
--     header still earns nothing by itself: the connection must be proven
--     and a storefront domain must be verified by our server. A verified
--     storefront domain seen later is added to the site's claimed apexes, so
--     it cannot earn a second free plan.
--
-- Requires 20261105_woo_dashboard_plans.sql, 20261108_paste_install.sql,
-- 20261109_paste_domain_verification.sql.
--
-- Additive: one new RPC and new bodies, same signatures, for two existing
-- RPCs. No table, column, constraint, index, policy, grant to a browser
-- role, storage bucket or auth object is added or changed. No rows change
-- when this runs.
--
-- Auth/RLS/storage: none touched. All three functions are SECURITY INVOKER
-- and executable by service_role only.
--
-- App order: either may ship first. The app also sends the signed signal on
-- the proof-only request, which the old function accepts; the new RPC is
-- optional to the app (a missing function reads as "nothing to claim").
--
-- Stores already stuck (proven, no plan) heal by themselves after this runs:
-- on the next storefront visit, or when the owner opens the dashboard.
-- Executed against PGlite by apps/web-next/lib/paste/paste-install-sql.test.ts.
-- ============================================================

begin;

-- Returns: granted | apex_taken | ignored | claim_site_free_plan's answer
create or replace function public.claim_paste_shop_free_plan(p_site uuid) returns text
language plpgsql security invoker set search_path = public, pg_temp as $$
declare c public.paste_site_connections;
begin
  perform pg_advisory_xact_lock(hashtextextended('paste-domain-lifecycle', 0));
  select * into c from public.paste_site_connections
    where widget_site_id = p_site and status = 'active' and platform = 'shopify';
  if not found or c.shop_proven_at is null or public.paste_shop_app_installed(c.shop_domain) then return 'ignored'; end if;
  if exists(select 1 from public.tryon_subscriptions where shop_domain = 'site:' || p_site::text) then return 'granted'; end if;
  -- One free plan per apex: the shop itself, and any storefront domain our
  -- server verified for this site. History entries are registrable domains,
  -- so a verified host equal to one, or under one, was already used.
  if exists(select 1 from public.tryon_free_apex_history h
    where h.first_widget_site_id <> p_site and (h.apex = c.shop_domain or exists(
      select 1 from public.widget_domains d
        where d.widget_site_id = p_site and d.verification_status = 'trusted'
          and d.verification_method = 'paste_trusted' and d.paste_verified_at is not null
          and (public.paste_host(d.domain) = h.apex or public.paste_host(d.domain) like '%.' || h.apex))))
    then return 'apex_taken'; end if;
  return public.claim_site_free_plan(p_site, array[c.shop_domain]);
end $$;

-- Same contract as 20261108_paste_install.sql, plus the claim.
-- Returns: proven | render_required | shopify_app_installed | not_pending
create or replace function public.prove_paste_shop(p_site uuid, p_shop text) returns text
language plpgsql security invoker set search_path = public, pg_temp as $$
declare c public.paste_site_connections;
begin
  perform pg_advisory_xact_lock(hashtextextended('paste-domain-lifecycle', 0));
  select * into c from public.paste_site_connections where widget_site_id = p_site for update;
  if not found or c.platform <> 'shopify' or c.shop_domain is distinct from p_shop or c.status = 'disconnected'
    then return 'not_pending'; end if;
  if public.paste_shop_app_installed(c.shop_domain) then return 'shopify_app_installed'; end if;
  if c.status <> 'active' then
    if c.shop_render_at is null or c.shop_render_at < now() - interval '1 day' then return 'render_required'; end if;
    update public.paste_site_connections set status = 'disconnected', disconnected_at = now(), disconnected_reason = 'displaced'
      where shop_domain = c.shop_domain and widget_site_id <> p_site and status in ('active', 'pending');
    update public.paste_site_connections set status = 'active', shop_proven_at = now(),
      shop_check_outcome = 'proven', shop_checked_at = now(), shop_check_started_at = null,
      disconnected_at = null, disconnected_reason = null where widget_site_id = p_site;
  end if;
  -- The plan belongs to the proof, not to whichever signal happens to come
  -- next. Its own block: a claim that fails must never undo the proof, and
  -- the next signal or dashboard open claims again.
  begin
    perform public.claim_paste_shop_free_plan(p_site);
  exception when others then
    raise warning 'paste shop proven, free plan not claimed for site %: %', p_site, sqlerrm;
  end;
  return 'proven';
end $$;

-- Same contract as 20261109_paste_domain_verification.sql, except that a
-- proven Shopify shop earns its plan from any signal (see the header).
-- p_signed is kept for callers and no longer decides anything.
-- Returns: granted | apex_taken | recorded | unverified | ignored | claim_site_free_plan's answer
create or replace function public.record_paste_install_signal(p_site uuid, p_domain text, p_apex text, p_signed boolean default false)
returns text language plpgsql security invoker set search_path = public, pg_temp as $$
declare c public.paste_site_connections; verified boolean; answer text;
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
    if not verified then
      -- The domain records nothing, but the proven shop keeps its own plan.
      if c.platform = 'shopify' then perform public.claim_paste_shop_free_plan(p_site); end if;
      return 'unverified';
    end if;
    update public.widget_domains set first_seen_at = coalesce(first_seen_at, now()), last_seen_at = now()
      where widget_site_id = p_site and public.paste_host(domain) = p_domain
        and verification_status = 'trusted' and verification_method = 'paste_trusted';
  end if;
  update public.tryon_shops set last_seen_at = now() where shop_domain = 'site:' || p_site::text;
  if c.platform = 'website' then return public.grant_paste_domain_free_plan(p_site, p_domain, p_apex); end if;
  answer := public.claim_paste_shop_free_plan(p_site);
  -- A verified storefront domain this shop runs on is claimed with it, so
  -- neither can earn a second free plan. Only for a site whose own free
  -- claim holds the shop, and never over another site's history.
  if answer = 'granted' and p_domain <> c.shop_domain
    and exists(select 1 from public.tryon_free_plan_apexes where apex = c.shop_domain and widget_site_id = p_site)
    and not exists(select 1 from public.tryon_free_apex_history where apex = p_apex and first_widget_site_id <> p_site)
  then
    insert into public.tryon_free_plan_apexes(apex, widget_site_id) values (p_apex, p_site) on conflict (apex) do nothing;
  end if;
  return answer;
end $$;

revoke all on function public.claim_paste_shop_free_plan(uuid) from public, anon, authenticated;
revoke all on function public.prove_paste_shop(uuid,text) from public, anon, authenticated;
revoke all on function public.record_paste_install_signal(uuid,text,text,boolean) from public, anon, authenticated;
grant execute on function public.claim_paste_shop_free_plan(uuid), public.prove_paste_shop(uuid,text),
  public.record_paste_install_signal(uuid,text,text,boolean) to service_role;

commit;

-- Rollback: re-run prove_paste_shop from 20261108_paste_install.sql and
-- record_paste_install_signal from 20261109_paste_domain_verification.sql,
-- then drop function public.claim_paste_shop_free_plan(uuid). Plans and
-- apexes already granted stay; do not delete apex history or credits.
--
-- One-time review, SELECT only, nothing is changed: proven Shopify paste
-- stores that have no plan today. Each heals on its next storefront visit
-- or dashboard open once this migration has run; a row that stays listed
-- has its apex taken (see tryon_free_apex_history) or the app installed.
--
-- select c.widget_site_id, c.shop_domain, c.shop_proven_at
--   from public.paste_site_connections c
--  where c.platform = 'shopify' and c.status = 'active' and c.shop_proven_at is not null
--    and not exists (select 1 from public.tryon_subscriptions s
--                     where s.shop_domain = 'site:' || c.widget_site_id::text)
--  order by c.shop_proven_at;
