-- G19. Manual delta after plans and Shopify App Pricing. No ledger history rewritten.
-- Preserve job/reversal/idempotency keys. Zero-value refunds explicitly record
-- that no current entitlement could receive credit; they never revive old grants.
begin;
alter table public.tryon_credit_ledger drop constraint if exists tryon_credit_ledger_type_shape_check;
alter table public.tryon_credit_ledger add constraint tryon_credit_ledger_type_shape_check check (
    (entry_type = 'grant' and amount > 0 and source_grant_id is null
      and reverses_entry_id is null and job_id is null and expires_at is not null)
    or
    (entry_type = 'debit' and amount = -1 and source_grant_id is not null
      and reverses_entry_id is null and job_id is not null and expires_at is null)
    or
    (entry_type = 'refund' and ((amount = 1 and source_grant_id is not null) or (amount = 0 and source_grant_id is null))
      and reverses_entry_id is not null and job_id is not null and expires_at is null)
    or
    (entry_type = 'expire' and amount < 0 and source_grant_id is not null
      and reverses_entry_id is null and job_id is null and expires_at is null)
    or
    (entry_type = 'action' and amount = 0 and source_grant_id is null
      and reverses_entry_id is null and job_id is null and expires_at is null)
  );

create or replace function public.finalize_tryon_job(
  p_job_id text,
  p_status text,
  p_provider text default null,
  p_cost_usd numeric default null,
  p_duration_ms integer default null,
  p_message text default null
)
returns text
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_job public.tryon_jobs%rowtype;
  v_debit public.tryon_credit_ledger%rowtype;
  v_refund_grant uuid;
  v_refund_subscription uuid;
begin
  if p_status not in ('completed', 'failed') then
    raise exception 'Invalid terminal try-on status';
  end if;

  -- Serialize with plan changes before taking the existing job lock.
  perform 1 from public.tryon_subscriptions s join public.tryon_jobs j on j.subscription_id=s.id
  where j.id=p_job_id for update of s;

  select j.* into v_job
  from public.tryon_jobs j
  where j.id = p_job_id
  for update;

  if not found then
    raise exception 'Try-on job not found';
  end if;

  if v_job.status in ('completed', 'failed') then
    return v_job.status;
  end if;

  if p_status = 'failed' and v_job.billable then
    select l.* into strict v_debit
    from public.tryon_credit_ledger l
    where l.job_id = p_job_id and l.entry_type = 'debit';

    -- A spent grant is still active; an expired/replaced one is not. Prefer
    -- the original while eligible, otherwise the current plan grant then packs.
    select g.id,g.subscription_id into v_refund_grant,v_refund_subscription
    from public.tryon_credit_ledger g
    join public.tryon_subscriptions s on s.id=g.subscription_id and s.shop_domain=g.shop_domain
    where g.shop_domain=v_debit.shop_domain and g.entry_type='grant'
      and g.expires_at>now() and s.status in ('active','grace') and s.grace_ends_at>now()
      and (g.credit_pack_id is not null or (
        g.plan_id=s.plan_id and g.created_at>=s.current_period_start and g.expires_at=s.current_period_end
        -- A fully spent grant has no expire entry at a pricing change. The
        -- current pricing lease identifies its replacement even in that case.
        and (s.activation_source<>'webhook' or s.external_provider is distinct from 'shopify_app_pricing'
          or s.last_activation_event_id is null
          or g.idempotency_key='shopify-pricing:'||s.external_subscription_id||':'||s.last_activation_event_id)
      ))
      and not exists(select 1 from public.tryon_credit_ledger x where x.source_grant_id=g.id and x.entry_type='expire')
    order by (g.id=v_debit.source_grant_id) desc,(g.credit_pack_id is not null),g.created_at desc,g.id
    limit 1 for update of g;

    insert into public.tryon_credit_ledger (
      shop_domain, subscription_id, job_id, entry_type, amount, reason,
      source_grant_id, reverses_entry_id, idempotency_key, created_by, metadata
    ) values (
      v_debit.shop_domain,
      coalesce(v_refund_subscription,v_debit.subscription_id),
      p_job_id,
      'refund',
      case when v_refund_grant is null then 0 else 1 end,
      case when v_refund_grant is null then 'generation_failure_no_active_grant' else 'generation_failure' end,
      v_refund_grant,
      v_debit.id,
      'refund:' || p_job_id,
      'system',
      jsonb_build_object('credited',v_refund_grant is not null,'original_grant_id',v_debit.source_grant_id,
        'note',case when v_refund_grant is null then 'Refund recorded without credit: no active grant.' else 'Credit restored to an active grant.' end)
    ) on conflict (idempotency_key) do nothing;
  end if;

  update public.tryon_jobs
  set
    status = p_status,
    provider = coalesce(p_provider, provider),
    cost_usd = coalesce(p_cost_usd, cost_usd),
    duration_ms = coalesce(p_duration_ms, duration_ms),
    message = case when p_status='failed' and v_job.billable and v_refund_grant is null
      then concat_ws(' ',p_message,'Refund recorded without credit: no active grant.') else p_message end
  where id = p_job_id;

  return p_status;
end;
$$;

create or replace function public.refund_tryon_credit(p_job_id text)
returns text
language sql
security invoker
set search_path = pg_catalog, public
as $$
  select public.finalize_tryon_job(
    p_job_id,
    'failed',
    null,
    null,
    null,
    'Generation failed before completion.'
  );
$$;
commit;
