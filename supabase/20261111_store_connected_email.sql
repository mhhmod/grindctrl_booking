-- Additive; apply before deploying the "your store is connected" email.
-- widget_sites.connected_email_at is the once-per-store claim for that email
-- (lib/email/store-connected-sender.ts): set in one conditional update before
-- SMTP, cleared only after a definite non-delivery. Until this runs the app
-- sends no connected email at all (it never sends without the claim).
-- widget_sites is service-role only (widget_dashboard_grants_lockdown.sql),
-- so browser roles can neither read nor reset it. RLS is unchanged.
-- Backfill: stores already live are marked as sent, so only stores that
-- connect from now on receive it (otherwise every Shopify app store would
-- get it on its next admin visit). Live means: a proven Shopify paste shop,
-- a website paste domain our server verified (20261109), a paired plugin,
-- or a Shopify app (shop-owned) site.
-- Rollback (loses only the markers): alter table public.widget_sites drop column connected_email_at;
begin;
alter table public.widget_sites add column if not exists connected_email_at timestamptz;
update public.widget_sites s set connected_email_at = now()
  where s.connected_email_at is null and (
    exists (select 1 from public.paste_site_connections p where p.widget_site_id = s.id and p.status = 'active' and p.platform = 'shopify')
    or exists (select 1 from public.widget_domains d where d.widget_site_id = s.id and d.paste_verified_at is not null)
    or exists (select 1 from public.woo_site_connections w where w.widget_site_id = s.id and w.status = 'active')
    or s.domain like '%.myshopify.com');
commit;
