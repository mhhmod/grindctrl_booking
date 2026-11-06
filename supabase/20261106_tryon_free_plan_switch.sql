-- Apply a scheduled move between free plans at the period boundary.
-- Free periods roll here without an owner renewal, so before this change a
-- pending free plan (for example retired free-v1 to free-v2) never took effect:
-- the rollover kept granting the old plan. Paid plans are unchanged; their
-- renewal operation still applies pending downgrades.
-- Additive: replaces one function body, no data changes. Safe to re-apply.
begin;

create or replace function public.reconcile_tryon_subscription(p_shop_domain text)
returns uuid
language plpgsql
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_subscription public.tryon_subscriptions%rowtype;
  v_plan public.tryon_plans%rowtype;
  v_pending public.tryon_plans%rowtype;
  v_switched boolean := false;
  v_installed boolean;
  v_period_index integer := 1;
  v_period_start timestamptz;
  v_period_end timestamptz;
begin
  select s.* into v_subscription
  from public.tryon_subscriptions s
  where s.shop_domain = lower(btrim(p_shop_domain))
  for update;

  if not found then
    return null;
  end if;

  select p.* into strict v_plan
  from public.tryon_plans p
  where p.id = v_subscription.plan_id;

  select coalesce(sh.status = 'installed', false) into v_installed
  from public.tryon_shops sh
  where sh.shop_domain = v_subscription.shop_domain;

  insert into public.tryon_credit_ledger (
    shop_domain, subscription_id, plan_id, credit_pack_id, entry_type,
    amount, reason, source_grant_id, idempotency_key, created_by
  )
  select
    g.shop_domain,
    g.subscription_id,
    g.plan_id,
    g.credit_pack_id,
    'expire',
    -(g.amount + coalesce(sum(c.amount), 0))::integer,
    'credit_expiry',
    g.id,
    'expire:' || g.id::text,
    'system'
  from public.tryon_credit_ledger g
  left join public.tryon_credit_ledger c on c.source_grant_id = g.id
  where g.subscription_id = v_subscription.id
    and g.entry_type = 'grant'
    and g.expires_at <= now()
  group by g.id
  having g.amount + coalesce(sum(c.amount), 0) > 0
  on conflict (idempotency_key) do nothing;

  if v_subscription.status in ('expired', 'cancelled') then
    return v_subscription.id;
  end if;

  if v_plan.is_free and v_installed and now() >= v_subscription.current_period_end then
    -- Only a free target: a free tenant never rolls into a paid plan unpaid.
    if v_subscription.pending_plan_id is not null
      and v_subscription.pending_plan_effective_at <= now() then
      select p.* into v_pending
      from public.tryon_plans p
      where p.id = v_subscription.pending_plan_id and p.is_free;
      if found then
        v_plan := v_pending;
        v_switched := true;
      end if;
    end if;

    v_period_start := v_subscription.current_period_end;

    while public.tryon_period_boundary(
      v_subscription.billing_anchor_at,
      v_plan.period_unit,
      v_plan.period_count,
      v_period_index
    ) <= v_period_start loop
      v_period_index := v_period_index + 1;
      if v_period_index > 1200 then
        raise exception 'Free subscription period is outside the reconciliation range';
      end if;
    end loop;

    v_period_end := public.tryon_period_boundary(
      v_subscription.billing_anchor_at,
      v_plan.period_unit,
      v_plan.period_count,
      v_period_index
    );

    while v_period_end <= now() loop
      v_period_start := v_period_end;
      v_period_index := v_period_index + 1;
      if v_period_index > 1200 then
        raise exception 'Free subscription period is outside the reconciliation range';
      end if;
      v_period_end := public.tryon_period_boundary(
        v_subscription.billing_anchor_at,
        v_plan.period_unit,
        v_plan.period_count,
        v_period_index
      );
    end loop;

    update public.tryon_subscriptions
    set
      plan_id = v_plan.id,
      pending_plan_id = case when v_switched then null else pending_plan_id end,
      pending_plan_effective_at = case when v_switched then null else pending_plan_effective_at end,
      current_period_start = v_period_start,
      current_period_end = v_period_end,
      grace_ends_at = v_period_end,
      status = 'active',
      expired_at = null,
      updated_at = now()
    where id = v_subscription.id;

    insert into public.tryon_credit_ledger (
      shop_domain, subscription_id, plan_id, entry_type, amount, reason,
      idempotency_key, expires_at, created_by,
      metadata
    ) values (
      v_subscription.shop_domain,
      v_subscription.id,
      v_plan.id,
      'grant',
      v_plan.renders_included,
      'period_grant',
      'period:' || v_subscription.id::text || ':' || v_period_start::text,
      v_period_end,
      'system',
      jsonb_build_object('periodStart', v_period_start)
    ) on conflict (idempotency_key) do nothing;
  elsif not v_plan.is_free and now() >= v_subscription.grace_ends_at then
    update public.tryon_subscriptions
    set status = 'expired', expired_at = v_subscription.grace_ends_at, updated_at = now()
    where id = v_subscription.id;
  elsif not v_plan.is_free and now() >= v_subscription.current_period_end then
    update public.tryon_subscriptions
    set status = 'grace', updated_at = now()
    where id = v_subscription.id;
  end if;

  return v_subscription.id;
end;
$function$;

commit;

-- Rollback: re-apply the previous body from supabase-migration-plans.sql.
