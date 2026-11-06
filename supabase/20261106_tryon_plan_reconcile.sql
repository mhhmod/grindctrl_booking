-- Bounded scheduled plan maintenance for Shopify and site:<uuid> tenants.
-- Manual additive delta; review and apply only after the hourly workflow has
-- its existing cleanup secret and application URL configured. No SQL is run
-- automatically by deploying the application.
--
-- Replaces the legacy unbounded pg_cron sweep when that job exists. Does not
-- require or install pg_cron. Paid manual subscriptions NEVER renew without
-- payment: their existing renewal operation still applies pending downgrades.
begin;

-- Attempt time is separate from a successful pricing sync: a permanently
-- failing oldest installation must not starve later installations forever.
alter table public.shopify_installations
  add column if not exists pricing_reconcile_attempted_at timestamptz;

create index if not exists tryon_credit_ledger_expiry_due
  on public.tryon_credit_ledger (expires_at, id)
  where entry_type = 'grant';

create or replace function public.reconcile_tryon_plans(p_limit integer default 100)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
set timezone = 'UTC'
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 100), 500));
  v_due record;
  v_plan public.tryon_plans%rowtype;
  v_index integer;
  v_start timestamptz;
  v_end timestamptz;
  v_subscriptions integer := 0;
  v_rolled_over integer := 0;
  v_grace integer := 0;
  v_expired integer := 0;
  v_cancelled integer := 0;
  v_expired_grants integer := 0;
  v_stale_jobs integer := 0;
  v_inserted integer;
  v_pending public.tryon_plans%rowtype;
  v_switched boolean;
begin
  -- Lock only due subscriptions. SKIP LOCKED lets concurrent runs divide the
  -- work and avoids waiting on reservation or operator renewal transactions.
  for v_due in
    select s.*
    from public.tryon_subscriptions s
    join public.tryon_plans p on p.id = s.plan_id
    join public.tryon_shops sh on sh.shop_domain = s.shop_domain
    where s.status in ('active', 'grace')
      and s.current_period_end <= now()
      and (
        s.cancel_at_period_end
        or (p.is_free and sh.status = 'installed')
        or (not p.is_free and (s.status = 'active' or s.grace_ends_at <= now()))
      )
    order by s.current_period_end, s.id
    limit v_limit
    for update of s skip locked
  loop
    v_subscriptions := v_subscriptions + 1;
    select p.* into strict v_plan from public.tryon_plans p where p.id = v_due.plan_id;

    if v_due.cancel_at_period_end then
      update public.tryon_subscriptions
      set status = 'cancelled', expired_at = v_due.current_period_end, updated_at = now()
      where id = v_due.id;
      v_cancelled := v_cancelled + 1;
    elsif v_plan.is_free then
      -- A scheduled move to another free plan takes effect at the boundary
      -- (same rule as reconcile_tryon_subscription); never into a paid plan.
      v_switched := false;
      if v_due.pending_plan_id is not null and v_due.pending_plan_effective_at <= now() then
        select p.* into v_pending from public.tryon_plans p
        where p.id = v_due.pending_plan_id and p.is_free;
        if found then v_plan := v_pending; v_switched := true; end if;
      end if;
      -- Jump directly to the current anchored period. Calendar arithmetic is
      -- always UTC; Jan 31 clamps in February then returns to March 31. Never
      -- backfill missed grants, including while a tenant was uninstalled.
      if v_plan.period_unit = 'day' then
        v_index := floor(extract(epoch from (now() - v_due.billing_anchor_at))
          / (86400 * v_plan.period_count))::integer;
      else
        v_index := floor((
          (extract(year from now()) - extract(year from v_due.billing_anchor_at)) * 12
          + extract(month from now()) - extract(month from v_due.billing_anchor_at)
        ) / (v_plan.period_count * case when v_plan.period_unit = 'year' then 12 else 1 end))::integer;
      end if;
      v_index := greatest(v_index, 0);
      v_start := public.tryon_period_boundary(v_due.billing_anchor_at,
        v_plan.period_unit, v_plan.period_count, v_index);
      if v_start > now() then
        v_index := greatest(v_index - 1, 0);
        v_start := public.tryon_period_boundary(v_due.billing_anchor_at,
          v_plan.period_unit, v_plan.period_count, v_index);
      end if;
      v_end := public.tryon_period_boundary(v_due.billing_anchor_at,
        v_plan.period_unit, v_plan.period_count, v_index + 1);

      update public.tryon_subscriptions
      set plan_id = v_plan.id,
        pending_plan_id = case when v_switched then null else pending_plan_id end,
        pending_plan_effective_at = case when v_switched then null else pending_plan_effective_at end,
        current_period_start = v_start, current_period_end = v_end,
        grace_ends_at = v_end, status = 'active', expired_at = null, updated_at = now()
      where id = v_due.id;

      insert into public.tryon_credit_ledger (
        shop_domain, subscription_id, plan_id, entry_type, amount, reason,
        idempotency_key, expires_at, created_by, metadata
      ) values (
        v_due.shop_domain, v_due.id, v_plan.id, 'grant', v_plan.renders_included,
        'period_grant', 'period:' || v_due.id::text || ':' || v_start::text,
        v_end, 'system', jsonb_build_object('periodStart', v_start)
      ) on conflict (idempotency_key) do nothing;
      v_rolled_over := v_rolled_over + 1;
    elsif v_due.grace_ends_at <= now() then
      update public.tryon_subscriptions
      set status = 'expired', expired_at = v_due.grace_ends_at, updated_at = now()
      where id = v_due.id;
      v_expired := v_expired + 1;
    else
      update public.tryon_subscriptions
      set status = 'grace', updated_at = now()
      where id = v_due.id;
      v_grace := v_grace + 1;
    end if;
  end loop;

  -- Expiry is bounded separately from lifecycle transitions, and includes
  -- terminal/uninstalled tenants. Subscription expiry freezes live packs;
  -- only the pack's own expires_at closes its remaining balance.
  for v_due in
    select g.id, g.subscription_id
    from public.tryon_credit_ledger g
    join public.tryon_subscriptions s on s.id = g.subscription_id
    where g.entry_type = 'grant' and g.expires_at <= now()
      and not exists (select 1 from public.tryon_credit_ledger e
        where e.source_grant_id = g.id and e.entry_type = 'expire')
      and g.amount + coalesce((select sum(c.amount)
        from public.tryon_credit_ledger c where c.source_grant_id = g.id), 0) > 0
    order by g.expires_at, g.id
    limit v_limit
    for update of s skip locked
  loop
    insert into public.tryon_credit_ledger (
      shop_domain, subscription_id, plan_id, credit_pack_id, entry_type,
      amount, reason, source_grant_id, idempotency_key, created_by
    )
    select g.shop_domain, g.subscription_id, g.plan_id, g.credit_pack_id,
      'expire', -(g.amount + coalesce(sum(c.amount), 0))::integer,
      'credit_expiry', g.id, 'expire:' || g.id::text, 'system'
    from public.tryon_credit_ledger g
    left join public.tryon_credit_ledger c on c.source_grant_id = g.id
    where g.id = v_due.id
    group by g.id
    having g.amount + coalesce(sum(c.amount), 0) > 0
    on conflict (idempotency_key) do nothing;
    get diagnostics v_inserted = row_count;
    v_expired_grants := v_expired_grants + v_inserted;
  end loop;

  -- The superseded cron also refunded abandoned reservations. Preserve that
  -- behavior through the idempotent finalizer in a third independent batch.
  -- A null provider cost preserves unknown spend rather than claiming zero.
  for v_due in
    select j.id from public.tryon_jobs j
    where j.billable and j.status = 'processing'
      and j.created_at < now() - interval '10 minutes'
    order by j.created_at, j.id
    limit v_limit
    for update skip locked
  loop
    perform public.finalize_tryon_job(v_due.id, 'failed', null, null, null,
      'Generation timed out during reconciliation.');
    v_stale_jobs := v_stale_jobs + 1;
  end loop;

  return jsonb_build_object('subscriptions', v_subscriptions,
    'rolledOver', v_rolled_over, 'grace', v_grace, 'expired', v_expired,
    'cancelled', v_cancelled, 'expiredGrants', v_expired_grants,
    'staleJobs', v_stale_jobs);
end;
$$;

revoke all on function public.reconcile_tryon_plans(integer) from public, anon, authenticated;
grant execute on function public.reconcile_tryon_plans(integer) to service_role;

do $$
declare
  v_job bigint;
begin
  if to_regclass('cron.job') is not null then
    for v_job in execute
      'select jobid from cron.job where jobname = ''tryon-daily-reconciliation'''
    loop
      execute 'select cron.unschedule($1)' using v_job;
    end loop;
  end if;
end;
$$;

commit;

-- Rollback: disable the hourly workflow, revoke execution and deploy a forward
-- fix. Preserve subscriptions and append-only ledger entries. Dropping only
-- this function/index is safe if it has no callers; never delete issued grants.
