-- Manual additive delta. No billing mutations and no separate entitlement account.
-- Requires the existing plan catalog and Shopify installation isolation migrations.
-- Only the trusted server registry may select distribution=public. Browser roles
-- cannot execute this function or read the installation's cached metadata.
begin;

update public.tryon_plans p
set external_refs = jsonb_set(p.external_refs, '{shopify_app_pricing}',
      coalesce(p.external_refs->'shopify_app_pricing', '{}'::jsonb)
        || jsonb_build_object('handle', refs.handle)),
    updated_at = now()
from (values ('free-v2','free'), ('launch-v1','launch'),
             ('growth-v1','growth'), ('pro-v1','pro')) refs(plan_key,handle)
where p.plan_key=refs.plan_key and p.currency='USD'
  and p.external_refs #>> '{shopify_app_pricing,handle}' is distinct from refs.handle;

alter table public.shopify_installations
  add column if not exists pricing_lease_id uuid,
  add column if not exists pricing_lease_expires_at timestamptz,
  add column if not exists pricing_lease_authorized_at timestamptz,
  add column if not exists pricing_synced_at timestamptz,
  add column if not exists pricing_app_handle text;

create or replace function public.shopify_app_pricing_operation(
  p_installation uuid, p_operation text, p_lease uuid, p_payload jsonb default '{}'::jsonb
) returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare
  i public.shopify_installations;
  s public.tryon_subscriptions;
  p public.tryon_plans;
  period_start timestamptz;
  period_end timestamptz;
  used_looks bigint;
  allowance integer;
  changed boolean;
  app_handle text;
begin
  if p_payload->>'distribution' is distinct from 'public' then
    return jsonb_build_object('status','ignored');
  end if;
  if p_lease is null then raise exception 'pricing_lease_required'; end if;
  select * into i from public.shopify_installations where id=p_installation;
  if not found then raise exception 'pricing_installation_unavailable'; end if;
  -- Same lock order as installation lifecycle: shop, installation, merchant,
  -- subscription. A reinstall/uninstall cannot race a snapshot application.
  perform pg_advisory_xact_lock(hashtextextended('shopify:' || i.shop_domain,0));
  select * into i from public.shopify_installations where id=p_installation for update;

  if p_operation='release' then
    update public.shopify_installations set pricing_lease_id=null,
      pricing_lease_expires_at=null,pricing_lease_authorized_at=null
      where id=i.id and pricing_lease_id=p_lease;
    return jsonb_build_object('ok',true);
  end if;
  if i.status<>'active' or i.access_token_ciphertext is null or i.authorized_at is null then
    raise exception 'pricing_installation_unavailable';
  end if;

  if p_operation='claim' then
    if i.pricing_lease_id is not null and i.pricing_lease_expires_at>clock_timestamp() then
      return jsonb_build_object('status','busy','app_handle',i.pricing_app_handle);
    end if;
    if coalesce((p_payload->>'force')::boolean,false)=false
      and i.pricing_synced_at>clock_timestamp()-interval '60 seconds'
      and i.pricing_synced_at>=i.authorized_at then
      return jsonb_build_object('status','throttled','app_handle',i.pricing_app_handle);
    end if;
    update public.shopify_installations set pricing_lease_id=p_lease,
      pricing_lease_expires_at=clock_timestamp()+interval '60 seconds',
      pricing_lease_authorized_at=i.authorized_at where id=i.id;
    return jsonb_build_object('status','acquired','app_handle',i.pricing_app_handle);
  end if;
  if p_operation<>'apply' then raise exception 'unknown_pricing_operation'; end if;
  if i.pricing_lease_id is distinct from p_lease
    or i.pricing_lease_expires_at<=clock_timestamp()
    or i.pricing_lease_authorized_at is distinct from i.authorized_at then
    raise exception 'pricing_lease_lost';
  end if;

  select * into p from public.tryon_plans
    where plan_key=p_payload->>'plan_key' and currency='USD' and active
      and plan_key in ('free-v2','launch-v1','growth-v1','pro-v1')
      and external_refs #>> '{shopify_app_pricing,handle}' in ('free','launch','growth','pro');
  if not found then raise exception 'pricing_plan_unmapped'; end if;
  app_handle:=nullif(p_payload->>'app_handle','');
  if app_handle is not null and app_handle !~ '^[a-z0-9][a-z0-9-]{0,199}$' then
    raise exception 'pricing_app_handle_invalid';
  end if;
  if not p.is_free then
    period_end:=(p_payload->>'current_period_end')::timestamptz;
    if period_end is null or period_end<=now() then raise exception 'pricing_period_invalid'; end if;
  end if;

  -- Reuse setup/expiry/free-renewal and the canonical subscription + ledger.
  perform public.ensure_free_tryon_subscription(i.shop_domain);
  select * into strict s from public.tryon_subscriptions where shop_domain=i.shop_domain for update;
  period_start:=s.current_period_start;
  if s.current_period_end<=now() then
    period_start:=now();
  end if;
  if p.is_free then
    period_end:=case when s.current_period_end>now() then s.current_period_end
      else public.tryon_period_boundary(period_start,p.period_unit,p.period_count,1) end;
  end if;
  changed:=s.plan_id<>p.id or s.current_period_start<>period_start
    or s.current_period_end<>period_end or s.status<>'active';

  if changed then
    -- Keep usage across changes within a period: downgrading and upgrading
    -- again cannot mint the allowance twice. Packs remain untouched.
    select greatest(0,-coalesce(sum(c.amount),0)) into used_looks
      from public.tryon_credit_ledger c
      join public.tryon_credit_ledger g on g.id=c.source_grant_id
      where c.subscription_id=s.id and c.entry_type in ('debit','refund')
        and g.plan_id is not null and g.credit_pack_id is null
        and g.created_at>=period_start and c.created_at>=period_start;
    allowance:=greatest(0,p.renders_included-used_looks)::integer;
    insert into public.tryon_credit_ledger
      (shop_domain,subscription_id,plan_id,entry_type,amount,reason,
       source_grant_id,idempotency_key,created_by,metadata)
    select g.shop_domain,g.subscription_id,g.plan_id,'expire',
      -(g.amount+coalesce(sum(c.amount),0))::integer,'shopify_plan_change',
      g.id,'expire:' || g.id::text,'shopify_app_pricing',jsonb_build_object('installationId',i.id)
    from public.tryon_credit_ledger g
    left join public.tryon_credit_ledger c on c.source_grant_id=g.id
    where g.subscription_id=s.id and g.entry_type='grant'
      and g.plan_id is not null and g.credit_pack_id is null
    group by g.id having g.amount+coalesce(sum(c.amount),0)>0
    on conflict (idempotency_key) do nothing;

    if allowance>0 then
      insert into public.tryon_credit_ledger
        (shop_domain,subscription_id,plan_id,entry_type,amount,reason,
         idempotency_key,expires_at,created_by,metadata)
      values(i.shop_domain,s.id,p.id,'grant',allowance,'shopify_plan_grant',
        'shopify-pricing:' || i.id::text || ':' || p_lease::text,period_end,
        'shopify_app_pricing',jsonb_build_object('installationId',i.id,'periodStart',period_start));
    end if;
  end if;

  update public.tryon_subscriptions set plan_id=p.id,status='active',
    billing_anchor_at=case when p.is_free then period_start else least(billing_anchor_at,period_start) end,
    current_period_start=period_start,current_period_end=period_end,
    grace_ends_at=period_end,pending_plan_id=null,pending_plan_effective_at=null,
    cancel_at_period_end=false,activation_source='webhook',external_provider='shopify_app_pricing',
    external_customer_id=i.shop_domain,external_subscription_id=i.id::text,
    last_activation_event_id=case when changed then p_lease::text else last_activation_event_id end,
    last_activation_event_at=case when changed then clock_timestamp() else last_activation_event_at end,
    expired_at=null,updated_at=clock_timestamp()
    where id=s.id;
  update public.shopify_installations set pricing_synced_at=clock_timestamp(),
    pricing_app_handle=app_handle,pricing_lease_id=null,pricing_lease_expires_at=null,
    pricing_lease_authorized_at=null where id=i.id;
  return jsonb_build_object('status',case when changed then 'applied' else 'unchanged' end,
    'plan_key',p.plan_key,'app_handle',app_handle);
end $$;

revoke all on function public.shopify_app_pricing_operation(uuid,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.shopify_app_pricing_operation(uuid,text,uuid,jsonb) to service_role;

commit;
