-- G16. Manual additive delta after the plans and messenger audit migrations.
-- No data is removed. New RPC signatures accept an optional server-derived Clerk actor.
-- Old signatures are retired to avoid PostgREST overload ambiguity; omitted actors
-- remain supported by the default. No browser execute permissions are added.
begin;
alter table public.messenger_audit alter column widget_site_id drop not null;
-- A shop can have a team/plan before it has a Store Chat site. Its shop/workspace
-- is retained in detail when widget_site_id is null; existing RLS stays enabled.
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
  'trusted_domain_removed','manual_credit_grant','manual_plan_changed')
);

create or replace function public.record_security_audit(
  p_site uuid, p_actor text, p_action text, p_detail jsonb default '{}'::jsonb
) returns void language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
  insert into public.messenger_audit(widget_site_id,actor_clerk_user_id,action,detail)
  values(p_site,p_actor,p_action,p_detail);
exception when others then
  raise warning 'security audit insert failed';
end $$;
revoke all on function public.record_security_audit(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.record_security_audit(uuid,text,text,jsonb) to service_role;

-- Changing the argument list creates an overload rather than replacing it.
drop function if exists public.activate_tryon_plan(text,text,text,uuid);
create or replace function public.activate_tryon_plan(
  p_shop_domain text,
  p_plan_key text,
  p_note text,
  p_action_key uuid,
  p_actor_user_id text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_shop_domain text := lower(btrim(p_shop_domain));
  v_shop_status text;
  v_plan public.tryon_plans%rowtype;
  v_current_plan public.tryon_plans%rowtype;
  v_subscription public.tryon_subscriptions%rowtype;
  v_period_end timestamptz;
  v_plan_granted integer := 0;
  v_delta integer := 0;
  v_action_id uuid;
  v_grant_id uuid;
  v_replay_result jsonb;
begin
  if p_action_key is null or char_length(coalesce(p_note, '')) > 2000 then
    raise exception 'Invalid owner action';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_action_key::text, 0));
  v_replay_result := public.get_tryon_owner_action_replay(p_action_key);
  if v_replay_result is not null then return v_replay_result; end if;

  select status into v_shop_status
  from public.tryon_shops
  where shop_domain = v_shop_domain
  for update;
  if not found or v_shop_status <> 'installed' then
    raise exception 'TRYON_UNAVAILABLE: shop is not installed';
  end if;

  select p.* into strict v_plan
  from public.tryon_plans p
  where p.plan_key = p_plan_key and p.active;

  select l.id into v_action_id
  from public.tryon_credit_ledger l
  where l.idempotency_key = 'owner:' || p_action_key::text;
  if found then
    return jsonb_build_object(
      'actionKey', p_action_key,
      'replayed', true,
      'ledgerEntryIds', jsonb_build_array(v_action_id)
    );
  end if;

  perform public.reconcile_tryon_subscription(v_shop_domain);
  select s.* into v_subscription
  from public.tryon_subscriptions s
  where s.shop_domain = v_shop_domain
  for update;

  if not found then
    v_subscription.id := extensions.uuid_generate_v4();
    v_subscription.current_period_start := now();
    v_subscription.billing_anchor_at := v_subscription.current_period_start;
    v_period_end := public.tryon_period_boundary(
      v_subscription.billing_anchor_at,
      v_plan.period_unit,
      v_plan.period_count,
      1
    );

    insert into public.tryon_subscriptions (
      id, shop_domain, plan_id, status, billing_anchor_at,
      current_period_start, current_period_end, grace_ends_at,
      activation_source, notes, created_by
    ) values (
      v_subscription.id, v_shop_domain, v_plan.id, 'active',
      v_subscription.billing_anchor_at, v_subscription.current_period_start,
      v_period_end, v_period_end + make_interval(days => v_plan.grace_days),
      'manual', nullif(btrim(p_note), ''), coalesce(nullif(btrim(p_actor_user_id), ''), 'legacy_unknown')
    );
    v_delta := v_plan.renders_included;
    v_subscription.current_period_end := v_period_end;
  elsif v_subscription.status in ('expired', 'cancelled') then
    v_subscription.billing_anchor_at := now();
    v_subscription.current_period_start := v_subscription.billing_anchor_at;
    v_period_end := public.tryon_period_boundary(
      v_subscription.billing_anchor_at,
      v_plan.period_unit,
      v_plan.period_count,
      1
    );
    update public.tryon_subscriptions
    set
      plan_id = v_plan.id,
      status = 'active',
      billing_anchor_at = v_subscription.billing_anchor_at,
      current_period_start = v_subscription.current_period_start,
      current_period_end = v_period_end,
      grace_ends_at = v_period_end + make_interval(days => v_plan.grace_days),
      pending_plan_id = null,
      pending_plan_effective_at = null,
      activation_source = 'manual',
      notes = nullif(btrim(p_note), ''),
      activated_at = now(),
      expired_at = null,
      updated_at = now()
    where id = v_subscription.id;
    v_delta := v_plan.renders_included;
    v_subscription.current_period_end := v_period_end;
  else
    if v_subscription.status = 'grace' then
      raise exception 'Use renewal during the grace period';
    end if;

    select p.* into strict v_current_plan
    from public.tryon_plans p
    where p.id = v_subscription.plan_id;

    if v_plan.renders_included < v_current_plan.renders_included then
      raise exception 'Use schedule_downgrade for a lower plan';
    end if;

    select coalesce(sum(l.amount), 0)::integer into v_plan_granted
    from public.tryon_credit_ledger l
    where l.subscription_id = v_subscription.id
      and l.entry_type = 'grant'
      and l.plan_id is not null
      and l.created_at >= v_subscription.current_period_start
      and l.created_at < v_subscription.current_period_end;
    v_delta := greatest(0, v_plan.renders_included - v_plan_granted);

    update public.tryon_subscriptions
    set
      plan_id = v_plan.id,
      activation_source = 'manual',
      notes = nullif(btrim(p_note), ''),
      activated_at = now(),
      updated_at = now()
    where id = v_subscription.id;
  end if;

  if v_delta > 0 then
    insert into public.tryon_credit_ledger (
      shop_domain, subscription_id, plan_id, entry_type, amount, reason,
      idempotency_key, expires_at, created_by,
      metadata
    ) values (
      v_shop_domain,
      v_subscription.id,
      v_plan.id,
      'grant',
      v_delta,
      case when v_plan_granted > 0 then 'upgrade_grant' else 'activation_grant' end,
      case when v_plan_granted > 0 then 'upgrade:' else 'activation:' end || p_action_key::text,
      v_subscription.current_period_end,
      coalesce(nullif(btrim(p_actor_user_id), ''), 'legacy_unknown'),
      jsonb_build_object('actionKey', p_action_key, 'note', coalesce(p_note, ''))
    ) returning id into v_grant_id;
  end if;

  insert into public.tryon_credit_ledger (
    shop_domain, subscription_id, entry_type, amount, reason,
    idempotency_key, created_by,
    metadata
  ) values (
    v_shop_domain,
    v_subscription.id,
    'action',
    0,
    'owner_activate',
    'owner:' || p_action_key::text,
    coalesce(nullif(btrim(p_actor_user_id), ''), 'legacy_unknown'),
    jsonb_build_object('actionKey', p_action_key, 'planKey', p_plan_key, 'note', coalesce(p_note, ''))
  ) returning id into v_action_id;

  if v_grant_id is not null then
    perform public.record_security_audit(
      (select widget_site_id from public.tryon_shops where shop_domain=v_shop_domain),
      p_actor_user_id,'manual_credit_grant',
      jsonb_build_object('shop',v_shop_domain,'operation','activate_tryon_plan','action_key',p_action_key,'grant_id',v_grant_id));
  end if;
  perform public.record_security_audit(
    (select widget_site_id from public.tryon_shops where shop_domain=v_shop_domain),
    p_actor_user_id, 'manual_plan_changed',
    jsonb_build_object('shop',v_shop_domain,'operation','activate_tryon_plan','action_key',p_action_key));
  return jsonb_build_object(
    'actionKey', p_action_key,
    'replayed', false,
    'ledgerEntryIds', to_jsonb(array_remove(array[v_grant_id, v_action_id], null))
  );
end;
$$;
revoke all on function public.activate_tryon_plan(text,text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.activate_tryon_plan(text,text,text,uuid,text) to service_role;

-- Changing the argument list creates an overload rather than replacing it.
drop function if exists public.renew_tryon_plan(text,text,uuid);
create or replace function public.renew_tryon_plan(
  p_shop_domain text,
  p_note text,
  p_action_key uuid,
  p_actor_user_id text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_shop_domain text := lower(btrim(p_shop_domain));
  v_subscription public.tryon_subscriptions%rowtype;
  v_plan public.tryon_plans%rowtype;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_index integer := 1;
  v_action_id uuid;
  v_grant_id uuid;
  v_replay_result jsonb;
begin
  if p_action_key is null or char_length(coalesce(p_note, '')) > 2000 then
    raise exception 'Invalid owner action';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_action_key::text, 0));
  v_replay_result := public.get_tryon_owner_action_replay(p_action_key);
  if v_replay_result is not null then return v_replay_result; end if;

  perform public.reconcile_tryon_subscription(v_shop_domain);
  select s.* into v_subscription
  from public.tryon_subscriptions s
  join public.tryon_shops sh on sh.shop_domain = s.shop_domain
  where s.shop_domain = v_shop_domain and sh.status = 'installed'
  for update of s;
  if not found then
    raise exception 'TRYON_UNAVAILABLE: subscription is unavailable';
  end if;

  select l.id into v_action_id
  from public.tryon_credit_ledger l
  where l.idempotency_key = 'owner:' || p_action_key::text;
  if found then
    return jsonb_build_object(
      'actionKey', p_action_key,
      'replayed', true,
      'ledgerEntryIds', jsonb_build_array(v_action_id)
    );
  end if;

  if v_subscription.status = 'active' and now() < v_subscription.current_period_end then
    raise exception 'Renewal is available at the period boundary';
  end if;

  if v_subscription.pending_plan_id is not null then
    v_subscription.plan_id := v_subscription.pending_plan_id;
  end if;
  select p.* into strict v_plan
  from public.tryon_plans p
  where p.id = v_subscription.plan_id;

  if v_subscription.status = 'expired' then
    v_period_start := now();
    v_subscription.billing_anchor_at := v_period_start;
    v_period_end := public.tryon_period_boundary(
      v_period_start, v_plan.period_unit, v_plan.period_count, 1
    );
  else
    v_period_start := v_subscription.current_period_end;
    while public.tryon_period_boundary(
      v_subscription.billing_anchor_at, v_plan.period_unit, v_plan.period_count, v_index
    ) <= v_period_start loop
      v_index := v_index + 1;
      if v_index > 1200 then raise exception 'Subscription period is outside the renewal range'; end if;
    end loop;
    v_period_end := public.tryon_period_boundary(
      v_subscription.billing_anchor_at, v_plan.period_unit, v_plan.period_count, v_index
    );
  end if;

  update public.tryon_subscriptions
  set
    plan_id = v_plan.id,
    status = 'active',
    billing_anchor_at = v_subscription.billing_anchor_at,
    current_period_start = v_period_start,
    current_period_end = v_period_end,
    grace_ends_at = v_period_end + make_interval(days => v_plan.grace_days),
    pending_plan_id = null,
    pending_plan_effective_at = null,
    activation_source = 'manual',
    notes = nullif(btrim(p_note), ''),
    activated_at = now(),
    expired_at = null,
    updated_at = now()
  where id = v_subscription.id;

  insert into public.tryon_credit_ledger (
    shop_domain, subscription_id, plan_id, entry_type, amount, reason,
    idempotency_key, expires_at, created_by,
    metadata
  ) values (
    v_shop_domain,
    v_subscription.id,
    v_plan.id,
    'grant',
    v_plan.renders_included,
    'renewal_grant',
    'renewal:' || p_action_key::text,
    v_period_end,
    coalesce(nullif(btrim(p_actor_user_id), ''), 'legacy_unknown'),
    jsonb_build_object('actionKey', p_action_key, 'note', coalesce(p_note, ''))
  ) returning id into v_grant_id;

  insert into public.tryon_credit_ledger (
    shop_domain, subscription_id, entry_type, amount, reason,
    idempotency_key, created_by,
    metadata
  ) values (
    v_shop_domain,
    v_subscription.id,
    'action',
    0,
    'owner_renew',
    'owner:' || p_action_key::text,
    coalesce(nullif(btrim(p_actor_user_id), ''), 'legacy_unknown'),
    jsonb_build_object('actionKey', p_action_key, 'note', coalesce(p_note, ''))
  ) returning id into v_action_id;

  if v_grant_id is not null then
    perform public.record_security_audit(
      (select widget_site_id from public.tryon_shops where shop_domain=v_shop_domain),
      p_actor_user_id,'manual_credit_grant',
      jsonb_build_object('shop',v_shop_domain,'operation','renew_tryon_plan','action_key',p_action_key,'grant_id',v_grant_id));
  end if;
  perform public.record_security_audit(
    (select widget_site_id from public.tryon_shops where shop_domain=v_shop_domain),
    p_actor_user_id, 'manual_plan_changed',
    jsonb_build_object('shop',v_shop_domain,'operation','renew_tryon_plan','action_key',p_action_key));
  return jsonb_build_object(
    'actionKey', p_action_key,
    'replayed', false,
    'ledgerEntryIds', to_jsonb(array[v_grant_id, v_action_id])
  );
end;
$$;
revoke all on function public.renew_tryon_plan(text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.renew_tryon_plan(text,text,uuid,text) to service_role;

-- Changing the argument list creates an overload rather than replacing it.
drop function if exists public.apply_tryon_top_up(text,text,text,uuid);
create or replace function public.apply_tryon_top_up(
  p_shop_domain text,
  p_pack_key text,
  p_note text,
  p_action_key uuid,
  p_actor_user_id text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_shop_domain text := lower(btrim(p_shop_domain));
  v_subscription public.tryon_subscriptions%rowtype;
  v_pack public.tryon_credit_packs%rowtype;
  v_action_id uuid;
  v_grant_id uuid;
  v_replay_result jsonb;
begin
  if p_action_key is null or char_length(coalesce(p_note, '')) > 2000 then
    raise exception 'Invalid owner action';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_action_key::text, 0));
  v_replay_result := public.get_tryon_owner_action_replay(p_action_key);
  if v_replay_result is not null then return v_replay_result; end if;

  perform public.reconcile_tryon_subscription(v_shop_domain);
  select s.* into v_subscription
  from public.tryon_subscriptions s
  join public.tryon_shops sh on sh.shop_domain = s.shop_domain
  where s.shop_domain = v_shop_domain
    and sh.status = 'installed'
    and s.status in ('active', 'grace')
    and now() < s.grace_ends_at
  for update of s;
  if not found then
    raise exception 'TRYON_UNAVAILABLE: top-ups require an eligible subscription';
  end if;

  select l.id into v_action_id
  from public.tryon_credit_ledger l
  where l.idempotency_key = 'owner:' || p_action_key::text;
  if found then
    return jsonb_build_object(
      'actionKey', p_action_key,
      'replayed', true,
      'ledgerEntryIds', jsonb_build_array(v_action_id)
    );
  end if;

  select p.* into strict v_pack
  from public.tryon_credit_packs p
  where p.pack_key = p_pack_key and p.active;

  insert into public.tryon_credit_ledger (
    shop_domain, subscription_id, credit_pack_id, entry_type, amount, reason,
    idempotency_key, expires_at, created_by,
    metadata
  ) values (
    v_shop_domain,
    v_subscription.id,
    v_pack.id,
    'grant',
    v_pack.renders,
    'top_up_grant',
    'topup:' || p_action_key::text,
    now() + make_interval(days => v_pack.validity_days),
    coalesce(nullif(btrim(p_actor_user_id), ''), 'legacy_unknown'),
    jsonb_build_object('actionKey', p_action_key, 'packKey', p_pack_key, 'note', coalesce(p_note, ''))
  ) returning id into v_grant_id;

  insert into public.tryon_credit_ledger (
    shop_domain, subscription_id, entry_type, amount, reason,
    idempotency_key, created_by,
    metadata
  ) values (
    v_shop_domain,
    v_subscription.id,
    'action',
    0,
    'owner_top_up',
    'owner:' || p_action_key::text,
    coalesce(nullif(btrim(p_actor_user_id), ''), 'legacy_unknown'),
    jsonb_build_object('actionKey', p_action_key, 'packKey', p_pack_key, 'note', coalesce(p_note, ''))
  ) returning id into v_action_id;

  perform public.record_security_audit(
    (select widget_site_id from public.tryon_shops where shop_domain=v_shop_domain),
    p_actor_user_id, 'manual_credit_grant',
    jsonb_build_object('shop',v_shop_domain,'operation','apply_tryon_top_up','action_key',p_action_key));
  return jsonb_build_object(
    'actionKey', p_action_key,
    'replayed', false,
    'ledgerEntryIds', to_jsonb(array[v_grant_id, v_action_id])
  );
end;
$$;
revoke all on function public.apply_tryon_top_up(text,text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.apply_tryon_top_up(text,text,text,uuid,text) to service_role;

-- Changing the argument list creates an overload rather than replacing it.
drop function if exists public.schedule_tryon_downgrade(text,text,uuid);
create or replace function public.schedule_tryon_downgrade(
  p_shop_domain text,
  p_plan_key text,
  p_action_key uuid,
  p_actor_user_id text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_shop_domain text := lower(btrim(p_shop_domain));
  v_subscription public.tryon_subscriptions%rowtype;
  v_current_plan public.tryon_plans%rowtype;
  v_plan public.tryon_plans%rowtype;
  v_action_id uuid;
  v_replay_result jsonb;
begin
  if p_action_key is null then raise exception 'Invalid owner action'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_action_key::text, 0));
  v_replay_result := public.get_tryon_owner_action_replay(p_action_key);
  if v_replay_result is not null then return v_replay_result; end if;

  perform public.reconcile_tryon_subscription(v_shop_domain);
  select s.* into v_subscription
  from public.tryon_subscriptions s
  join public.tryon_shops sh on sh.shop_domain = s.shop_domain
  where s.shop_domain = v_shop_domain
    and sh.status = 'installed'
    and s.status = 'active'
  for update of s;
  if not found then
    raise exception 'TRYON_UNAVAILABLE: downgrade requires an active subscription';
  end if;

  select l.id into v_action_id
  from public.tryon_credit_ledger l
  where l.idempotency_key = 'owner:' || p_action_key::text;
  if found then
    return jsonb_build_object(
      'actionKey', p_action_key,
      'replayed', true,
      'ledgerEntryIds', jsonb_build_array(v_action_id)
    );
  end if;

  select p.* into strict v_current_plan from public.tryon_plans p where p.id = v_subscription.plan_id;
  select p.* into strict v_plan from public.tryon_plans p where p.plan_key = p_plan_key and p.active;
  if v_plan.renders_included >= v_current_plan.renders_included then
    raise exception 'Target plan is not a downgrade';
  end if;

  update public.tryon_subscriptions
  set
    pending_plan_id = v_plan.id,
    pending_plan_effective_at = v_subscription.current_period_end,
    updated_at = now()
  where id = v_subscription.id;

  insert into public.tryon_credit_ledger (
    shop_domain, subscription_id, entry_type, amount, reason,
    idempotency_key, created_by,
    metadata
  ) values (
    v_shop_domain,
    v_subscription.id,
    'action',
    0,
    'owner_downgrade',
    'owner:' || p_action_key::text,
    coalesce(nullif(btrim(p_actor_user_id), ''), 'legacy_unknown'),
    jsonb_build_object('actionKey', p_action_key, 'planKey', p_plan_key)
  ) returning id into v_action_id;

  perform public.record_security_audit(
    (select widget_site_id from public.tryon_shops where shop_domain=v_shop_domain),
    p_actor_user_id, 'manual_plan_changed',
    jsonb_build_object('shop',v_shop_domain,'operation','schedule_tryon_downgrade','action_key',p_action_key));
  return jsonb_build_object(
    'actionKey', p_action_key,
    'replayed', false,
    'ledgerEntryIds', jsonb_build_array(v_action_id)
  );
end;
$$;
revoke all on function public.schedule_tryon_downgrade(text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.schedule_tryon_downgrade(text,text,uuid,text) to service_role;

create or replace function public.dashboard_regenerate_embed_key(
  p_clerk_user_id text,
  p_site_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_key text;
  v_site jsonb;
begin
  v_new_key := 'gc_' || substr(md5(random()::text), 1, 8) || '_' ||
               substr(md5(random()::text), 1, 8) || '_' ||
               substr(md5(random()::text), 1, 8);

  update public.widget_sites set
    embed_key   = v_new_key,
    updated_at  = now()
  where id = p_site_id
  returning jsonb_build_object(
    'id', id,
    'workspace_id', workspace_id,
    'name', name,
    'embed_key', embed_key,
    'status', status,
    'settings_json', settings_json,
    'settings_version', settings_version,
    'created_at', created_at,
    'updated_at', updated_at
  )
  into v_site;

  if v_site is not null then
    perform public.record_security_audit(p_site_id,p_clerk_user_id,'embed_key_regenerated','{}');
  end if;
  return v_site;
end;
$$;

-- Legacy service-only domain RPCs share the same audit path.
create or replace function public.dashboard_add_domain(
  p_clerk_user_id text,
  p_site_id uuid,
  p_domain text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_domain jsonb;
begin
  insert into public.widget_domains (widget_site_id, domain)
  values (p_site_id, p_domain)
  returning to_jsonb(public.widget_domains.*)
  into v_domain;

  perform public.record_security_audit(p_site_id,p_clerk_user_id,'trusted_domain_added',
    jsonb_build_object('domain_id',v_domain->>'id','domain',v_domain->>'domain'));
  return v_domain;
end;
$$;

create or replace function public.dashboard_remove_domain(
  p_clerk_user_id text,
  p_domain_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_domain public.widget_domains%rowtype;
begin
  delete from public.widget_domains where id = p_domain_id returning * into v_domain;
  if found then
    perform public.record_security_audit(v_domain.widget_site_id,p_clerk_user_id,'trusted_domain_removed',
      jsonb_build_object('domain_id',p_domain_id,'domain',v_domain.domain));
  end if;
  return true;
end;
$$;

commit;
