-- Pin the active plan's provider model inside the credit reservation transaction.
-- The foundation already has tryon_jobs.model_key; no new job column is needed.
-- Catalog tier labels are retained: changing a referenced catalog row would
-- violate the commercial versioning policy. Keep this mapping in agreement with
-- apps/web-next/lib/try-on/models.ts. The service independently validates the
-- returned key before any provider request.
--
-- Additive except widening the catalog model CHECK; idempotent and changes no
-- existing row values. Review and apply manually; not applied by the app.
begin;

-- The legacy catalog restricts this field to lite|flash. Match the extensible
-- model-key shape in PLANS-DESIGN.md so reviewed provider ids can also be
-- catalog terms. This changes no existing rows or referenced plan versions;
-- arbitrary new keys remain safe because both reservation and provider code
-- enforce their model allowlists. Constraint replacement follows the guarded
-- manual-delta style used by 20261104_site_tenants.sql.
alter table public.tryon_plans
  drop constraint if exists tryon_plans_model_check;
alter table public.tryon_plans
  add constraint tryon_plans_model_check
  check (char_length(btrim(model_key)) between 1 and 200);

create or replace function public.reserve_tryon_plan_credit(
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
  job_created_at timestamptz,
  model_fallback_reason text
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_shop_domain text := lower(btrim(p_shop_domain));
  v_subscription public.tryon_subscriptions%rowtype;
  v_plan_model text;
  v_model text;
  v_fallback text;
  v_reason text;
begin
  -- Retries use the reservation, even if the subscription has since changed
  -- plan, expired, or been disconnected. They never spend another credit.
  return query
  select j.id, false, j.status, j.model_key, j.message, j.provider,
    j.cost_usd, j.duration_ms, j.created_at, null::text
  from public.tryon_jobs j
  where j.shop = v_shop_domain and j.request_key = p_request_key;
  if found then return; end if;

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

  -- Concurrent identical requests may have waited for this subscription lock.
  return query
  select j.id, false, j.status, j.model_key, j.message, j.provider,
    j.cost_usd, j.duration_ms, j.created_at, null::text
  from public.tryon_jobs j
  where j.shop = v_shop_domain and j.request_key = p_request_key;
  if found then return; end if;

  select p.model_key into v_plan_model
  from public.tryon_plans p where p.id = v_subscription.plan_id;

  v_fallback := case btrim(p_model_key)
    when 'google/gemini-3.1-flash-lite-image' then 'google/gemini-3.1-flash-lite-image'
    when 'google/gemini-3.1-flash-image' then 'google/gemini-3.1-flash-image'
    when 'meta/muse-image' then 'meta/muse-image'
    else 'meta/muse-image'
  end;
  v_model := case btrim(v_plan_model)
    when 'lite' then 'google/gemini-3.1-flash-lite-image'
    when 'flash' then 'google/gemini-3.1-flash-image'
    when 'muse' then 'meta/muse-image'
    when 'google/gemini-3.1-flash-lite-image' then 'google/gemini-3.1-flash-lite-image'
    when 'google/gemini-3.1-flash-image' then 'google/gemini-3.1-flash-image'
    when 'meta/muse-image' then 'meta/muse-image'
    else null
  end;
  if v_model is null then
    v_reason := case when nullif(btrim(v_plan_model), '') is null
      then 'plan_model_missing' else 'plan_model_unknown' end;
    v_model := v_fallback;
  end if;

  -- The lock remains held while the existing atomic job+debit function runs.
  -- That function stores this provider id on both the job and debit metadata.
  return query
  select r.*, v_reason
  from public.reserve_tryon_credit(
    v_shop_domain, p_job_id, p_request_key, p_session_id, p_product_id, v_model
  ) r;
end;
$$;

revoke execute on function public.reserve_tryon_plan_credit(text, text, uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.reserve_tryon_plan_credit(text, text, uuid, text, text, text)
  to service_role;

comment on function public.reserve_tryon_plan_credit(text, text, uuid, text, text, text) is
  'Service-only, atomic plan-model selection and credit reservation; retries retain the stored provider model.';

commit;

-- Rollback: deploy the legacy-compatible service first, then drop only this
-- wrapper. Preserve jobs, model_key and the append-only ledger history.
-- Retain the wider catalog CHECK if any new rows use provider ids or muse;
-- restoring lite|flash would reject those rows and is a separate manual review.
-- drop function if exists public.reserve_tryon_plan_credit(text, text, uuid, text, text, text);
