-- Additive; RLS and existing policies are unchanged. Apply before deploying.
-- Rollback (loses cached catalogue only): drop function public.messenger_replace_products(uuid,timestamptz,jsonb);
-- drop index public.messenger_product_lookup; alter table public.messenger_knowledge drop column product_data;
-- alter table public.widget_sites drop column products_sync_attempted_at, drop column products_synced_at;
begin;
alter table public.messenger_knowledge add column if not exists product_data jsonb;
alter table public.widget_sites add column if not exists products_sync_attempted_at timestamptz;
alter table public.widget_sites add column if not exists products_synced_at timestamptz;
create index if not exists messenger_product_lookup on public.messenger_knowledge(widget_site_id, status, id) where source = 'product';
create or replace function public.messenger_replace_products(p_site uuid, p_lease timestamptz, p_products jsonb)
returns void language plpgsql security invoker set search_path = public as $$
begin
  perform 1 from public.widget_sites where id = p_site and products_sync_attempted_at = p_lease for update;
  if not found then raise exception 'Stale catalogue lease'; end if;
  if jsonb_typeof(p_products) <> 'array' or jsonb_array_length(p_products) > 500 then raise exception 'Catalogue limit'; end if;
  delete from public.messenger_knowledge where widget_site_id = p_site and source = 'product';
  insert into public.messenger_knowledge(widget_site_id, title, content, source, source_url, status, last_synced_at, product_data)
    select p_site, left(p->>'title',200), coalesce(nullif(left(p->>'description',600),''),left(p->>'title',200)), 'product',
      case when p->>'url' like 'https://%' then p->>'url' else null end, 'active', now(), p
    from jsonb_array_elements(p_products) p;
  update public.widget_sites set products_synced_at = now() where id = p_site;
end $$;
revoke all on function public.messenger_replace_products(uuid,timestamptz,jsonb) from public, anon, authenticated;
grant execute on function public.messenger_replace_products(uuid,timestamptz,jsonb) to service_role;
commit;
