-- Launch state per store, and free test looks (v16 N5 and N6, phase zero
-- item 9).
--
-- store_launch: setup, preview, live or holdout for each Shopify store.
-- While a store is in setup or preview only its owner, holding a signed
-- preview link, sees Try it on and Store Chat on the storefront. Holdout
-- shows both to one share of visitors and hides them from the rest, each
-- visitor bucketed once from their id and this row's salt, until
-- holdout_ends_at, when the store counts as live. A store with no row is
-- live, as every store is today. The app reads this only while the store's
-- n5_preview_mode (and, for holdout, n6_holdout) flag is on.
--
-- Test looks: a look started from the owner's preview link is a test look.
-- reserve_tryon_test_look records the job with is_test = true and never
-- touches the credit ledger, so the merchant's looks are not spent, and it
-- refuses once the store has used its test looks for the day (UTC). Test
-- looks are left out of every number.
--
-- Read and written only through the app's service role. Idempotent: safe to
-- run more than once. Apply by hand in the Supabase SQL editor; nothing here
-- runs automatically. Needs supabase-migration-shops.sql and
-- supabase-migration-plans.sql (tryon_shops, tryon_jobs with request_key,
-- model_key, subscription_id and billable).

create table if not exists public.store_launch (
  shop_domain text primary key,
  state text not null default 'setup',
  holdout_share numeric(4, 3),
  holdout_started_at timestamptz,
  holdout_ends_at timestamptz,
  salt text not null default replace(gen_random_uuid()::text, '-', ''),
  updated_by text,
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.store_launch'::regclass and conname = 'store_launch_state_check'
  ) then
    alter table public.store_launch
      add constraint store_launch_state_check
      check (state in ('setup', 'preview', 'live', 'holdout'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.store_launch'::regclass and conname = 'store_launch_shop_domain_shape'
  ) then
    alter table public.store_launch
      add constraint store_launch_shop_domain_shape
      check (shop_domain ~ '^[a-z0-9][a-z0-9-]*\.myshopify\.com$');
  end if;

  -- A holdout names its share (the part that does NOT see GrindCTRL) and
  -- its window; any other state carries none of them.
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.store_launch'::regclass and conname = 'store_launch_holdout_shape'
  ) then
    alter table public.store_launch
      add constraint store_launch_holdout_shape
      check (
        (state = 'holdout'
          and holdout_share > 0 and holdout_share < 1
          and holdout_started_at is not null
          and holdout_ends_at > holdout_started_at)
        or (state <> 'holdout'
          and holdout_share is null
          and holdout_started_at is null
          and holdout_ends_at is null)
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.store_launch'::regclass and conname = 'store_launch_salt_shape'
  ) then
    alter table public.store_launch
      add constraint store_launch_salt_shape
      check (salt ~ '^[0-9a-f]{32}$');
  end if;
end $$;

alter table public.tryon_jobs
  add column if not exists is_test boolean not null default false;

create index if not exists tryon_jobs_shop_test_created_at
  on public.tryon_jobs (shop, created_at desc)
  where is_test;

create table if not exists public.tryon_test_looks_daily (
  shop_domain text not null,
  day date not null,
  used integer not null default 0,
  primary key (shop_domain, day)
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.tryon_test_looks_daily'::regclass and conname = 'tryon_test_looks_daily_used_check'
  ) then
    alter table public.tryon_test_looks_daily
      add constraint tryon_test_looks_daily_used_check check (used >= 0);
  end if;
end $$;

create or replace function public.reserve_tryon_test_look(
  p_shop_domain text,
  p_job_id text,
  p_request_key uuid,
  p_session_id text,
  p_product_id text,
  p_cap integer
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
  v_used integer;
begin
  if p_request_key is null or char_length(btrim(p_job_id)) = 0 or p_cap is null or p_cap < 1 then
    raise exception 'Invalid test look reservation';
  end if;

  -- The same attempt again answers with the job it already made.
  return query
  select j.id, false, j.status, j.model_key, j.message, j.provider,
    j.cost_usd, j.duration_ms, j.created_at
  from public.tryon_jobs j
  where j.shop = v_shop_domain and j.request_key = p_request_key;
  if found then
    return;
  end if;

  if not exists (
    select 1 from public.tryon_shops sh
    where sh.shop_domain = v_shop_domain and sh.status = 'installed'
  ) then
    raise exception 'TRYON_UNAVAILABLE: shop is not installed';
  end if;

  insert into public.tryon_test_looks_daily as d (shop_domain, day, used)
  values (v_shop_domain, (now() at time zone 'utc')::date, 1)
  on conflict (shop_domain, day) do update
    set used = d.used + 1
    where d.used < p_cap
  returning d.used into v_used;

  if v_used is null then
    raise exception 'TRYON_TEST_CAP: test looks for today are used up';
  end if;

  insert into public.tryon_jobs (
    id, session_id, product_id, shop, status, request_key,
    model_key, subscription_id, billable, is_test
  ) values (
    p_job_id, p_session_id, p_product_id, v_shop_domain, 'processing', p_request_key,
    'test', null, false, true
  );

  return query
  select j.id, true, j.status, j.model_key, j.message, j.provider,
    j.cost_usd, j.duration_ms, j.created_at
  from public.tryon_jobs j
  where j.id = p_job_id;
end;
$$;

alter table public.store_launch enable row level security;
alter table public.tryon_test_looks_daily enable row level security;
revoke all on table public.store_launch from public, anon, authenticated;
revoke all on table public.tryon_test_looks_daily from public, anon, authenticated;
grant select, insert, update, delete on table public.store_launch to service_role;
grant select, insert, update on table public.tryon_test_looks_daily to service_role;
revoke execute on function public.reserve_tryon_test_look(text, text, uuid, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.reserve_tryon_test_look(text, text, uuid, text, text, integer)
  to service_role;

comment on table public.store_launch is
  'Launch state per Shopify store (N5, N6): setup, preview, live or holdout. No row means live.';
comment on table public.tryon_test_looks_daily is
  'Test looks used per store per UTC day (N5). Test looks never touch the credit ledger.';
