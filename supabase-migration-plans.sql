-- Try-on plans, subscriptions, credits, and atomic entitlement operations.
-- Review and apply manually in the Supabase SQL editor.

begin;

create table if not exists public.tryon_plans (
  id uuid primary key default extensions.uuid_generate_v4(),
  plan_key text not null unique,
  name text not null,
  description text,
  price_minor bigint not null,
  currency text not null default 'USD',
  renders_included integer not null,
  model_key text not null,
  period_unit text not null default 'month',
  period_count smallint not null default 1,
  grace_days smallint not null default 3,
  is_free boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 0,
  external_refs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tryon_plans_key_check check (
    plan_key = lower(btrim(plan_key)) and plan_key ~ '^[a-z0-9][a-z0-9_-]{1,62}$'
  ),
  constraint tryon_plans_name_check check (char_length(btrim(name)) between 1 and 100),
  constraint tryon_plans_description_check check (
    description is null or char_length(description) <= 500
  ),
  constraint tryon_plans_price_check check (price_minor >= 0),
  constraint tryon_plans_currency_check check (currency ~ '^[A-Z]{3}$'),
  constraint tryon_plans_renders_check check (renders_included > 0),
  constraint tryon_plans_model_check check (model_key in ('lite', 'flash')),
  constraint tryon_plans_period_unit_check check (period_unit in ('day', 'month', 'year')),
  constraint tryon_plans_period_count_check check (period_count > 0),
  constraint tryon_plans_grace_check check (grace_days between 0 and 30),
  constraint tryon_plans_free_price_check check (not is_free or price_minor = 0),
  constraint tryon_plans_external_refs_check check (jsonb_typeof(external_refs) = 'object')
);

create unique index if not exists tryon_plans_one_active_free
  on public.tryon_plans (is_free) where active and is_free;

create table if not exists public.tryon_credit_packs (
  id uuid primary key default extensions.uuid_generate_v4(),
  pack_key text not null unique,
  name text not null,
  price_minor bigint not null,
  currency text not null default 'USD',
  renders integer not null,
  model_key text not null,
  validity_days integer not null default 365,
  active boolean not null default true,
  sort_order integer not null default 0,
  external_refs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tryon_credit_packs_key_check check (
    pack_key = lower(btrim(pack_key)) and pack_key ~ '^[a-z0-9][a-z0-9_-]{1,62}$'
  ),
  constraint tryon_credit_packs_name_check check (char_length(btrim(name)) between 1 and 100),
  constraint tryon_credit_packs_price_check check (price_minor >= 0),
  constraint tryon_credit_packs_currency_check check (currency ~ '^[A-Z]{3}$'),
  constraint tryon_credit_packs_renders_check check (renders > 0),
  constraint tryon_credit_packs_model_check check (model_key in ('lite', 'flash')),
  constraint tryon_credit_packs_validity_check check (validity_days between 1 and 1825),
  constraint tryon_credit_packs_external_refs_check check (jsonb_typeof(external_refs) = 'object')
);

create table if not exists public.tryon_subscriptions (
  id uuid primary key default extensions.uuid_generate_v4(),
  shop_domain text not null unique
    references public.tryon_shops(shop_domain) on update cascade on delete restrict,
  plan_id uuid not null references public.tryon_plans(id) on delete restrict,
  status text not null,
  billing_anchor_at timestamptz not null,
  current_period_start timestamptz not null,
  current_period_end timestamptz not null,
  grace_ends_at timestamptz not null,
  pending_plan_id uuid references public.tryon_plans(id) on delete restrict,
  pending_plan_effective_at timestamptz,
  cancel_at_period_end boolean not null default false,
  activation_source text not null,
  external_provider text,
  external_customer_id text,
  external_subscription_id text,
  last_activation_event_id text,
  last_activation_event_at timestamptz,
  notes text,
  created_by text,
  activated_at timestamptz not null default now(),
  expired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tryon_subscriptions_id_shop_key unique (id, shop_domain),
  constraint tryon_subscriptions_status_check check (
    status in ('active', 'grace', 'expired', 'cancelled')
  ),
  constraint tryon_subscriptions_period_check check (
    billing_anchor_at <= current_period_start
    and current_period_start < current_period_end
    and current_period_end <= grace_ends_at
  ),
  constraint tryon_subscriptions_pending_check check (
    (pending_plan_id is null and pending_plan_effective_at is null)
    or (pending_plan_id is not null and pending_plan_effective_at is not null)
  ),
  constraint tryon_subscriptions_source_check check (
    activation_source in ('manual', 'webhook', 'system')
  ),
  constraint tryon_subscriptions_terminal_check check (
    (status in ('active', 'grace') and expired_at is null)
    or (status in ('expired', 'cancelled') and expired_at is not null)
  ),
  constraint tryon_subscriptions_notes_check check (notes is null or char_length(notes) <= 2000)
);

create unique index if not exists tryon_subscriptions_provider_subscription_key
  on public.tryon_subscriptions (external_provider, external_subscription_id)
  where external_provider is not null and external_subscription_id is not null;

create index if not exists tryon_subscriptions_status_period_end
  on public.tryon_subscriptions (status, current_period_end);

create index if not exists tryon_subscriptions_plan_id
  on public.tryon_subscriptions (plan_id);

create index if not exists tryon_subscriptions_pending_plan_id
  on public.tryon_subscriptions (pending_plan_id)
  where pending_plan_id is not null;

-- Reservation writes 'processing' before the provider runs; the original
-- constraint only allowed terminal states, so every billable job failed on
-- insert. Verified against the live schema.
alter table public.tryon_jobs drop constraint if exists tryon_jobs_status_check;
alter table public.tryon_jobs
  add constraint tryon_jobs_status_check
  check (status = any (array['processing'::text, 'completed'::text, 'failed'::text]));

alter table public.tryon_jobs
  add column if not exists request_key uuid,
  add column if not exists model_key text,
  add column if not exists subscription_id uuid
    references public.tryon_subscriptions(id) on delete restrict,
  add column if not exists billable boolean not null default false;

create unique index if not exists tryon_jobs_shop_request_key
  on public.tryon_jobs (shop, request_key)
  where shop is not null and request_key is not null;

create index if not exists tryon_jobs_subscription_created_at
  on public.tryon_jobs (subscription_id, created_at desc)
  where subscription_id is not null;

create table if not exists public.tryon_credit_ledger (
  id uuid primary key default extensions.uuid_generate_v4(),
  shop_domain text not null,
  subscription_id uuid not null,
  plan_id uuid references public.tryon_plans(id) on delete restrict,
  credit_pack_id uuid references public.tryon_credit_packs(id) on delete restrict,
  job_id text references public.tryon_jobs(id) on delete restrict,
  entry_type text not null,
  amount integer not null,
  reason text not null,
  source_grant_id uuid,
  reverses_entry_id uuid references public.tryon_credit_ledger(id) on delete restrict,
  idempotency_key text not null unique,
  expires_at timestamptz,
  created_by text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint tryon_credit_ledger_id_shop_key unique (id, shop_domain),
  constraint tryon_credit_ledger_subscription_shop_fkey
    foreign key (subscription_id, shop_domain)
    references public.tryon_subscriptions(id, shop_domain) on delete restrict,
  constraint tryon_credit_ledger_source_shop_fkey
    foreign key (source_grant_id, shop_domain)
    references public.tryon_credit_ledger(id, shop_domain) on delete restrict,
  constraint tryon_credit_ledger_catalog_source_check check (
    not (plan_id is not null and credit_pack_id is not null)
  ),
  constraint tryon_credit_ledger_type_shape_check check (
    (entry_type = 'grant' and amount > 0 and source_grant_id is null
      and reverses_entry_id is null and job_id is null and expires_at is not null)
    or
    (entry_type = 'debit' and amount = -1 and source_grant_id is not null
      and reverses_entry_id is null and job_id is not null and expires_at is null)
    or
    (entry_type = 'refund' and amount = 1 and source_grant_id is not null
      and reverses_entry_id is not null and job_id is not null and expires_at is null)
    or
    (entry_type = 'expire' and amount < 0 and source_grant_id is not null
      and reverses_entry_id is null and job_id is null and expires_at is null)
    or
    (entry_type = 'action' and amount = 0 and source_grant_id is null
      and reverses_entry_id is null and job_id is null and expires_at is null)
  ),
  constraint tryon_credit_ledger_reason_check check (
    reason = lower(btrim(reason)) and reason ~ '^[a-z0-9][a-z0-9_-]{1,63}$'
  ),
  constraint tryon_credit_ledger_idempotency_check check (
    char_length(idempotency_key) between 1 and 200
  ),
  constraint tryon_credit_ledger_metadata_check check (jsonb_typeof(metadata) = 'object')
);

create unique index if not exists tryon_credit_ledger_one_debit_per_job
  on public.tryon_credit_ledger (job_id) where entry_type = 'debit';

create unique index if not exists tryon_credit_ledger_one_refund_per_job
  on public.tryon_credit_ledger (job_id) where entry_type = 'refund';

create unique index if not exists tryon_credit_ledger_one_reversal
  on public.tryon_credit_ledger (reverses_entry_id)
  where reverses_entry_id is not null;

create unique index if not exists tryon_credit_ledger_one_expiry_per_grant
  on public.tryon_credit_ledger (source_grant_id) where entry_type = 'expire';

create index if not exists tryon_credit_ledger_shop_created_at
  on public.tryon_credit_ledger (shop_domain, created_at desc);

create index if not exists tryon_credit_ledger_grant_children
  on public.tryon_credit_ledger (source_grant_id) where source_grant_id is not null;

create index if not exists tryon_credit_ledger_subscription_grants
  on public.tryon_credit_ledger (subscription_id, expires_at)
  where entry_type = 'grant';

create index if not exists tryon_credit_ledger_plan_id
  on public.tryon_credit_ledger (plan_id) where plan_id is not null;

create index if not exists tryon_credit_ledger_credit_pack_id
  on public.tryon_credit_ledger (credit_pack_id) where credit_pack_id is not null;

create index if not exists tryon_credit_ledger_action_key
  on public.tryon_credit_ledger ((metadata ->> 'actionKey'))
  where entry_type in ('grant', 'action');

insert into public.tryon_plans (
  plan_key, name, description, price_minor, currency, renders_included,
  model_key, period_unit, period_count, grace_days, is_free, active, sort_order
) values
  ('free-v1', 'Free', null, 0, 'USD', 20, 'lite', 'month', 1, 0, true, true, 10),
  ('launch-v1', 'Launch', null, 1500, 'USD', 300, 'lite', 'month', 1, 3, false, true, 20),
  ('dfy-v1', 'Done-for-you', 'Includes theme setup, brand tuning, and a monthly check-in.', 5900, 'USD', 450, 'flash', 'month', 1, 3, false, true, 30)
on conflict (plan_key) do nothing;

insert into public.tryon_credit_packs (
  pack_key, name, price_minor, currency, renders, model_key, validity_days, active, sort_order
) values
  ('pack-lite-v1', 'Boost 80', 500, 'USD', 80, 'lite', 365, true, 10),
  ('pack-flash-v1', 'Boost 75 Pro', 1000, 'USD', 75, 'flash', 365, true, 20)
on conflict (pack_key) do nothing;

create or replace function public.tryon_period_boundary(
  p_anchor timestamptz,
  p_period_unit text,
  p_period_count integer,
  p_period_index integer
)
returns timestamptz
language plpgsql
immutable
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_anchor timestamp := p_anchor at time zone 'UTC';
  v_month timestamp;
  v_last_day integer;
  v_day integer;
begin
  if p_period_index < 0 or p_period_count < 1 then
    raise exception 'Invalid try-on period arguments';
  end if;

  if p_period_unit = 'day' then
    return p_anchor + make_interval(days => p_period_count * p_period_index);
  end if;

  if p_period_unit not in ('month', 'year') then
    raise exception 'Invalid try-on period unit';
  end if;

  v_month := date_trunc('month', v_anchor) + make_interval(
    months => p_period_count * p_period_index * case when p_period_unit = 'year' then 12 else 1 end
  );
  v_last_day := extract(day from (v_month + interval '1 month - 1 day'))::integer;
  v_day := least(extract(day from v_anchor)::integer, v_last_day);

  return (
    v_month
    + make_interval(days => v_day - 1)
    + (v_anchor - date_trunc('day', v_anchor))
  ) at time zone 'UTC';
end;
$$;

create or replace function public.reject_tryon_credit_ledger_mutation()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  raise exception 'tryon_credit_ledger is append-only';
end;
$$;

create or replace function public.protect_referenced_tryon_plan()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if exists (select 1 from public.tryon_subscriptions where plan_id = old.id)
    and row(
      new.plan_key, new.name, new.description, new.price_minor, new.currency,
      new.renders_included, new.model_key, new.period_unit, new.period_count,
      new.grace_days, new.is_free
    ) is distinct from row(
      old.plan_key, old.name, old.description, old.price_minor, old.currency,
      old.renders_included, old.model_key, old.period_unit, old.period_count,
      old.grace_days, old.is_free
    ) then
    raise exception 'Referenced try-on plan terms are immutable';
  end if;

  return new;
end;
$$;

create or replace function public.protect_referenced_tryon_credit_pack()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if exists (select 1 from public.tryon_credit_ledger where credit_pack_id = old.id)
    and row(
      new.pack_key, new.name, new.price_minor, new.currency,
      new.renders, new.model_key, new.validity_days
    ) is distinct from row(
      old.pack_key, old.name, old.price_minor, old.currency,
      old.renders, old.model_key, old.validity_days
    ) then
    raise exception 'Referenced try-on pack terms are immutable';
  end if;

  return new;
end;
$$;

drop trigger if exists tryon_credit_ledger_no_update_or_delete on public.tryon_credit_ledger;
create trigger tryon_credit_ledger_no_update_or_delete
before update or delete on public.tryon_credit_ledger
for each row execute function public.reject_tryon_credit_ledger_mutation();

drop trigger if exists tryon_plans_protect_referenced on public.tryon_plans;
create trigger tryon_plans_protect_referenced
before update on public.tryon_plans
for each row execute function public.protect_referenced_tryon_plan();

drop trigger if exists tryon_credit_packs_protect_referenced on public.tryon_credit_packs;
create trigger tryon_credit_packs_protect_referenced
before update on public.tryon_credit_packs
for each row execute function public.protect_referenced_tryon_credit_pack();

create or replace function public.reconcile_tryon_subscription(p_shop_domain text)
returns uuid
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_subscription public.tryon_subscriptions%rowtype;
  v_plan public.tryon_plans%rowtype;
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
$$;

create or replace function public.ensure_free_tryon_subscription(p_shop_domain text)
returns uuid
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_shop_domain text := lower(btrim(p_shop_domain));
  v_shop_status text;
  v_subscription_id uuid;
  v_plan public.tryon_plans%rowtype;
  v_period_start timestamptz := now();
  v_period_end timestamptz;
begin
  select status into v_shop_status
  from public.tryon_shops
  where shop_domain = v_shop_domain
  for update;

  if not found or v_shop_status <> 'installed' then
    raise exception 'TRYON_UNAVAILABLE: shop is not installed';
  end if;

  select id into v_subscription_id
  from public.tryon_subscriptions
  where shop_domain = v_shop_domain;

  if found then
    perform public.reconcile_tryon_subscription(v_shop_domain);
    return v_subscription_id;
  end if;

  select p.* into strict v_plan
  from public.tryon_plans p
  where p.active and p.is_free;

  v_period_end := public.tryon_period_boundary(
    v_period_start,
    v_plan.period_unit,
    v_plan.period_count,
    1
  );
  v_subscription_id := extensions.uuid_generate_v4();

  insert into public.tryon_subscriptions (
    id, shop_domain, plan_id, status, billing_anchor_at,
    current_period_start, current_period_end, grace_ends_at,
    activation_source, created_by
  ) values (
    v_subscription_id, v_shop_domain, v_plan.id, 'active', v_period_start,
    v_period_start, v_period_end, v_period_end,
    'system', 'system'
  );

  insert into public.tryon_credit_ledger (
    shop_domain, subscription_id, plan_id, entry_type, amount, reason,
    idempotency_key, expires_at, created_by,
    metadata
  ) values (
    v_shop_domain,
    v_subscription_id,
    v_plan.id,
    'grant',
    v_plan.renders_included,
    'initial_grant',
    'period:' || v_subscription_id::text || ':' || v_period_start::text,
    v_period_end,
    'system',
    jsonb_build_object('periodStart', v_period_start)
  );

  return v_subscription_id;
end;
$$;

create or replace function public.reserve_tryon_credit(
  p_shop_domain text,
  p_job_id text,
  p_request_key uuid,
  p_session_id text,
  p_product_id text,
  p_model_key text
)
returns table (
  job_id text,
  created boolean,
  job_status text,
  recorded_model_key text,
  job_message text,
  job_provider text,
  job_cost_usd numeric,
  job_duration_ms integer,
  job_created_at timestamptz
)
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_shop_domain text := lower(btrim(p_shop_domain));
  v_subscription public.tryon_subscriptions%rowtype;
  v_grant_id uuid;
begin
  if p_request_key is null or char_length(btrim(p_job_id)) = 0 then
    raise exception 'Invalid try-on reservation identifiers';
  end if;

  return query
  select j.id, false, j.status, j.model_key, j.message, j.provider,
    j.cost_usd, j.duration_ms, j.created_at
  from public.tryon_jobs j
  where j.shop = v_shop_domain and j.request_key = p_request_key;
  if found then
    return;
  end if;

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
    raise exception 'TRYON_UNAVAILABLE: subscription is not eligible';
  end if;

  return query
  select j.id, false, j.status, j.model_key, j.message, j.provider,
    j.cost_usd, j.duration_ms, j.created_at
  from public.tryon_jobs j
  where j.shop = v_shop_domain and j.request_key = p_request_key;
  if found then
    return;
  end if;

  select g.id into v_grant_id
  from public.tryon_credit_ledger g
  left join public.tryon_credit_ledger c on c.source_grant_id = g.id
  where g.subscription_id = v_subscription.id
    and g.entry_type = 'grant'
    and g.expires_at > now()
  group by g.id, g.credit_pack_id, g.expires_at, g.created_at
  having g.amount + coalesce(sum(c.amount), 0) > 0
  order by (g.credit_pack_id is not null), g.expires_at, g.created_at
  limit 1;

  if v_grant_id is null then
    raise exception 'TRYON_UNAVAILABLE: no credits remain';
  end if;

  insert into public.tryon_jobs (
    id, session_id, product_id, shop, status, request_key,
    model_key, subscription_id, billable
  ) values (
    p_job_id, p_session_id, p_product_id, v_shop_domain, 'processing', p_request_key,
    p_model_key, v_subscription.id, true
  );

  insert into public.tryon_credit_ledger (
    shop_domain, subscription_id, job_id, entry_type, amount, reason,
    source_grant_id, idempotency_key, created_by,
    metadata
  ) values (
    v_shop_domain,
    v_subscription.id,
    p_job_id,
    'debit',
    -1,
    'generation_reservation',
    v_grant_id,
    'debit:' || p_job_id,
    'system',
    jsonb_build_object('requestKey', p_request_key, 'modelKey', p_model_key)
  );

  return query
  select j.id, true, j.status, j.model_key, j.message, j.provider,
    j.cost_usd, j.duration_ms, j.created_at
  from public.tryon_jobs j
  where j.id = p_job_id;
end;
$$;

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
begin
  if p_status not in ('completed', 'failed') then
    raise exception 'Invalid terminal try-on status';
  end if;

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

    insert into public.tryon_credit_ledger (
      shop_domain, subscription_id, job_id, entry_type, amount, reason,
      source_grant_id, reverses_entry_id, idempotency_key, created_by
    ) values (
      v_debit.shop_domain,
      v_debit.subscription_id,
      p_job_id,
      'refund',
      1,
      'generation_failure',
      v_debit.source_grant_id,
      v_debit.id,
      'refund:' || p_job_id,
      'system'
    ) on conflict (idempotency_key) do nothing;
  end if;

  update public.tryon_jobs
  set
    status = p_status,
    provider = coalesce(p_provider, provider),
    cost_usd = coalesce(p_cost_usd, cost_usd),
    duration_ms = coalesce(p_duration_ms, duration_ms),
    message = p_message
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

create or replace function public.get_tryon_owner_action_replay(p_action_key uuid)
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'actionKey', p_action_key,
    'replayed', true,
    'ledgerEntryIds', jsonb_agg(
      l.id order by case when l.entry_type = 'grant' then 0 else 1 end, l.created_at, l.id
    )
  )
  from public.tryon_credit_ledger l
  where l.metadata ->> 'actionKey' = p_action_key::text
  having count(*) > 0;
$$;

create or replace function public.activate_tryon_plan(
  p_shop_domain text,
  p_plan_key text,
  p_note text,
  p_action_key uuid
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
      'manual', nullif(btrim(p_note), ''), 'owner'
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
      'owner',
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
    'owner',
    jsonb_build_object('actionKey', p_action_key, 'planKey', p_plan_key, 'note', coalesce(p_note, ''))
  ) returning id into v_action_id;

  return jsonb_build_object(
    'actionKey', p_action_key,
    'replayed', false,
    'ledgerEntryIds', to_jsonb(array_remove(array[v_grant_id, v_action_id], null))
  );
end;
$$;

create or replace function public.renew_tryon_plan(
  p_shop_domain text,
  p_note text,
  p_action_key uuid
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
    'owner',
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
    'owner',
    jsonb_build_object('actionKey', p_action_key, 'note', coalesce(p_note, ''))
  ) returning id into v_action_id;

  return jsonb_build_object(
    'actionKey', p_action_key,
    'replayed', false,
    'ledgerEntryIds', to_jsonb(array[v_grant_id, v_action_id])
  );
end;
$$;

create or replace function public.apply_tryon_top_up(
  p_shop_domain text,
  p_pack_key text,
  p_note text,
  p_action_key uuid
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
    'owner',
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
    'owner',
    jsonb_build_object('actionKey', p_action_key, 'packKey', p_pack_key, 'note', coalesce(p_note, ''))
  ) returning id into v_action_id;

  return jsonb_build_object(
    'actionKey', p_action_key,
    'replayed', false,
    'ledgerEntryIds', to_jsonb(array[v_grant_id, v_action_id])
  );
end;
$$;

create or replace function public.schedule_tryon_downgrade(
  p_shop_domain text,
  p_plan_key text,
  p_action_key uuid
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
    'owner',
    jsonb_build_object('actionKey', p_action_key, 'planKey', p_plan_key)
  ) returning id into v_action_id;

  return jsonb_build_object(
    'actionKey', p_action_key,
    'replayed', false,
    'ledgerEntryIds', jsonb_build_array(v_action_id)
  );
end;
$$;

create or replace function public.reconcile_tryon_entitlements()
returns integer
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_subscription record;
  v_job record;
  v_count integer := 0;
begin
  for v_subscription in
    select shop_domain from public.tryon_subscriptions order by shop_domain
  loop
    perform public.reconcile_tryon_subscription(v_subscription.shop_domain);
    v_count := v_count + 1;
  end loop;

  for v_job in
    select id
    from public.tryon_jobs
    where billable and status = 'processing' and created_at < now() - interval '10 minutes'
  loop
    perform public.finalize_tryon_job(
      v_job.id, 'failed', null, null, null, 'Generation timed out during reconciliation.'
    );
  end loop;

  return v_count;
end;
$$;

alter table public.tryon_plans enable row level security;
alter table public.tryon_credit_packs enable row level security;
alter table public.tryon_subscriptions enable row level security;
alter table public.tryon_credit_ledger enable row level security;
alter table public.tryon_jobs enable row level security;

revoke all on table public.tryon_plans from public, anon, authenticated;
revoke all on table public.tryon_credit_packs from public, anon, authenticated;
revoke all on table public.tryon_subscriptions from public, anon, authenticated;
revoke all on table public.tryon_credit_ledger from public, anon, authenticated;
revoke all on table public.tryon_jobs from public, anon, authenticated;

grant select, insert, update on table public.tryon_plans to service_role;
grant select, insert, update on table public.tryon_credit_packs to service_role;
grant select, insert, update on table public.tryon_subscriptions to service_role;
grant select, insert on table public.tryon_credit_ledger to service_role;
grant select, insert, update on table public.tryon_jobs to service_role;

revoke execute on function public.tryon_period_boundary(timestamptz, text, integer, integer)
  from public, anon, authenticated;
revoke execute on function public.reject_tryon_credit_ledger_mutation()
  from public, anon, authenticated;
revoke execute on function public.protect_referenced_tryon_plan()
  from public, anon, authenticated;
revoke execute on function public.protect_referenced_tryon_credit_pack()
  from public, anon, authenticated;
revoke execute on function public.reconcile_tryon_subscription(text)
  from public, anon, authenticated;
revoke execute on function public.ensure_free_tryon_subscription(text)
  from public, anon, authenticated;
revoke execute on function public.reserve_tryon_credit(text, text, uuid, text, text, text)
  from public, anon, authenticated;
revoke execute on function public.finalize_tryon_job(text, text, text, numeric, integer, text)
  from public, anon, authenticated;
revoke execute on function public.refund_tryon_credit(text)
  from public, anon, authenticated;
revoke execute on function public.get_tryon_owner_action_replay(uuid)
  from public, anon, authenticated;
revoke execute on function public.activate_tryon_plan(text, text, text, uuid)
  from public, anon, authenticated;
revoke execute on function public.renew_tryon_plan(text, text, uuid)
  from public, anon, authenticated;
revoke execute on function public.apply_tryon_top_up(text, text, text, uuid)
  from public, anon, authenticated;
revoke execute on function public.schedule_tryon_downgrade(text, text, uuid)
  from public, anon, authenticated;
revoke execute on function public.reconcile_tryon_entitlements()
  from public, anon, authenticated;

grant execute on function public.tryon_period_boundary(timestamptz, text, integer, integer)
  to service_role;
grant execute on function public.reconcile_tryon_subscription(text) to service_role;
grant execute on function public.ensure_free_tryon_subscription(text) to service_role;
grant execute on function public.reserve_tryon_credit(text, text, uuid, text, text, text)
  to service_role;
grant execute on function public.finalize_tryon_job(text, text, text, numeric, integer, text)
  to service_role;
grant execute on function public.refund_tryon_credit(text) to service_role;
grant execute on function public.get_tryon_owner_action_replay(uuid) to service_role;
grant execute on function public.activate_tryon_plan(text, text, text, uuid) to service_role;
grant execute on function public.renew_tryon_plan(text, text, uuid) to service_role;
grant execute on function public.apply_tryon_top_up(text, text, text, uuid) to service_role;
grant execute on function public.schedule_tryon_downgrade(text, text, uuid) to service_role;
grant execute on function public.reconcile_tryon_entitlements() to service_role;

commit;

-- Rollback before live ledger writes only:
-- begin;
-- drop function if exists public.reconcile_tryon_entitlements();
-- drop function if exists public.schedule_tryon_downgrade(text, text, uuid);
-- drop function if exists public.apply_tryon_top_up(text, text, text, uuid);
-- drop function if exists public.renew_tryon_plan(text, text, uuid);
-- drop function if exists public.activate_tryon_plan(text, text, text, uuid);
-- drop function if exists public.refund_tryon_credit(text);
-- drop function if exists public.get_tryon_owner_action_replay(uuid);
-- drop function if exists public.finalize_tryon_job(text, text, text, numeric, integer, text);
-- drop function if exists public.reserve_tryon_credit(text, text, uuid, text, text, text);
-- drop function if exists public.ensure_free_tryon_subscription(text);
-- drop function if exists public.reconcile_tryon_subscription(text);
-- drop trigger if exists tryon_plans_protect_referenced on public.tryon_plans;
-- drop trigger if exists tryon_credit_packs_protect_referenced on public.tryon_credit_packs;
-- drop trigger if exists tryon_credit_ledger_no_update_or_delete on public.tryon_credit_ledger;
-- drop function if exists public.protect_referenced_tryon_credit_pack();
-- drop function if exists public.protect_referenced_tryon_plan();
-- drop function if exists public.reject_tryon_credit_ledger_mutation();
-- drop function if exists public.tryon_period_boundary(timestamptz, text, integer, integer);
-- drop table if exists public.tryon_credit_ledger;
-- drop index if exists public.tryon_jobs_subscription_created_at;
-- drop index if exists public.tryon_jobs_shop_request_key;
-- alter table public.tryon_jobs drop column if exists billable;
-- alter table public.tryon_jobs drop column if exists subscription_id;
-- alter table public.tryon_jobs drop column if exists model_key;
-- alter table public.tryon_jobs drop column if exists request_key;
-- drop table if exists public.tryon_subscriptions;
-- drop table if exists public.tryon_credit_packs;
-- drop table if exists public.tryon_plans;
-- commit;
