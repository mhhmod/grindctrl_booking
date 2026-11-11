-- Manual additive migration. Rollback: revert application code and disable spend-alerts;
-- retain settings and audit history. Clearing an override uses the operator action.
begin;
alter table public.tryon_shops add column if not exists settings_json jsonb not null default '{}'::jsonb;

-- The audit action list gains spend_limit_changed (same widening as
-- 20261110_security_action_audit.sql; the constraint is replaced, no rows change).
alter table public.messenger_audit drop constraint if exists messenger_audit_action_check;
alter table public.messenger_audit add constraint messenger_audit_action_check check (
  action in ('messenger_enabled','messenger_disabled','config_published','draft_discarded',
  'ai_capability_changed','knowledge_added','knowledge_updated','knowledge_removed',
  'conversation_taken_over','conversation_returned_to_ai','conversation_closed',
  'order_lookup_performed','order_lookup_denied','ai_action_rejected','ai_action_failed',
  'contact_captured','attachment_uploaded','shopify_token_stored','shopify_token_removed',
  'canned_reply_added','canned_reply_updated','canned_reply_removed','internal_note_added',
  'conversation_assigned','config_reverted','store_disconnected','member_role_changed',
  'member_removed','embed_key_regenerated','site_key_regenerated','trusted_domain_added',
  'trusted_domain_removed','manual_credit_grant','manual_plan_changed','spend_limit_changed')
);

-- A whole-settings merchant publish/revert must not reset operator controls.
-- Only the service-only setter below enables a transaction-local write.
create or replace function public.preserve_store_spend_limits() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_setting('grindctrl.spend_operator_write', true) = 'on' then return new; end if;
  if TG_OP = 'INSERT' then
    new.settings_json := coalesce(new.settings_json, '{}'::jsonb) - 'spend_limits';
  elsif old.settings_json ? 'spend_limits' then
    new.settings_json := jsonb_set(coalesce(new.settings_json, '{}'::jsonb), '{spend_limits}', old.settings_json->'spend_limits');
  else
    new.settings_json := coalesce(new.settings_json, '{}'::jsonb) - 'spend_limits';
  end if;
  return new;
end $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'widget_sites_preserve_spend_limits' and tgrelid = 'public.widget_sites'::regclass) then
    create trigger widget_sites_preserve_spend_limits before insert or update of settings_json on public.widget_sites
      for each row execute function public.preserve_store_spend_limits();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'tryon_shops_preserve_spend_limits' and tgrelid = 'public.tryon_shops'::regclass) then
    create trigger tryon_shops_preserve_spend_limits before insert or update of settings_json on public.tryon_shops
      for each row execute function public.preserve_store_spend_limits();
  end if;
end $$;

-- Security invoker, executable only by the service role. Clerk authorization
-- and the server-derived operator id are enforced by the server action.
create or replace function public.set_store_spend_limit(p_tenant text, p_key text, p_value integer, p_operator text)
returns void language plpgsql set search_path = '' as $$
declare
  previous jsonb;
  limits jsonb;
  site_id uuid;
  old_guard text := coalesce(current_setting('grindctrl.spend_operator_write', true), '');
begin
  if p_key is null or p_key not in ('storeChatDailyTurns', 'tryOnDailyLooks')
    or (p_value is not null and (p_value < 0 or p_value > 100000))
    or p_operator is null or length(btrim(p_operator)) = 0 then
    raise exception 'Invalid spend limit';
  end if;
  if p_tenant like 'site:%' then
    site_id := substring(p_tenant from 6)::uuid;
    select coalesce(settings_json, '{}'::jsonb) into previous from public.widget_sites where id = site_id for update;
  else
    select coalesce(settings_json, '{}'::jsonb) into previous from public.tryon_shops where shop_domain = p_tenant for update;
  end if;
  if previous is null then raise exception 'Unknown store'; end if;
  limits := coalesce(previous->'spend_limits', '{}'::jsonb);
  if p_value is null then limits := limits - p_key;
  else limits := jsonb_set(limits, array[p_key], to_jsonb(p_value)); end if;
  perform set_config('grindctrl.spend_operator_write', 'on', true);
  if site_id is not null then
    update public.widget_sites set settings_json = jsonb_set(previous, '{spend_limits}', limits),
      settings_version = coalesce(settings_version, 0) + 1 where id = site_id;
  else
    update public.tryon_shops set settings_json = jsonb_set(previous, '{spend_limits}', limits) where shop_domain = p_tenant;
  end if;
  perform set_config('grindctrl.spend_operator_write', old_guard, true);
  insert into public.messenger_audit(widget_site_id, actor_clerk_user_id, action, detail)
    values (site_id, p_operator, 'spend_limit_changed', jsonb_build_object('tenant', p_tenant, 'key', p_key,
      'previous', previous->'spend_limits'->p_key, 'value', p_value));
end $$;
revoke all on function public.set_store_spend_limit(text,text,integer,text) from public, anon, authenticated;
grant execute on function public.set_store_spend_limit(text,text,integer,text) to service_role;
revoke all on function public.preserve_store_spend_limits() from public, anon, authenticated;
commit;
