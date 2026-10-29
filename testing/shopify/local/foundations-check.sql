-- LOCAL CONTRACT TEST ONLY. Synthetic identities, no Clerk session is claimed.
-- Roll back every fixture; this does not grant real account access.
begin;
do $$
declare p public.profiles; w public.workspaces; site jsonb; role_name text;
begin
  p:=public.bootstrap_profile('m1_foundation_owner','m1-foundation@example.invalid');
  w:=public.bootstrap_workspace(p.id,'M1 local foundation','m1-foundation');
  if public.dashboard_get_user_role('m1_foundation_owner',w.id)<>'owner' then
    raise exception 'synthetic_owner_membership_missing';
  end if;
  if public.dashboard_get_user_role('m1_foreign_owner',w.id) is not null then
    raise exception 'foreign_membership_leaked';
  end if;
  site:=public.dashboard_create_widget_site('m1_foundation_owner',w.id,'Synthetic Store Chat');
  if site->>'id' is null then raise exception 'synthetic_site_creation_failed';end if;
  if jsonb_array_length(public.get_user_workspace('m1_foundation_owner')->'sites')<>1 then
    raise exception 'workspace_site_contract_failed';
  end if;
  foreach role_name in array array['anon','authenticated'] loop
    if has_function_privilege(role_name,'public.bootstrap_profile(text,text,text,text,text,text)','execute')
      or has_function_privilege(role_name,'public.dashboard_create_widget_site(text,uuid,text)','execute')
      or has_table_privilege(role_name,'public.widget_messages','select')
      or has_table_privilege(role_name,'public.messenger_knowledge','insert') then
      raise exception 'browser_privilege_exposure';
    end if;
  end loop;
  if not has_function_privilege('service_role','public.bootstrap_profile(text,text,text,text,text,text)','execute') then
    raise exception 'service_bootstrap_missing';
  end if;
  if to_regclass('public.shopify_product_config') is null
    or to_regclass('public.messenger_audit') is null
    or to_regclass('public.messenger_unanswered') is null
    or to_regclass('public.workspace_invites') is null then
    raise exception 'source_foundation_table_missing';
  end if;
  -- A typed local-only contract column, never a guessed Production backfill.
  update public.tryon_shops set owner_clerk_user_id='m1_foundation_owner'
    where shop_domain='m1-local-x.myshopify.com';
  if not exists(select 1 from public.tryon_shops
    where shop_domain='m1-local-x.myshopify.com' and owner_clerk_user_id='m1_foundation_owner') then
    raise exception 'local_owner_contract_unavailable';
  end if;
end $$;
rollback;
